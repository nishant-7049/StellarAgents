#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let factory_id = env.register(VaultFactory, ());
    let factory = VaultFactoryClient::new(&env, &factory_id);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);
    factory.initialize(&admin, &wasm_hash, &usdc);
    assert_eq!(factory.vault_count(), 0);
}

#[test]
fn test_double_init_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let factory_id = env.register(VaultFactory, ());
    let factory = VaultFactoryClient::new(&env, &factory_id);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);
    factory.initialize(&admin, &wasm_hash, &usdc);
    let result = factory.try_initialize(&admin, &wasm_hash, &usdc);
    assert_eq!(result, Err(Ok(FactoryError::AlreadyInitialized)));
}
