#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

pub mod types;
use types::{AgentInfo, DataKey, RegistryError};

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &1u32);
        env.storage().instance().set(&DataKey::TotalActive, &0u32);
        Ok(())
    }

    pub fn register(
        env: Env,
        owner: Address,
        name: String,
        agent_uri: String,
        vault_address: Address,
        agent_signer: Address,
    ) -> u32 {
        owner.require_auth();
        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap();

        let agent = AgentInfo {
            id,
            owner: owner.clone(),
            name,
            agent_uri,
            vault_address,
            agent_signer,
            registered_at: env.ledger().timestamp(),
            is_active: true,
        };

        env.storage().persistent().set(&DataKey::Agent(id), &agent);
        env.storage()
            .persistent()
            .set(&DataKey::OwnerAgent(owner), &id);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalActive)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalActive, &(total + 1));
        id
    }

    pub fn set_agent_uri(
        env: Env,
        owner: Address,
        agent_id: u32,
        new_uri: String,
    ) -> Result<(), RegistryError> {
        owner.require_auth();
        let mut agent: AgentInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Agent(agent_id))
            .ok_or(RegistryError::AgentNotFound)?;
        if agent.owner != owner {
            return Err(RegistryError::NotAgentOwner);
        }
        agent.agent_uri = new_uri;
        env.storage()
            .persistent()
            .set(&DataKey::Agent(agent_id), &agent);
        Ok(())
    }

    pub fn set_metadata(
        env: Env,
        owner: Address,
        agent_id: u32,
        key: String,
        value: String,
    ) -> Result<(), RegistryError> {
        owner.require_auth();
        let agent: AgentInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Agent(agent_id))
            .ok_or(RegistryError::AgentNotFound)?;
        if agent.owner != owner {
            return Err(RegistryError::NotAgentOwner);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(agent_id, key), &value);
        Ok(())
    }

    pub fn get_metadata(env: Env, agent_id: u32, key: String) -> Option<String> {
        env.storage()
            .persistent()
            .get(&DataKey::Metadata(agent_id, key))
    }

    pub fn deactivate(env: Env, owner: Address, agent_id: u32) -> Result<(), RegistryError> {
        owner.require_auth();
        let mut agent: AgentInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Agent(agent_id))
            .ok_or(RegistryError::AgentNotFound)?;
        if agent.owner != owner {
            return Err(RegistryError::NotAgentOwner);
        }
        agent.is_active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Agent(agent_id), &agent);
        let total: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalActive)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&DataKey::TotalActive, &total.saturating_sub(1));
        Ok(())
    }

    pub fn get_agent(env: Env, agent_id: u32) -> Result<AgentInfo, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Agent(agent_id))
            .ok_or(RegistryError::AgentNotFound)
    }

    pub fn get_agent_by_owner(env: Env, owner: Address) -> Option<u32> {
        env.storage().persistent().get(&DataKey::OwnerAgent(owner))
    }

    pub fn agent_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalActive)
            .unwrap_or(0)
    }

    pub fn next_id(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(1)
    }

    pub fn list_agents(env: Env, start_id: u32, limit: u32) -> Vec<AgentInfo> {
        let next: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(1);
        let mut result = Vec::new(&env);
        let mut id = start_id;
        let mut count = 0u32;
        while id < next && count < limit {
            if let Some(a) =
                env.storage()
                    .persistent()
                    .get::<DataKey, AgentInfo>(&DataKey::Agent(id))
            {
                if a.is_active {
                    result.push_back(a);
                    count += 1;
                }
            }
            id += 1;
        }
        result
    }
}

#[cfg(test)]
mod test;
