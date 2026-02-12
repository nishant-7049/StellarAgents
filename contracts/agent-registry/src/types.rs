use soroban_sdk::{contracttype, contracterror, Address, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    AgentNotFound = 2,
    NotAgentOwner = 3,
    AgentInactive = 4,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Agent(u32),
    OwnerAgent(Address),
    NextId,
    TotalActive,
    Metadata(u32, String),
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct AgentInfo {
    pub id: u32,
    pub owner: Address,
    pub name: String,
    pub agent_uri: String,
    pub vault_address: Address,
    pub agent_signer: Address,
    pub registered_at: u64,
    pub is_active: bool,
}
