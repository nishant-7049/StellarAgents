use soroban_sdk::{contracttype, contracterror, Address, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ValidationError {
    AlreadyInitialized = 1,
    RequestNotFound = 2,
    NotValidator = 3,
    AlreadyCompleted = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ValidationStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

#[contracttype]
pub enum DataKey {
    Admin,
    NextRequestId,
    Validation(u32),          // request_id -> Validation
    AgentValidations(u32),    // agent_id -> Vec<u32> (request_ids)
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Validation {
    pub request_id: u32,
    pub agent_id: u32,
    pub validator: Address,
    pub request_uri: String,
    pub data_hash: String,
    pub status: ValidationStatus,
    pub success: bool,
    pub evidence_uri: String,
    pub requested_at: u64,
    pub completed_at: u64,
}
