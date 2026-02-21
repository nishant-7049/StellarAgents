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

#[test]
fn test_register_and_get() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "Yield Optimizer"),
        &String::from_str(&env, "stellar-yield-bot"),
        &String::from_str(&env, r#"{"capabilities":["yield"],"pricing":{"amount":"100000"}}"#),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(id, 1);
    assert_eq!(reg.agent_count(), 1);

    let agent = reg.get_agent(&1u32);
    assert_eq!(agent.owner, owner);
    assert_eq!(agent.handle, String::from_str(&env, "stellar-yield-bot"));
    assert!(agent.is_active);
}

#[test]
fn test_get_by_handle() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    reg.register(
        &owner,
        &String::from_str(&env, "DeFi Agent"),
        &String::from_str(&env, "defi-agent"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );

    let agent = reg.get_agent_by_handle(&String::from_str(&env, "defi-agent"));
    assert_eq!(agent.owner, owner);
    assert_eq!(agent.id, 1);
}

#[test]
fn test_handle_uniqueness() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);

    reg.register(
        &owner1,
        &String::from_str(&env, "First"),
        &String::from_str(&env, "my-agent"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );

    // Second owner tries to claim same handle — must fail
    let result = reg.try_register(
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
fn test_handle_availability_check() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    assert!(reg.is_handle_available(&String::from_str(&env, "free-handle")));

    reg.register(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "free-handle"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );

    assert!(!reg.is_handle_available(&String::from_str(&env, "free-handle")));
}

#[test]
fn test_handle_validation_too_short() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let result = reg.try_register(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "ab"), // 2 chars — too short
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::HandleTooShort)));
}

#[test]
fn test_handle_validation_invalid_chars() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let result = reg.try_register(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "My Agent!"), // spaces and uppercase
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::HandleInvalidChars)));
}

#[test]
fn test_handle_no_leading_trailing_hyphen() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let result = reg.try_register(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "-bad-handle"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    assert_eq!(result, Err(Ok(RegistryError::HandleInvalidChars)));
}

#[test]
fn test_deactivate() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "my-defi-bot"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    reg.deactivate(&owner, &id);
    let agent = reg.get_agent(&id);
    assert!(!agent.is_active);
    assert_eq!(reg.agent_count(), 0);
}

#[test]
fn test_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "A"),
        &String::from_str(&env, "meta-agent"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    reg.set_metadata(
        &owner,
        &id,
        &String::from_str(&env, "model"),
        &String::from_str(&env, "llama-3.3-70b-versatile"),
    );

    let val = reg.get_metadata(&id, &String::from_str(&env, "model"));
    assert_eq!(val, Some(String::from_str(&env, "llama-3.3-70b-versatile")));
}

#[test]
fn test_transfer_agent_handle_stays() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, reg_id) = setup(&env);
    let reg = AgentRegistryClient::new(&env, &reg_id);
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "Agent"),
        &String::from_str(&env, "transfer-me"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );

    reg.transfer_agent(&owner, &id, &new_owner);

    let agent = reg.get_agent(&id);
    assert_eq!(agent.owner, new_owner);
    // Handle still resolves to the same agent after transfer
    assert_eq!(
        reg.get_agent_by_handle(&String::from_str(&env, "transfer-me")).owner,
        new_owner
    );
    assert_eq!(reg.get_agent_by_owner(&owner), None);
    assert_eq!(reg.get_agent_by_owner(&new_owner), Some(id));
}
