#![no_std]
use soroban_sdk::{
    contract, contractimpl, panic_with_error, Address, Env, String, Symbol, Vec,
};
use stellar_tokens::non_fungible::{MAX_NAME_LEN as OZ_NAME_MAX_LEN, MAX_SYMBOL_LEN as OZ_SYMBOL_MAX_LEN};

pub mod types;
use types::{AgentIdentity, ApprovalData, DataKey, RegistryError};

const NAME_MAX_LEN: u32 = OZ_NAME_MAX_LEN as u32;
const SYMBOL_MAX_LEN: u32 = OZ_SYMBOL_MAX_LEN as u32;
const URI_MAX_LEN: u32 = 2048;
const CONTRACT_URI_MAX_LEN: u32 = 2048;
const METADATA_KEY_MAX_LEN: u32 = 64;
const METADATA_VALUE_MAX_LEN: u32 = 2048;
const DEFAULT_COLLECTION_NAME: &str = "Agent Identity";
const DEFAULT_COLLECTION_SYMBOL: &str = "AGENT";
const DEFAULT_CONTRACT_URI: &str = "ipfs://agent-registry";

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {
    fn ttl_params(env: &Env) -> Option<(u32, u32)> {
        let max = env.storage().max_ttl();
        if max == 0 {
            return None;
        }
        let extend_to = core::cmp::max(1, max.saturating_sub(max / 20)); // keep 95% of max TTL
        let threshold = core::cmp::max(1, extend_to / 2);
        Some((threshold, extend_to))
    }

    fn bump_instance_ttl(env: &Env) {
        if let Some((threshold, extend_to)) = Self::ttl_params(env) {
            env.storage().instance().extend_ttl(threshold, extend_to);
        }
    }

    fn bump_persistent_ttl(env: &Env, key: &DataKey) {
        if let Some((threshold, extend_to)) = Self::ttl_params(env) {
            env.storage()
                .persistent()
                .extend_ttl(key, threshold, extend_to);
        }
    }

    fn require_initialized(env: &Env) -> Result<(), RegistryError> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::NotInitialized);
        }
        Self::bump_instance_ttl(env);
        Ok(())
    }

    fn require_initialized_or_panic(env: &Env) {
        if let Err(err) = Self::require_initialized(env) {
            panic_with_error!(env, err);
        }
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), RegistryError> {
        Self::require_initialized(env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(RegistryError::NotInitialized)?;
        if *caller != admin {
            return Err(RegistryError::NotAdmin);
        }
        Ok(())
    }

    fn validate_max_len(
        value: &String,
        max_len: u32,
        error: RegistryError,
    ) -> Result<(), RegistryError> {
        if value.to_bytes().len() > max_len {
            return Err(error);
        }
        Ok(())
    }

    fn validate_name(name: &String) -> Result<(), RegistryError> {
        Self::validate_max_len(name, NAME_MAX_LEN, RegistryError::NameTooLong)
    }

    fn validate_symbol(symbol: &String) -> Result<(), RegistryError> {
        if symbol.to_bytes().is_empty() {
            return Err(RegistryError::SymbolTooLong);
        }
        Self::validate_max_len(symbol, SYMBOL_MAX_LEN, RegistryError::SymbolTooLong)
    }

    fn validate_agent_uri(agent_uri: &String) -> Result<(), RegistryError> {
        Self::validate_max_len(agent_uri, URI_MAX_LEN, RegistryError::AgentUriTooLong)
    }

    fn validate_contract_uri(contract_uri: &String) -> Result<(), RegistryError> {
        Self::validate_max_len(
            contract_uri,
            CONTRACT_URI_MAX_LEN,
            RegistryError::ContractUriTooLong,
        )
    }

    fn validate_metadata(key: &String, value: &String) -> Result<(), RegistryError> {
        Self::validate_max_len(key, METADATA_KEY_MAX_LEN, RegistryError::MetadataKeyTooLong)?;
        Self::validate_max_len(
            value,
            METADATA_VALUE_MAX_LEN,
            RegistryError::MetadataValueTooLong,
        )?;
        Ok(())
    }

    fn token_id_u32(env: &Env, token_id: u64) -> u32 {
        if token_id > u32::MAX as u64 {
            panic_with_error!(env, RegistryError::InvalidTokenId);
        }
        token_id as u32
    }

    fn validate_live_until_ledger(
        env: &Env,
        live_until_ledger: u32,
    ) -> Result<(), RegistryError> {
        if live_until_ledger != 0 && live_until_ledger < env.ledger().sequence() {
            return Err(RegistryError::InvalidLiveUntilLedger);
        }
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

        if bytes.get(0) == Some(b'-') || bytes.get(len - 1) == Some(b'-') {
            return Err(RegistryError::HandleInvalidChars);
        }

        for i in 0..len {
            let c = bytes.get(i).unwrap();
            let valid = (c >= b'a' && c <= b'z') || (c >= b'0' && c <= b'9') || c == b'-';
            if !valid {
                return Err(RegistryError::HandleInvalidChars);
            }
        }
        Ok(())
    }

    fn get_token(env: &Env, token_id: u64) -> Result<AgentIdentity, RegistryError> {
        let key = DataKey::Token(token_id);
        let token = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::TokenNotFound)?;
        Self::bump_persistent_ttl(env, &key);
        Ok(token)
    }

    fn is_operator_approved(env: &Env, owner: &Address, operator: &Address) -> bool {
        let key = DataKey::OperatorApproval(owner.clone(), operator.clone());
        let Some(live_until_ledger) = env.storage().temporary().get::<DataKey, u32>(&key) else {
            return false;
        };
        live_until_ledger >= env.ledger().sequence()
    }

    fn is_approved_or_owner(
        env: &Env,
        caller: &Address,
        token_id: u64,
        owner: &Address,
    ) -> bool {
        if *caller == *owner {
            return true;
        }

        let approval_key = DataKey::TokenApproval(token_id);
        if let Some(approval) = env
            .storage()
            .temporary()
            .get::<DataKey, ApprovalData>(&approval_key)
        {
            if approval.live_until_ledger >= env.ledger().sequence()
                && approval.approved == caller.clone()
            {
                return true;
            }
        }

        Self::is_operator_approved(env, owner, caller)
    }

    fn clear_token_approval(env: &Env, token_id: u64) {
        env.storage()
            .temporary()
            .remove(&DataKey::TokenApproval(token_id));
    }

    fn transfer_core(
        env: &Env,
        from: &Address,
        to: &Address,
        token_id: u64,
    ) -> Result<(), RegistryError> {
        if *to == env.current_contract_address() {
            return Err(RegistryError::InvalidRecipient);
        }

        let mut token = Self::get_token(env, token_id)?;
        let token_owner = token.owner.clone();
        if token_owner != *from {
            return Err(RegistryError::NotTokenOwner);
        }

        if *from != *to {
            Self::remove_owner_token(env, from, token_id);
            Self::add_owner_token(env, to, token_id);

            let from_balance_key = DataKey::Balance(from.clone());
            let from_balance: u32 = env
                .storage()
                .persistent()
                .get(&from_balance_key)
                .unwrap_or(0);
            env.storage().persistent().set(
                &from_balance_key,
                &from_balance.saturating_sub(1),
            );
            Self::bump_persistent_ttl(env, &from_balance_key);

            let to_balance_key = DataKey::Balance(to.clone());
            let to_balance: u32 = env.storage().persistent().get(&to_balance_key).unwrap_or(0);
            env.storage()
                .persistent()
                .set(&to_balance_key, &to_balance.saturating_add(1));
            Self::bump_persistent_ttl(env, &to_balance_key);
        }

        token.owner = to.clone();
        token.updated_at = env.ledger().timestamp();

        let token_key = DataKey::Token(token_id);
        let owner_key = DataKey::TokenOwner(token_id);
        env.storage().persistent().set(&token_key, &token);
        env.storage().persistent().set(&owner_key, to);
        Self::bump_persistent_ttl(env, &token_key);
        Self::bump_persistent_ttl(env, &owner_key);
        Self::clear_token_approval(env, token_id);

        env.events()
            .publish((Symbol::new(env, "transfer"), from, to, token_id), ());
        Ok(())
    }

    fn burn_core(env: &Env, token_id: u64) -> Result<(), RegistryError> {
        let token = Self::get_token(env, token_id)?;
        let owner = token.owner.clone();

        Self::remove_owner_token(env, &owner, token_id);
        Self::remove_global_token(env, token_id);
        if token.is_active {
            Self::remove_active_token(env, token_id);
        }

        let balance_key = DataKey::Balance(owner.clone());
        let balance: u32 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&balance_key, &balance.saturating_sub(1));
        Self::bump_persistent_ttl(env, &balance_key);

        let total: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &total.saturating_sub(1));
        Self::bump_instance_ttl(env);

        env.storage().persistent().remove(&DataKey::Token(token_id));
        env.storage().persistent().remove(&DataKey::TokenOwner(token_id));
        env.storage()
            .persistent()
            .remove(&DataKey::HandleToken(token.handle));
        env.storage()
            .temporary()
            .remove(&DataKey::TokenApproval(token_id));

        env.events()
            .publish((Symbol::new(env, "burn"), owner, token_id), ());
        Ok(())
    }

    fn add_owner_token(env: &Env, owner: &Address, token_id: u64) {
        let count_key = DataKey::OwnerTokenCount(owner.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

        let owner_slot_key = DataKey::OwnerToken(owner.clone(), count);
        let owner_index_key = DataKey::TokenOwnerIndex(token_id);

        env.storage()
            .persistent()
            .set(&owner_slot_key, &token_id);
        env.storage()
            .persistent()
            .set(&owner_index_key, &count);
        env.storage()
            .persistent()
            .set(&count_key, &count.saturating_add(1));

        Self::bump_persistent_ttl(env, &owner_slot_key);
        Self::bump_persistent_ttl(env, &owner_index_key);
        Self::bump_persistent_ttl(env, &count_key);
    }

    fn add_global_token(env: &Env, token_id: u64) {
        let total_supply: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);

        let global_slot_key = DataKey::GlobalToken(total_supply);
        let global_index_key = DataKey::TokenGlobalIndex(token_id);

        env.storage()
            .persistent()
            .set(&global_slot_key, &token_id);
        env.storage()
            .persistent()
            .set(&global_index_key, &total_supply);

        Self::bump_persistent_ttl(env, &global_slot_key);
        Self::bump_persistent_ttl(env, &global_index_key);
    }

    fn remove_global_token(env: &Env, token_id: u64) {
        let total_supply: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        if total_supply == 0 {
            return;
        }

        let global_index_key = DataKey::TokenGlobalIndex(token_id);
        let Some(index) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&global_index_key)
        else {
            return;
        };
        Self::bump_persistent_ttl(env, &global_index_key);

        if index >= total_supply {
            return;
        }

        let last_index = total_supply.saturating_sub(1);
        let last_slot_key = DataKey::GlobalToken(last_index);
        let last_token: u64 = env
            .storage()
            .persistent()
            .get(&last_slot_key)
            .unwrap_or(token_id);

        if index != last_index {
            let move_slot_key = DataKey::GlobalToken(index);
            env.storage().persistent().set(&move_slot_key, &last_token);
            Self::bump_persistent_ttl(env, &move_slot_key);

            let moved_token_index_key = DataKey::TokenGlobalIndex(last_token);
            env.storage()
                .persistent()
                .set(&moved_token_index_key, &index);
            Self::bump_persistent_ttl(env, &moved_token_index_key);
        }

        env.storage().persistent().remove(&last_slot_key);
        env.storage().persistent().remove(&global_index_key);
    }

    fn remove_owner_token(env: &Env, owner: &Address, token_id: u64) {
        let count_key = DataKey::OwnerTokenCount(owner.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        if count == 0 {
            return;
        }

        let owner_index_key = DataKey::TokenOwnerIndex(token_id);
        let Some(index) = env
            .storage()
            .persistent()
            .get::<DataKey, u32>(&owner_index_key)
        else {
            return;
        };
        Self::bump_persistent_ttl(env, &owner_index_key);

        if index >= count {
            return;
        }

        let last_index = count.saturating_sub(1);
        let last_slot_key = DataKey::OwnerToken(owner.clone(), last_index);
        let last_token: u64 = env
            .storage()
            .persistent()
            .get(&last_slot_key)
            .unwrap_or(token_id);

        if index != last_index {
            let move_slot_key = DataKey::OwnerToken(owner.clone(), index);
            env.storage().persistent().set(&move_slot_key, &last_token);
            Self::bump_persistent_ttl(env, &move_slot_key);

            let moved_token_index_key = DataKey::TokenOwnerIndex(last_token);
            env.storage()
                .persistent()
                .set(&moved_token_index_key, &index);
            Self::bump_persistent_ttl(env, &moved_token_index_key);
        }

        env.storage().persistent().remove(&last_slot_key);
        env.storage().persistent().remove(&owner_index_key);

        if last_index == 0 {
            env.storage().persistent().remove(&count_key);
        } else {
            env.storage().persistent().set(&count_key, &last_index);
            Self::bump_persistent_ttl(env, &count_key);
        }
    }

    fn add_active_token(env: &Env, token_id: u64) {
        let active_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(0);

        let active_slot_key = DataKey::ActiveToken(active_count);
        let active_index_key = DataKey::TokenActiveIndex(token_id);

        env.storage()
            .persistent()
            .set(&active_slot_key, &token_id);
        env.storage()
            .persistent()
            .set(&active_index_key, &active_count);
        env.storage()
            .instance()
            .set(&DataKey::ActiveCount, &active_count.saturating_add(1));

        Self::bump_persistent_ttl(env, &active_slot_key);
        Self::bump_persistent_ttl(env, &active_index_key);
        Self::bump_instance_ttl(env);
    }

    fn remove_active_token(env: &Env, token_id: u64) {
        let active_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(0);
        if active_count == 0 {
            return;
        }

        let active_index_key = DataKey::TokenActiveIndex(token_id);
        let Some(index) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&active_index_key)
        else {
            return;
        };
        Self::bump_persistent_ttl(env, &active_index_key);

        if index >= active_count {
            return;
        }

        let last_index = active_count.saturating_sub(1);
        let last_slot_key = DataKey::ActiveToken(last_index);
        let last_token: u64 = env
            .storage()
            .persistent()
            .get(&last_slot_key)
            .unwrap_or(token_id);

        if index != last_index {
            let move_slot_key = DataKey::ActiveToken(index);
            env.storage().persistent().set(&move_slot_key, &last_token);
            Self::bump_persistent_ttl(env, &move_slot_key);

            let moved_token_index_key = DataKey::TokenActiveIndex(last_token);
            env.storage()
                .persistent()
                .set(&moved_token_index_key, &index);
            Self::bump_persistent_ttl(env, &moved_token_index_key);
        }

        env.storage().persistent().remove(&last_slot_key);
        env.storage().persistent().remove(&active_index_key);
        env.storage()
            .instance()
            .set(&DataKey::ActiveCount, &last_index);

        Self::bump_instance_ttl(env);
    }

    fn is_migration_open(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::MigrationOpen)
            .unwrap_or(false)
    }

    fn mint_identity_with_token_id(
        env: &Env,
        token_id: u64,
        owner: Address,
        name: String,
        handle: String,
        agent_uri: String,
        vault_address: Address,
        agent_signer: Address,
        registered_at: u64,
        updated_at: u64,
        is_active: bool,
    ) -> Result<u64, RegistryError> {
        if token_id == 0 {
            return Err(RegistryError::InvalidTokenId);
        }

        let handle_key = DataKey::HandleToken(handle.clone());
        if env.storage().persistent().has(&handle_key) {
            Self::bump_persistent_ttl(env, &handle_key);
            return Err(RegistryError::HandleAlreadyTaken);
        }

        let token_key = DataKey::Token(token_id);
        if env.storage().persistent().has(&token_key) {
            Self::bump_persistent_ttl(env, &token_key);
            return Err(RegistryError::TokenAlreadyExists);
        }

        let token = AgentIdentity {
            token_id,
            owner: owner.clone(),
            name,
            handle: handle.clone(),
            agent_uri,
            vault_address,
            agent_signer,
            registered_at,
            updated_at,
            is_active,
        };

        let owner_key = DataKey::TokenOwner(token_id);
        env.storage().persistent().set(&token_key, &token);
        env.storage().persistent().set(&owner_key, &owner);
        env.storage().persistent().set(&handle_key, &token_id);
        Self::bump_persistent_ttl(env, &token_key);
        Self::bump_persistent_ttl(env, &owner_key);
        Self::bump_persistent_ttl(env, &handle_key);

        Self::add_owner_token(env, &owner, token_id);
        Self::add_global_token(env, token_id);
        if is_active {
            Self::add_active_token(env, token_id);
        }

        let balance_key = DataKey::Balance(owner.clone());
        let balance: u32 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&balance_key, &balance.saturating_add(1));
        Self::bump_persistent_ttl(env, &balance_key);

        let total: u64 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &total.saturating_add(1));

        let next: u64 = env.storage().instance().get(&DataKey::NextTokenId).unwrap_or(1);
        if token_id.saturating_add(1) > next {
            env.storage()
                .instance()
                .set(&DataKey::NextTokenId, &token_id.saturating_add(1));
        }

        Self::bump_instance_ttl(env);
        env.events().publish(
            (Symbol::new(env, "identity_minted"), token_id, owner.clone()),
            handle,
        );
        env.events()
            .publish((Symbol::new(env, "mint"), owner, token_id), ());
        Ok(token_id)
    }

    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        let collection_name = String::from_str(&env, DEFAULT_COLLECTION_NAME);
        let collection_symbol = String::from_str(&env, DEFAULT_COLLECTION_SYMBOL);
        let contract_uri = String::from_str(&env, DEFAULT_CONTRACT_URI);
        Self::initialize_with_metadata(
            env,
            admin,
            collection_name,
            collection_symbol,
            contract_uri,
        )
    }

    pub fn __constructor(
        env: Env,
        admin: Address,
        collection_name: String,
        collection_symbol: String,
        contract_uri: String,
    ) {
        if let Err(err) = Self::initialize_with_metadata(
            env.clone(),
            admin,
            collection_name,
            collection_symbol,
            contract_uri,
        ) {
            panic_with_error!(&env, err);
        }
    }

    fn initialize_with_metadata(
        env: Env,
        admin: Address,
        collection_name: String,
        collection_symbol: String,
        contract_uri: String,
    ) -> Result<(), RegistryError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        Self::validate_name(&collection_name)?;
        Self::validate_symbol(&collection_symbol)?;
        Self::validate_contract_uri(&contract_uri)?;

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CollectionName, &collection_name);
        env.storage()
            .instance()
            .set(&DataKey::CollectionSymbol, &collection_symbol);
        env.storage()
            .instance()
            .set(&DataKey::ContractUri, &contract_uri);
        env.storage().instance().set(&DataKey::MigrationOpen, &false);
        env.storage().instance().set(&DataKey::NextTokenId, &1u64);
        env.storage().instance().set(&DataKey::TotalSupply, &0u64);
        env.storage().instance().set(&DataKey::ActiveCount, &0u64);
        Self::bump_instance_ttl(&env);
        Ok(())
    }

    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), RegistryError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Self::bump_instance_ttl(&env);
        Ok(())
    }

    pub fn set_migration_open(env: Env, admin: Address, open: bool) -> Result<(), RegistryError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::MigrationOpen, &open);
        Self::bump_instance_ttl(&env);
        Ok(())
    }

    pub fn migration_open(env: Env) -> bool {
        Self::require_initialized_or_panic(&env);
        Self::is_migration_open(&env)
    }

    pub fn migrate_identity(
        env: Env,
        admin: Address,
        token_id: u64,
        owner: Address,
        name: String,
        handle: String,
        agent_uri: String,
        vault_address: Address,
        agent_signer: Address,
        registered_at: u64,
        updated_at: u64,
        is_active: bool,
    ) -> Result<u64, RegistryError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        if !Self::is_migration_open(&env) {
            return Err(RegistryError::MigrationClosed);
        }
        Self::validate_name(&name)?;
        Self::validate_handle(&handle)?;
        Self::validate_agent_uri(&agent_uri)?;

        Self::mint_identity_with_token_id(
            &env,
            token_id,
            owner,
            name,
            handle,
            agent_uri,
            vault_address,
            agent_signer,
            registered_at,
            updated_at,
            is_active,
        )
    }

    pub fn mint_identity(
        env: Env,
        owner: Address,
        name: String,
        handle: String,
        agent_uri: String,
        vault_address: Address,
        agent_signer: Address,
    ) -> Result<u64, RegistryError> {
        Self::require_initialized(&env)?;
        owner.require_auth();

        Self::validate_name(&name)?;
        Self::validate_handle(&handle)?;
        Self::validate_agent_uri(&agent_uri)?;

        let token_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1);
        let now = env.ledger().timestamp();
        Self::mint_identity_with_token_id(
            &env,
            token_id,
            owner,
            name,
            handle,
            agent_uri,
            vault_address,
            agent_signer,
            now,
            now,
            true,
        )
    }

    // Standard-compatible alias: keeps custom identity payload while exposing `mint`.
    pub fn mint(
        env: Env,
        owner: Address,
        name: String,
        handle: String,
        token_uri: String,
        vault_address: Address,
        agent_signer: Address,
    ) -> Result<u64, RegistryError> {
        Self::mint_identity(
            env,
            owner,
            name,
            handle,
            token_uri,
            vault_address,
            agent_signer,
        )
    }

    pub fn owner_of(env: Env, token_id: u64) -> Result<Address, RegistryError> {
        Self::require_initialized(&env)?;
        let key = DataKey::TokenOwner(token_id);
        let owner = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::TokenNotFound)?;
        Self::bump_persistent_ttl(&env, &key);
        Ok(owner)
    }

    pub fn balance_of(env: Env, owner: Address) -> u64 {
        Self::require_initialized_or_panic(&env);
        let key = DataKey::Balance(owner);
        if env.storage().persistent().has(&key) {
            Self::bump_persistent_ttl(&env, &key);
        }
        let balance: u32 = env.storage().persistent().get(&key).unwrap_or(0);
        balance as u64
    }

    pub fn balance(env: Env, owner: Address) -> u32 {
        Self::require_initialized_or_panic(&env);
        let key = DataKey::Balance(owner);
        if env.storage().persistent().has(&key) {
            Self::bump_persistent_ttl(&env, &key);
        }
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn get_agent(env: Env, token_id: u64) -> Result<AgentIdentity, RegistryError> {
        Self::require_initialized(&env)?;
        Self::get_token(&env, token_id)
    }

    // Standard-compatible alias.
    pub fn token(env: Env, token_id: u64) -> Result<AgentIdentity, RegistryError> {
        Self::get_agent(env, token_id)
    }

    pub fn get_agent_by_handle(env: Env, handle: String) -> Result<AgentIdentity, RegistryError> {
        Self::require_initialized(&env)?;
        let key = DataKey::HandleToken(handle);
        let token_id: u64 = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::TokenNotFound)?;
        Self::bump_persistent_ttl(&env, &key);
        Self::get_token(&env, token_id)
    }

    pub fn token_uri(env: Env, token_id: u64) -> Result<String, RegistryError> {
        Self::require_initialized(&env)?;
        let token = Self::get_token(&env, token_id)?;
        Ok(token.agent_uri)
    }

    pub fn name(env: Env) -> String {
        Self::require_initialized_or_panic(&env);
        let value = env
            .storage()
            .instance()
            .get(&DataKey::CollectionName)
            .unwrap_or(String::from_str(&env, DEFAULT_COLLECTION_NAME));
        Self::bump_instance_ttl(&env);
        value
    }

    pub fn symbol(env: Env) -> String {
        Self::require_initialized_or_panic(&env);
        let value = env
            .storage()
            .instance()
            .get(&DataKey::CollectionSymbol)
            .unwrap_or(String::from_str(&env, DEFAULT_COLLECTION_SYMBOL));
        Self::bump_instance_ttl(&env);
        value
    }

    pub fn contract_uri(env: Env) -> String {
        Self::require_initialized_or_panic(&env);
        let value = env
            .storage()
            .instance()
            .get(&DataKey::ContractUri)
            .unwrap_or(String::from_str(&env, DEFAULT_CONTRACT_URI));
        Self::bump_instance_ttl(&env);
        value
    }

    pub fn set_collection_metadata(
        env: Env,
        admin: Address,
        collection_name: String,
        collection_symbol: String,
        contract_uri: String,
    ) -> Result<(), RegistryError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        Self::validate_name(&collection_name)?;
        Self::validate_symbol(&collection_symbol)?;
        Self::validate_contract_uri(&contract_uri)?;

        env.storage()
            .instance()
            .set(&DataKey::CollectionName, &collection_name);
        env.storage()
            .instance()
            .set(&DataKey::CollectionSymbol, &collection_symbol);
        env.storage()
            .instance()
            .set(&DataKey::ContractUri, &contract_uri);
        Self::bump_instance_ttl(&env);
        Ok(())
    }

    pub fn approve(
        env: Env,
        approver: Address,
        approved: Address,
        token_id: u64,
        live_until_ledger: u32,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        approver.require_auth();
        Self::validate_live_until_ledger(&env, live_until_ledger)?;

        let token_owner = Self::owner_of(env.clone(), token_id)?;
        if token_owner == approved {
            return Err(RegistryError::ApprovalToCurrentOwner);
        }

        let can_approve = approver == token_owner
            || Self::is_operator_approved(&env, &token_owner, &approver);
        if !can_approve {
            return Err(RegistryError::ApproveCallerNotOwnerNorOperator);
        }

        let approval_key = DataKey::TokenApproval(token_id);
        if live_until_ledger == 0 {
            env.storage().temporary().remove(&approval_key);
        } else {
            let data = ApprovalData {
                approved: approved.clone(),
                live_until_ledger,
            };
            env.storage().temporary().set(&approval_key, &data);
        }

        env.events().publish(
            (
                Symbol::new(&env, "approval"),
                token_owner.clone(),
                approved.clone(),
                token_id,
            ),
            live_until_ledger,
        );
        env.events()
            .publish((Symbol::new(&env, "approve"), token_owner, approved, token_id), ());
        Ok(())
    }

    pub fn get_approved(env: Env, token_id: u64) -> Option<Address> {
        Self::require_initialized_or_panic(&env);

        let token_key = DataKey::Token(token_id);
        if !env.storage().persistent().has(&token_key) {
            return None;
        }
        Self::bump_persistent_ttl(&env, &token_key);

        let approval_key = DataKey::TokenApproval(token_id);
        let approved = env
            .storage()
            .temporary()
            .get::<DataKey, ApprovalData>(&approval_key)
            .and_then(|data| {
                if data.live_until_ledger >= env.ledger().sequence() {
                    Some(data.approved)
                } else {
                    None
                }
            });
        if approved.is_none() {
            env.storage().temporary().remove(&approval_key);
        }
        approved
    }

    // Standard-compatible alias.
    pub fn get_approval(env: Env, token_id: u64) -> Option<Address> {
        Self::get_approved(env, token_id)
    }

    pub fn approve_for_all(
        env: Env,
        owner: Address,
        operator: Address,
        live_until_ledger: u32,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        owner.require_auth();
        Self::validate_live_until_ledger(&env, live_until_ledger)?;

        let key = DataKey::OperatorApproval(owner.clone(), operator.clone());
        if live_until_ledger == 0 {
            env.storage().temporary().remove(&key);
        } else {
            env.storage().temporary().set(&key, &live_until_ledger);
        }

        env.events().publish(
            (
                Symbol::new(&env, "approval_for_all"),
                owner.clone(),
                operator.clone(),
            ),
            live_until_ledger,
        );
        env.events().publish(
            (Symbol::new(&env, "approve_for_all"), owner, operator),
            live_until_ledger,
        );
        Ok(())
    }

    pub fn set_approval_for_all(
        env: Env,
        owner: Address,
        operator: Address,
        approved: bool,
    ) -> Result<(), RegistryError> {
        let live_until_ledger = if approved { u32::MAX } else { 0 };
        Self::approve_for_all(env, owner, operator, live_until_ledger)
    }

    pub fn is_approved_for_all(env: Env, owner: Address, operator: Address) -> bool {
        Self::require_initialized_or_panic(&env);
        Self::is_operator_approved(&env, &owner, &operator)
    }

    // Standard-compatible alias.
    pub fn is_approval_for_all(env: Env, owner: Address, operator: Address) -> bool {
        Self::is_approved_for_all(env, owner, operator)
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: u64,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        from.require_auth();
        Self::transfer_core(&env, &from, &to, token_id)
    }

    pub fn transfer_from(
        env: Env,
        caller: Address,
        from: Address,
        to: Address,
        token_id: u64,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();

        let token = Self::get_token(&env, token_id)?;
        let token_owner = token.owner.clone();

        if token_owner != from {
            return Err(RegistryError::NotTokenOwner);
        }
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token_owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }

        Self::transfer_core(&env, &from, &to, token_id)
    }

    // Standard-compatible alias.
    pub fn safe_transfer_from(
        env: Env,
        caller: Address,
        from: Address,
        to: Address,
        token_id: u64,
    ) -> Result<(), RegistryError> {
        Self::transfer_from(env, caller, from, to, token_id)
    }

    pub fn burn(env: Env, caller: Address, token_id: u64) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();

        let token = Self::get_token(&env, token_id)?;
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token.owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }
        Self::burn_core(&env, token_id)
    }

    pub fn set_agent_uri(
        env: Env,
        caller: Address,
        token_id: u64,
        new_uri: String,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();
        Self::validate_agent_uri(&new_uri)?;

        let mut token = Self::get_token(&env, token_id)?;
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token.owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }

        token.agent_uri = new_uri;
        token.updated_at = env.ledger().timestamp();

        let token_key = DataKey::Token(token_id);
        env.storage().persistent().set(&token_key, &token);
        Self::bump_persistent_ttl(&env, &token_key);

        env.events()
            .publish((Symbol::new(&env, "uri_updated"), token_id), ());
        Ok(())
    }

    pub fn set_handle(
        env: Env,
        caller: Address,
        token_id: u64,
        new_handle: String,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();
        Self::validate_handle(&new_handle)?;

        let mut token = Self::get_token(&env, token_id)?;
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token.owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }

        if token.handle == new_handle {
            return Ok(());
        }

        let new_handle_key = DataKey::HandleToken(new_handle.clone());
        if env.storage().persistent().has(&new_handle_key) {
            Self::bump_persistent_ttl(&env, &new_handle_key);
            return Err(RegistryError::HandleAlreadyTaken);
        }

        let old_handle = token.handle.clone();
        env.storage()
            .persistent()
            .remove(&DataKey::HandleToken(old_handle.clone()));
        env.storage()
            .persistent()
            .set(&new_handle_key, &token_id);
        Self::bump_persistent_ttl(&env, &new_handle_key);

        token.handle = new_handle.clone();
        token.updated_at = env.ledger().timestamp();
        let token_key = DataKey::Token(token_id);
        env.storage().persistent().set(&token_key, &token);
        Self::bump_persistent_ttl(&env, &token_key);

        env.events().publish(
            (Symbol::new(&env, "handle_updated"), token_id),
            (old_handle, new_handle),
        );
        Ok(())
    }

    pub fn set_metadata(
        env: Env,
        caller: Address,
        token_id: u64,
        key: String,
        value: String,
    ) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();
        Self::validate_metadata(&key, &value)?;

        let token = Self::get_token(&env, token_id)?;
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token.owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }

        let metadata_key = DataKey::Metadata(token_id, key);
        env.storage().persistent().set(&metadata_key, &value);
        Self::bump_persistent_ttl(&env, &metadata_key);
        Ok(())
    }

    pub fn get_metadata(env: Env, token_id: u64, key: String) -> Option<String> {
        Self::require_initialized_or_panic(&env);
        let token_key = DataKey::Token(token_id);
        if !env.storage().persistent().has(&token_key) {
            return None;
        }
        Self::bump_persistent_ttl(&env, &token_key);

        let metadata_key = DataKey::Metadata(token_id, key);
        let value = env.storage().persistent().get(&metadata_key);
        if value.is_some() {
            Self::bump_persistent_ttl(&env, &metadata_key);
        }
        value
    }

    pub fn deactivate(env: Env, caller: Address, token_id: u64) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();

        let mut token = Self::get_token(&env, token_id)?;
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token.owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }
        if !token.is_active {
            return Err(RegistryError::AlreadyInactive);
        }

        token.is_active = false;
        token.updated_at = env.ledger().timestamp();
        let token_key = DataKey::Token(token_id);
        env.storage().persistent().set(&token_key, &token);
        Self::bump_persistent_ttl(&env, &token_key);

        Self::remove_active_token(&env, token_id);

        env.events().publish(
            (Symbol::new(&env, "status_changed"), token_id),
            false,
        );
        Ok(())
    }

    pub fn reactivate(env: Env, caller: Address, token_id: u64) -> Result<(), RegistryError> {
        Self::require_initialized(&env)?;
        caller.require_auth();

        let mut token = Self::get_token(&env, token_id)?;
        if !Self::is_approved_or_owner(&env, &caller, token_id, &token.owner) {
            return Err(RegistryError::NotApprovedOrOwner);
        }
        if token.is_active {
            return Err(RegistryError::AlreadyActive);
        }

        token.is_active = true;
        token.updated_at = env.ledger().timestamp();
        let token_key = DataKey::Token(token_id);
        env.storage().persistent().set(&token_key, &token);
        Self::bump_persistent_ttl(&env, &token_key);

        Self::add_active_token(&env, token_id);

        env.events()
            .publish((Symbol::new(&env, "status_changed"), token_id), true);
        Ok(())
    }

    /// Lists active agents using a bounded active index.
    /// `start_token_id` behaves as a 1-based cursor into active agents.
    pub fn list_agents(env: Env, start_token_id: u64, limit: u32) -> Vec<AgentIdentity> {
        Self::require_initialized_or_panic(&env);
        if limit == 0 {
            return Vec::new(&env);
        }

        let active_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(0);
        if active_count == 0 {
            return Vec::new(&env);
        }

        let start_index = if start_token_id <= 1 {
            0
        } else {
            start_token_id.saturating_sub(1)
        };
        if start_index >= active_count {
            return Vec::new(&env);
        }

        let limit_u64 = limit as u64;
        let end = core::cmp::min(start_index.saturating_add(limit_u64), active_count);
        let mut out = Vec::new(&env);
        let mut i = start_index;
        while i < end {
            let active_slot_key = DataKey::ActiveToken(i);
            if let Some(token_id) = env
                .storage()
                .persistent()
                .get::<DataKey, u64>(&active_slot_key)
            {
                Self::bump_persistent_ttl(&env, &active_slot_key);
                if let Ok(token) = Self::get_token(&env, token_id) {
                    out.push_back(token);
                }
            }
            i = i.saturating_add(1);
        }
        out
    }

    pub fn list_tokens_by_owner(env: Env, owner: Address, offset: u32, limit: u32) -> Vec<u64> {
        Self::require_initialized_or_panic(&env);
        if limit == 0 {
            return Vec::new(&env);
        }

        let count_key = DataKey::OwnerTokenCount(owner.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        if count == 0 || offset >= count {
            return Vec::new(&env);
        }
        Self::bump_persistent_ttl(&env, &count_key);

        let end = core::cmp::min(offset.saturating_add(limit), count);
        let mut out = Vec::new(&env);
        let mut i = offset;
        while i < end {
            let key = DataKey::OwnerToken(owner.clone(), i);
            if let Some(token_id) = env.storage().persistent().get::<DataKey, u64>(&key) {
                Self::bump_persistent_ttl(&env, &key);
                out.push_back(token_id);
            }
            i = i.saturating_add(1);
        }
        out
    }

    // Enumerable standard helper.
    pub fn token_of_owner_by_index(env: Env, owner: Address, index: u32) -> Option<u64> {
        Self::require_initialized_or_panic(&env);
        let key = DataKey::OwnerToken(owner, index);
        let token_id = env.storage().persistent().get::<DataKey, u64>(&key);
        if token_id.is_some() {
            Self::bump_persistent_ttl(&env, &key);
        }
        token_id
    }

    pub fn get_owner_token_id(env: Env, owner: Address, index: u32) -> u32 {
        let Some(token_id) = Self::token_of_owner_by_index(env.clone(), owner, index) else {
            panic_with_error!(&env, RegistryError::TokenNotFound);
        };
        Self::token_id_u32(&env, token_id)
    }

    // Enumerable standard helper.
    pub fn token_by_index(env: Env, index: u64) -> Option<u64> {
        Self::require_initialized_or_panic(&env);
        let key = DataKey::GlobalToken(index);
        let token_id = env.storage().persistent().get::<DataKey, u64>(&key);
        if token_id.is_some() {
            Self::bump_persistent_ttl(&env, &key);
        }
        token_id
    }

    pub fn get_token_id(env: Env, index: u32) -> u32 {
        let Some(token_id) = Self::token_by_index(env.clone(), index as u64) else {
            panic_with_error!(&env, RegistryError::TokenNotFound);
        };
        Self::token_id_u32(&env, token_id)
    }

    pub fn is_handle_available(env: Env, handle: String) -> bool {
        Self::require_initialized_or_panic(&env);
        let key = DataKey::HandleToken(handle);
        let available = !env.storage().persistent().has(&key);
        if !available {
            Self::bump_persistent_ttl(&env, &key);
        }
        available
    }

    pub fn exists(env: Env, token_id: u64) -> bool {
        Self::require_initialized_or_panic(&env);
        let key = DataKey::Token(token_id);
        let exists = env.storage().persistent().has(&key);
        if exists {
            Self::bump_persistent_ttl(&env, &key);
        }
        exists
    }

    pub fn total_supply(env: Env) -> u64 {
        Self::require_initialized_or_panic(&env);
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn active_count(env: Env) -> u64 {
        Self::require_initialized_or_panic(&env);
        env.storage()
            .instance()
            .get(&DataKey::ActiveCount)
            .unwrap_or(0)
    }

    pub fn next_token_id(env: Env) -> u64 {
        Self::require_initialized_or_panic(&env);
        env.storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1)
    }
}

#[cfg(test)]
mod test;
