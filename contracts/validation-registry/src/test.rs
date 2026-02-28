#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};
use types::ValidationStatus;

fn setup() -> (Env, ValidationRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(ValidationRegistry, ());
    let client = ValidationRegistryClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, client)
}

#[test]
fn test_request_and_complete() {
    let (env, client) = setup();
    let validator = Address::generate(&env);

    let req_id = client.request_validation(
        &1u32,
        &validator,
        &String::from_str(&env, "https://example.com/test"),
        &String::from_str(&env, "sha256:abc123"),
    );
    assert_eq!(req_id, 1);

    client.submit_validation(
        &req_id,
        &validator,
        &true,
        &String::from_str(&env, "ipfs://evidence"),
    );

    let v = client.get_validation(&req_id);
    assert_eq!(v.status, ValidationStatus::Completed);
    assert!(v.success);

    let validations = client.get_validations(&1u32);
    assert_eq!(validations.len(), 1);
}

#[test]
fn test_wrong_validator_rejected() {
    let (env, client) = setup();
    let validator = Address::generate(&env);
    let wrong_validator = Address::generate(&env);

    let req_id = client.request_validation(
        &1u32,
        &validator,
        &String::from_str(&env, "https://example.com/test"),
        &String::from_str(&env, "hash"),
    );

    let result = client.try_submit_validation(
        &req_id,
        &wrong_validator,
        &true,
        &String::from_str(&env, "evidence"),
    );
    assert!(result.is_err());
}

#[test]
fn test_double_completion_rejected() {
    let (env, client) = setup();
    let validator = Address::generate(&env);

    let req_id = client.request_validation(
        &1u32,
        &validator,
        &String::from_str(&env, "test"),
        &String::from_str(&env, "hash"),
    );

    client.submit_validation(
        &req_id,
        &validator,
        &true,
        &String::from_str(&env, "evidence"),
    );

    let result = client.try_submit_validation(
        &req_id,
        &validator,
        &false,
        &String::from_str(&env, "evidence2"),
    );
    assert!(result.is_err());
}
