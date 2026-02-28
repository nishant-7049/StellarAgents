#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, Env, Symbol, Vec};

pub mod agent;
pub mod owner;
pub mod types;
use types::{AgentPolicy, DataKey, VaultError};

#[contract]
pub struct UserVault;

#[contractimpl]
impl UserVault {
    // ── CONSTRUCTOR (called by deploy_v2 from VaultFactory) ──

    pub fn __constructor(env: Env, owner: Address, usdc_token: Address, factory: Address) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Factory, &factory);
        env.storage().instance().set(&DataKey::AgentCount, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::AgentList, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::TotalSpent, &0i128);
        env.storage().instance().set(&DataKey::TxNonce, &0u64);
    }

    // ── INITIALIZATION (kept for standalone deploys / tests) ──

    pub fn initialize(
        env: Env,
        owner: Address,
        usdc_token: Address,
        factory: Address,
    ) -> Result<(), VaultError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(VaultError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Factory, &factory);
        env.storage().instance().set(&DataKey::AgentCount, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::AgentList, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::TotalSpent, &0i128);
        env.storage().instance().set(&DataKey::TxNonce, &0u64);
        Ok(())
    }

    // ── OWNER FUNCTIONS ──

    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<(), VaultError> {
        from.require_auth();
        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        token::Client::new(&env, &usdc).transfer(&from, &env.current_contract_address(), &amount);
        env.events()
            .publish((Symbol::new(&env, "deposit"),), (from, amount));
        Ok(())
    }

    pub fn withdraw(env: Env, owner: Address, amount: i128) -> Result<(), VaultError> {
        owner.require_auth();
        Self::require_owner(&env, &owner)?;
        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        let bal = token_client.balance(&env.current_contract_address());
        if bal < amount {
            return Err(VaultError::InsufficientBalance);
        }
        token_client.transfer(&env.current_contract_address(), &owner, &amount);
        env.events()
            .publish((Symbol::new(&env, "withdraw"),), (owner, amount));
        Ok(())
    }

    pub fn add_agent(
        env: Env,
        owner: Address,
        agent: Address,
        daily_limit: i128,
        allowed_destinations: Vec<Address>,
    ) -> Result<(), VaultError> {
        owner.require_auth();
        Self::require_owner(&env, &owner)?;

        if env
            .storage()
            .persistent()
            .has(&DataKey::AgentPolicy(agent.clone()))
        {
            let existing: AgentPolicy = env
                .storage()
                .persistent()
                .get(&DataKey::AgentPolicy(agent.clone()))
                .unwrap();
            if existing.is_active {
                return Err(VaultError::DuplicateAgent);
            }
        }

        let policy = AgentPolicy {
            agent_address: agent.clone(),
            daily_limit,
            spent_today: 0,
            last_reset: env.ledger().timestamp(),
            allowed_destinations,
            is_active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::AgentPolicy(agent.clone()), &policy);

        let mut agents: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::AgentList)
            .unwrap_or(Vec::new(&env));
        agents.push_back(agent.clone());
        env.storage().instance().set(&DataKey::AgentList, &agents);

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AgentCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::AgentCount, &(count + 1));

        env.events()
            .publish((Symbol::new(&env, "agent_added"),), (agent, daily_limit));
        Ok(())
    }

    pub fn remove_agent(env: Env, owner: Address, agent: Address) -> Result<(), VaultError> {
        owner.require_auth();
        Self::require_owner(&env, &owner)?;

        let mut policy: AgentPolicy = env
            .storage()
            .persistent()
            .get(&DataKey::AgentPolicy(agent.clone()))
            .ok_or(VaultError::AgentNotFound)?;
        policy.is_active = false;
        env.storage()
            .persistent()
            .set(&DataKey::AgentPolicy(agent.clone()), &policy);

        env.events()
            .publish((Symbol::new(&env, "agent_removed"),), (agent,));
        Ok(())
    }

    pub fn set_agent_limit(
        env: Env,
        owner: Address,
        agent: Address,
        new_limit: i128,
    ) -> Result<(), VaultError> {
        owner.require_auth();
        Self::require_owner(&env, &owner)?;

        let mut policy: AgentPolicy = env
            .storage()
            .persistent()
            .get(&DataKey::AgentPolicy(agent.clone()))
            .ok_or(VaultError::AgentNotFound)?;
        policy.daily_limit = new_limit;
        env.storage()
            .persistent()
            .set(&DataKey::AgentPolicy(agent.clone()), &policy);
        Ok(())
    }

    // ── AGENT FUNCTIONS (x402 payment entry point) ──

    pub fn agent_pay(
        env: Env,
        agent: Address,
        pay_to: Address,
        amount: i128,
        memo: Symbol,
    ) -> Result<(), VaultError> {
        agent.require_auth();

        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        let mut policy: AgentPolicy = env
            .storage()
            .persistent()
            .get(&DataKey::AgentPolicy(agent.clone()))
            .ok_or(VaultError::AgentNotFound)?;

        if !policy.is_active {
            return Err(VaultError::AgentInactive);
        }

        if !policy.is_destination_allowed(&pay_to) {
            return Err(VaultError::DestinationNotAllowed);
        }

        let now = env.ledger().timestamp();
        if policy.available_limit(now) < amount {
            return Err(VaultError::ExceedsDailyLimit);
        }

        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &usdc);
        let vault_balance = token_client.balance(&env.current_contract_address());
        if vault_balance < amount {
            return Err(VaultError::InsufficientBalance);
        }

        policy.record_spend(amount, now);
        env.storage()
            .persistent()
            .set(&DataKey::AgentPolicy(agent.clone()), &policy);

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSpent)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSpent, &(total + amount));

        let nonce: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TxNonce)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TxNonce, &(nonce + 1));

        token_client.transfer(&env.current_contract_address(), &pay_to, &amount);

        env.events().publish(
            (Symbol::new(&env, "agent_pay"),),
            (agent, pay_to, amount, memo, nonce),
        );

        Ok(())
    }

    // ── VIEW FUNCTIONS ──

    pub fn balance(env: Env) -> i128 {
        let usdc: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        token::Client::new(&env, &usdc).balance(&env.current_contract_address())
    }

    pub fn owner(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Owner).unwrap()
    }

    pub fn get_agent_policy(env: Env, agent: Address) -> Result<AgentPolicy, VaultError> {
        env.storage()
            .persistent()
            .get(&DataKey::AgentPolicy(agent))
            .ok_or(VaultError::AgentNotFound)
    }

    pub fn remaining_limit(env: Env, agent: Address) -> Result<i128, VaultError> {
        let policy: AgentPolicy = env
            .storage()
            .persistent()
            .get(&DataKey::AgentPolicy(agent))
            .ok_or(VaultError::AgentNotFound)?;
        Ok(policy.available_limit(env.ledger().timestamp()))
    }

    pub fn list_agents(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AgentList)
            .unwrap_or(Vec::new(&env))
    }

    pub fn agent_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::AgentCount)
            .unwrap_or(0)
    }

    pub fn total_spent(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSpent)
            .unwrap_or(0)
    }

    // ── INTERNAL ──

    fn require_owner(env: &Env, caller: &Address) -> Result<(), VaultError> {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        if *caller != owner {
            return Err(VaultError::NotOwner);
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
