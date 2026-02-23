use soroban_sdk::{contracttype, contracterror, Address, Vec};

/// Error codes returned by vault operations
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotOwner = 3,
    AgentNotFound = 4,
    AgentInactive = 5,
    ExceedsDailyLimit = 6,
    DestinationNotAllowed = 7,
    InsufficientBalance = 8,
    DuplicateAgent = 9,
    InvalidAmount = 10,
}

/// Storage keys for the vault contract
#[contracttype]
pub enum DataKey {
    Owner,
    UsdcToken,
    Factory,
    AgentPolicy(Address),
    AgentList,
    AgentCount,
    Initialized,
    TotalSpent,
    TxNonce,
}

/// Per-agent spending policy, enforced on-chain in every agent_pay() call
#[contracttype]
#[derive(Clone, Debug)]
pub struct AgentPolicy {
    pub agent_address: Address,
    pub daily_limit: i128,
    pub spent_today: i128,
    pub last_reset: u64,
    pub allowed_destinations: Vec<Address>,
    pub is_active: bool,
}

impl AgentPolicy {
    pub fn available_limit(&self, now: u64) -> i128 {
        let spent = if now.saturating_sub(self.last_reset) >= 86400 {
            0i128
        } else {
            self.spent_today
        };
        self.daily_limit.saturating_sub(spent)
    }

    pub fn is_destination_allowed(&self, dest: &Address) -> bool {
        if self.allowed_destinations.is_empty() {
            return true;
        }
        for i in 0..self.allowed_destinations.len() {
            if self.allowed_destinations.get(i).unwrap() == dest.clone() {
                return true;
            }
        }
        false
    }

    pub fn record_spend(&mut self, amount: i128, now: u64) {
        if now.saturating_sub(self.last_reset) >= 86400 {
            self.spent_today = amount;
            self.last_reset = now;
        } else {
            self.spent_today = self.spent_today.saturating_add(amount);
        }
    }
}
