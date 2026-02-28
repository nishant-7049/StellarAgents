use soroban_sdk::{contracterror, contracttype, Address, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    TokenNotFound = 3,
    NotTokenOwner = 4,
    NotApprovedOrOwner = 5,
    InvalidRecipient = 6,
    HandleAlreadyTaken = 7,
    HandleTooShort = 8,
    HandleTooLong = 9,
    HandleInvalidChars = 10,
    AlreadyInactive = 11,
    AlreadyActive = 12,
    ApprovalToCurrentOwner = 13,
    ApproveCallerNotOwnerNorOperator = 14,
    NameTooLong = 15,
    AgentUriTooLong = 16,
    MetadataKeyTooLong = 17,
    MetadataValueTooLong = 18,
    NotAdmin = 19,
    SymbolTooLong = 20,
    ContractUriTooLong = 21,
    InvalidTokenId = 22,
    MigrationClosed = 23,
    TokenAlreadyExists = 24,
    InvalidLiveUntilLedger = 25,
}

#[contracttype]
pub enum DataKey {
    Admin,
    CollectionName,
    CollectionSymbol,
    ContractUri,
    MigrationOpen,
    NextTokenId,
    TotalSupply,
    ActiveCount,
    Token(u64),
    TokenOwner(u64),
    Balance(Address),
    OwnerTokenCount(Address),
    OwnerToken(Address, u32),
    TokenOwnerIndex(u64),
    GlobalToken(u64),
    TokenGlobalIndex(u64),
    ActiveToken(u64),
    TokenActiveIndex(u64),
    HandleToken(String),
    TokenApproval(u64),
    OperatorApproval(Address, Address),
    Metadata(u64, String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentIdentity {
    pub token_id: u64,
    pub owner: Address,
    /// Human-readable display name (not unique)
    pub name: String,
    /// Unique handle — like ENS, e.g. "stellar-yield-bot"
    /// Globally unique, lowercase, alphanumeric + hyphens, 3–32 chars
    pub handle: String,
    pub agent_uri: String,
    pub vault_address: Address,
    pub agent_signer: Address,
    pub registered_at: u64,
    pub updated_at: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalData {
    pub approved: Address,
    pub live_until_ledger: u32,
}
