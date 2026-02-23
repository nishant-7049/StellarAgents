#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_register_and_get() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let vault = Address::generate(&env);
    let signer = Address::generate(&env);

    let reg_id = env.register(AgentRegistry, ());
    let reg = AgentRegistryClient::new(&env, &reg_id);
    reg.initialize(&admin);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "Yield Optimizer"),
        &String::from_str(
            &env,
            r#"{"capabilities":["yield"],"pricing":{"amount":"100000"}}"#,
        ),
        &vault,
        &signer,
    );
    assert_eq!(id, 1);
    assert_eq!(reg.agent_count(), 1);

    let agent = reg.get_agent(&1u32);
    assert_eq!(agent.owner, owner);
    assert!(agent.is_active);
}

#[test]
fn test_deactivate() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let reg_id = env.register(AgentRegistry, ());
    let reg = AgentRegistryClient::new(&env, &reg_id);
    reg.initialize(&admin);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "Agent"),
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
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let reg_id = env.register(AgentRegistry, ());
    let reg = AgentRegistryClient::new(&env, &reg_id);
    reg.initialize(&admin);

    let id = reg.register(
        &owner,
        &String::from_str(&env, "A"),
        &String::from_str(&env, "{}"),
        &Address::generate(&env),
        &Address::generate(&env),
    );
    reg.set_metadata(
        &owner,
        &id,
        &String::from_str(&env, "model"),
        &String::from_str(&env, "claude-sonnet-4-5-20250929"),
    );

    let val = reg.get_metadata(&id, &String::from_str(&env, "model"));
    assert_eq!(
        val,
        Some(String::from_str(&env, "claude-sonnet-4-5-20250929"))
    );
}
