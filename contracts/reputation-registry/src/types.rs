use soroban_sdk::{contracttype, contracterror, Address, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ReputationError {
    AlreadyInitialized = 1,
    InvalidScore = 2,
    AgentNotFound = 3,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Feedback(u32, u32),       // (agent_id, feedback_index)
    FeedbackCount(u32),       // agent_id -> count
    Summary(u32),             // agent_id -> FeedbackSummary
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Feedback {
    pub agent_id: u32,
    pub reviewer: Address,
    pub score: u32,
    pub category: String,
    pub data_uri: String,
    pub payment_proof_hash: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct FeedbackSummary {
    pub total_reviews: u32,
    pub total_score: u32,
    pub avg_score_x100: u32,  // score * 100 for 2 decimal precision (e.g., 4.35 = 435)
}
