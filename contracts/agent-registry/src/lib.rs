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

    /// Validate a handle: 3–32 chars, only lowercase a-z, 0-9, and hyphens.
    /// No leading/trailing hyphens.
    fn validate_handle(handle: &String) -> Result<(), RegistryError> {
        let bytes = handle.to_bytes();
        let len = bytes.len();

        if len < 3 {
            return Err(RegistryError::HandleTooShort);
        }
        if len > 32 {
            return Err(RegistryError::HandleTooLong);
        }

        // No leading or trailing hyphens
        if bytes.get(0) == Some(b'-') || bytes.get(len - 1) == Some(b'-') {
            return Err(RegistryError::HandleInvalidChars);
        }

        for i in 0..len {
            let c = bytes.get(i).unwrap();
            let valid = (c >= b'a' && c <= b'z')
                || (c >= b'0' && c <= b'9')
                || c == b'-';
            if !valid {
                return Err(RegistryError::HandleInvalidChars);
            }
        }
        Ok(())
    }

    /// Register a new agent with a unique handle.
    /// Returns the assigned numeric agent ID.
    ///
    /// # Handle rules
    /// - 3–32 characters
    /// - Lowercase letters (a-z), digits (0-9), hyphens only
    /// - No leading or trailing hyphens
    /// - Globally unique — first come, first served (like ENS)
    pub fn register(
        env: Env,
        owner: Address,
        name: String,
        handle: String,
        agent_uri: String,
        vault_address: Address,
        agent_signer: Address,
    ) -> Result<u32, RegistryError> {
        owner.require_auth();

        // Validate handle format
        Self::validate_handle(&handle)?;

        // Enforce uniqueness — reject if handle is already claimed
        if env.storage().persistent().has(&DataKey::HandleAgent(handle.clone())) {
            return Err(RegistryError::HandleAlreadyTaken);
        }

        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap();

        let agent = AgentInfo {
            id,
            owner: owner.clone(),
            name,
            handle: handle.clone(),
            agent_uri,
            vault_address,
            agent_signer,
            registered_at: env.ledger().timestamp(),
            is_active: true,
        };

        env.storage().persistent().set(&DataKey::Agent(id), &agent);
        env.storage().persistent().set(&DataKey::OwnerAgent(owner), &id);
        // Claim the handle — maps "stellar-yield-bot" → agent ID
        env.storage().persistent().set(&DataKey::HandleAgent(handle), &id);

        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        let total: u32 = env.storage().instance().get(&DataKey::TotalActive).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalActive, &(total + 1));

        Ok(id)
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

    /// Resolve a human-readable handle to the full AgentInfo.
    /// e.g. "stellar-yield-bot" → AgentInfo { id: 1, name: "...", ... }
    pub fn get_agent_by_handle(env: Env, handle: String) -> Result<AgentInfo, RegistryError> {
        let id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::HandleAgent(handle))
            .ok_or(RegistryError::AgentNotFound)?;
        env.storage()
            .persistent()
            .get(&DataKey::Agent(id))
            .ok_or(RegistryError::AgentNotFound)
    }

    /// Check if a handle is still available before registering.
    pub fn is_handle_available(env: Env, handle: String) -> bool {
        !env.storage().persistent().has(&DataKey::HandleAgent(handle))
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

    /// Transfer agent ownership to a new address.
    /// The handle stays the same — it travels with the agent, not the owner.
    pub fn transfer_agent(
        env: Env,
        current_owner: Address,
        agent_id: u32,
        new_owner: Address,
    ) -> Result<(), RegistryError> {
        current_owner.require_auth();
        let mut agent: AgentInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Agent(agent_id))
            .ok_or(RegistryError::AgentNotFound)?;
        if agent.owner != current_owner {
            return Err(RegistryError::NotAgentOwner);
        }
        // Update owner lookups — handle mapping stays unchanged
        env.storage().persistent().remove(&DataKey::OwnerAgent(current_owner));
        env.storage().persistent().set(&DataKey::OwnerAgent(new_owner.clone()), &agent_id);
        agent.owner = new_owner;
        env.storage().persistent().set(&DataKey::Agent(agent_id), &agent);
        Ok(())
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
