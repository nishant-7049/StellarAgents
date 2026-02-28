#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup(env: &Env) -> (Address, Address) {
    let admin = Address::generate(env);
    let reg_id = env.register(AgentRegistry, ());
    let reg = AgentRegistryClient::new(env, &reg_id);
    reg.initialize(&admin);
    (admin, reg_id)
}

fn mint_default(
    env: &Env,
    reg: &AgentRegistryClient,
    owner: &Address,
    handle: &str,
) -> u64 {
    reg.mint_identity(
        owner,
        &String::from_str(env, "Yield Bot"),
        &String::from_str(env, handle),
        &String::from_str(env, r#"{"capabilities":["yield"]}"#),
        &Address::generate(env),
        &Address::generate(env),
    )
}

#[test]
fn test_not_initialized_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let reg_id = env.register(AgentRegistry, ());
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let result = reg.try_mint_identity(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "init-check"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::NotInitialized)));
}

#[test]
fn test_mint_and_get() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "stellar-yield-bot");
    assert_eq!(token_id, 1);
    assert_eq!(reg.balance_of(&owner), 1);
    assert_eq!(reg.owner_of(&token_id), owner);
    assert_eq!(reg.total_supply(), 1);
    assert_eq!(reg.active_count(), 1);

    let agent = reg.get_agent(&token_id);
    assert_eq!(agent.token_id, token_id);
    assert_eq!(agent.handle, String::from_str(&env, "stellar-yield-bot"));
    assert!(agent.is_active);
}

#[test]
fn test_handle_uniqueness() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);

    mint_default(&env, &reg, &owner1, "my-agent");
    let result = reg.try_mint_identity(
        &owner2,
        &String::from_str(&env, "Second"),
        &String::from_str(&env, "my-agent"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::HandleAlreadyTaken)));
}

#[test]
fn test_multiple_identities_per_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let id1 = mint_default(&env, &reg, &owner, "bot-one");
    let id2 = mint_default(&env, &reg, &owner, "bot-two");

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(reg.balance_of(&owner), 2);

    let ids = reg.list_tokens_by_owner(&owner, &0u32, &10u32);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0), Some(1));
    assert_eq!(ids.get(1), Some(2));
}

#[test]
fn test_owner_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "xfer-owner");
    reg.transfer_from(&owner, &owner, &recipient, &token_id);

    assert_eq!(reg.owner_of(&token_id), recipient);
    assert_eq!(reg.balance_of(&owner), 0);
    assert_eq!(reg.balance_of(&recipient), 1);

    let owner_tokens = reg.list_tokens_by_owner(&owner, &0u32, &10u32);
    assert_eq!(owner_tokens.len(), 0);
    let recipient_tokens = reg.list_tokens_by_owner(&recipient, &0u32, &10u32);
    assert_eq!(recipient_tokens.len(), 1);
    assert_eq!(recipient_tokens.get(0), Some(token_id));
}

#[test]
fn test_approve_then_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let operator = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "xfer-approved");
    reg.approve(&owner, &operator, &token_id);
    assert_eq!(reg.get_approved(&token_id), Some(operator.clone()));

    reg.transfer_from(&operator, &owner, &recipient, &token_id);
    assert_eq!(reg.owner_of(&token_id), recipient);
    assert_eq!(reg.get_approved(&token_id), None);
}

#[test]
fn test_operator_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let operator = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "xfer-operator");
    reg.set_approval_for_all(&owner, &operator, &true);
    assert!(reg.is_approved_for_all(&owner, &operator));

    reg.transfer_from(&operator, &owner, &recipient, &token_id);
    assert_eq!(reg.owner_of(&token_id), recipient);
}

#[test]
fn test_set_handle_releases_old_handle() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "old-handle");
    reg.set_handle(&owner, &token_id, &String::from_str(&env, "new-handle"));

    assert!(reg.is_handle_available(&String::from_str(&env, "old-handle")));
    assert!(!reg.is_handle_available(&String::from_str(&env, "new-handle")));

    let by_handle = reg.get_agent_by_handle(&String::from_str(&env, "new-handle"));
    assert_eq!(by_handle.token_id, token_id);
}

#[test]
fn test_deactivate_and_reactivate() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "active-bot");
    reg.deactivate(&owner, &token_id);
    assert_eq!(reg.active_count(), 0);

    let result = reg.try_deactivate(&owner, &token_id);
    assert_eq!(result, Err(Ok(RegistryError::AlreadyInactive)));

    reg.reactivate(&owner, &token_id);
    assert_eq!(reg.active_count(), 1);
    let listed = reg.list_agents(&1u64, &10u32);
    assert_eq!(listed.len(), 1);
}

#[test]
fn test_owner_token_pagination() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    mint_default(&env, &reg, &owner, "pag-1");
    mint_default(&env, &reg, &owner, "pag-2");
    mint_default(&env, &reg, &owner, "pag-3");

    let page = reg.list_tokens_by_owner(&owner, &1u32, &1u32);
    assert_eq!(page.len(), 1);
    assert_eq!(page.get(0), Some(2));
}

#[test]
fn test_owner_index_swap_remove_after_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);

    let id1 = mint_default(&env, &reg, &owner, "swap-a");
    let id2 = mint_default(&env, &reg, &owner, "swap-b");
    assert_eq!(reg.list_tokens_by_owner(&owner, &0u32, &10u32).len(), 2);

    reg.transfer_from(&owner, &owner, &recipient, &id1);

    let owner_tokens = reg.list_tokens_by_owner(&owner, &0u32, &10u32);
    assert_eq!(owner_tokens.len(), 1);
    assert_eq!(owner_tokens.get(0), Some(id2));

    let recipient_tokens = reg.list_tokens_by_owner(&recipient, &0u32, &10u32);
    assert_eq!(recipient_tokens.len(), 1);
    assert_eq!(recipient_tokens.get(0), Some(id1));
}

#[test]
fn test_unauthorized_update_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let stranger = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "private-bot");
    let result = reg.try_set_agent_uri(
        &stranger,
        &token_id,
        &String::from_str(&env, "ipfs://new-uri"),
    );
    assert_eq!(result, Err(Ok(RegistryError::NotApprovedOrOwner)));
}

#[test]
fn test_handle_validation() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let result = reg.try_mint_identity(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "Bad Handle!"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::HandleInvalidChars)));
}

#[test]
fn test_length_limits_enforced() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let long_uri = [b'a'; 2050];
    let result = reg.try_mint_identity(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "long-uri-agent"),
        &String::from_bytes(&env, &long_uri),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::AgentUriTooLong)));

    let token_id = mint_default(&env, &reg, &owner, "meta-limits");
    let long_key = [b'k'; 70];
    let bad_meta = reg.try_set_metadata(
        &owner,
        &token_id,
        &String::from_bytes(&env, &long_key),
        &String::from_str(&env, "value"),
    );
    assert_eq!(bad_meta, Err(Ok(RegistryError::MetadataKeyTooLong)));
}

#[test]
fn test_collection_metadata_defaults_and_admin_update() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let stranger = Address::generate(&env);

    assert_eq!(reg.name(), String::from_str(&env, "Agent Identity"));
    assert_eq!(reg.symbol(), String::from_str(&env, "AGENT"));
    assert_eq!(reg.contract_uri(), String::from_str(&env, "ipfs://agent-registry"));

    let unauthorized = reg.try_set_collection_metadata(
        &stranger,
        &String::from_str(&env, "New Name"),
        &String::from_str(&env, "NAGENT"),
        &String::from_str(&env, "ipfs://new-contract-uri"),
    );
    assert_eq!(unauthorized, Err(Ok(RegistryError::NotAdmin)));

    reg.set_collection_metadata(
        &admin,
        &String::from_str(&env, "Agent Registry"),
        &String::from_str(&env, "AID"),
        &String::from_str(&env, "ipfs://agent-registry-v2"),
    );
    assert_eq!(reg.name(), String::from_str(&env, "Agent Registry"));
    assert_eq!(reg.symbol(), String::from_str(&env, "AID"));
    assert_eq!(
        reg.contract_uri(),
        String::from_str(&env, "ipfs://agent-registry-v2")
    );
}

#[test]
fn test_transfer_method_owner_only() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);
    let stranger = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "transfer-owner-only");
    let bad = reg.try_transfer(&stranger, &recipient, &token_id);
    assert_eq!(bad, Err(Ok(RegistryError::NotTokenOwner)));

    reg.transfer(&owner, &recipient, &token_id);
    assert_eq!(reg.owner_of(&token_id), recipient);
}

#[test]
fn test_burn_reduces_supply_and_clears_ownership() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let token_id = mint_default(&env, &reg, &owner, "burnable-agent");
    assert!(reg.exists(&token_id));
    assert_eq!(reg.total_supply(), 1);
    assert_eq!(reg.active_count(), 1);

    reg.burn(&owner, &token_id);
    assert!(!reg.exists(&token_id));
    assert_eq!(reg.total_supply(), 0);
    assert_eq!(reg.active_count(), 0);
    assert_eq!(reg.balance_of(&owner), 0);

    let owner_of = reg.try_owner_of(&token_id);
    assert_eq!(owner_of, Err(Ok(RegistryError::TokenNotFound)));
}

#[test]
fn test_standard_alias_mint_and_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let token_id = reg.mint(
        &owner,
        &String::from_str(&env, "Alias Bot"),
        &String::from_str(&env, "alias-bot"),
        &String::from_str(&env, r#"{"capabilities":["yield"]}"#),
        &Address::generate(&env),
        &Address::generate(&env),
    );

    let token = reg.token(&token_id);
    assert_eq!(token.token_id, token_id);
    assert_eq!(token.owner, owner);
}

#[test]
fn test_standard_enumerable_views() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let id1 = mint_default(&env, &reg, &owner, "enum-1");
    let id2 = mint_default(&env, &reg, &owner, "enum-2");
    let id3 = mint_default(&env, &reg, &owner, "enum-3");

    assert_eq!(reg.token_by_index(&0u64), Some(id1));
    assert_eq!(reg.token_by_index(&1u64), Some(id2));
    assert_eq!(reg.token_by_index(&2u64), Some(id3));
    assert_eq!(reg.token_of_owner_by_index(&owner, &0u32), Some(id1));
    assert_eq!(reg.token_of_owner_by_index(&owner, &1u32), Some(id2));
    assert_eq!(reg.token_of_owner_by_index(&owner, &2u32), Some(id3));
}

#[test]
fn test_global_enumeration_swap_remove_on_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let id1 = mint_default(&env, &reg, &owner, "glob-1");
    let id2 = mint_default(&env, &reg, &owner, "glob-2");
    let id3 = mint_default(&env, &reg, &owner, "glob-3");
    assert_eq!(reg.total_supply(), 3);

    reg.burn(&owner, &id2);

    assert_eq!(reg.total_supply(), 2);
    let first = reg.token_by_index(&0u64).unwrap();
    let second = reg.token_by_index(&1u64).unwrap();
    assert!(first == id1 || first == id3);
    assert!(second == id1 || second == id3);
    assert_ne!(first, second);
}
