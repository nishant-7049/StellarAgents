#![cfg(test)]
use crate::types::VaultError;
use crate::UserVault;
use crate::UserVaultClient;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Symbol, Vec,
};

fn setup() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let service = Address::generate(&env);
    let factory = Address::generate(&env);

    // Deploy mock USDC
    let usdc_admin = Address::generate(&env);
    let usdc_sac = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_addr = usdc_sac.address();
    StellarAssetClient::new(&env, &usdc_addr).mint(&owner, &1000_0000000i128);

    // Deploy vault with constructor args
    let vault_id = env.register(
        UserVault,
        (owner.clone(), usdc_addr.clone(), factory.clone()),
    );

    (env, vault_id, owner, agent, service, usdc_addr)
}

#[test]
fn test_deposit_and_balance() {
    let (env, vault_id, owner, _, _, _usdc) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    assert_eq!(vault.balance(), 100_0000000);
}

#[test]
fn test_withdraw() {
    let (env, vault_id, owner, _, _, usdc) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    vault.withdraw(&owner, &30_0000000);
    assert_eq!(vault.balance(), 70_0000000);
    assert_eq!(TokenClient::new(&env, &usdc).balance(&owner), 930_0000000);
}

#[test]
fn test_withdraw_not_owner_fails() {
    let (env, vault_id, owner, agent, _, _) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    let result = vault.try_withdraw(&agent, &50_0000000);
    assert_eq!(result, Err(Ok(VaultError::NotOwner)));
}

#[test]
fn test_agent_pay_success() {
    let (env, vault_id, owner, agent, service, usdc) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    vault.add_agent(&owner, &agent, &10_0000000, &Vec::new(&env));

    vault.agent_pay(&agent, &service, &100_000, &Symbol::new(&env, "q1"));

    assert_eq!(TokenClient::new(&env, &usdc).balance(&service), 100_000);
    assert_eq!(vault.balance(), 100_0000000 - 100_000);
    assert_eq!(vault.remaining_limit(&agent), 10_0000000 - 100_000);
    assert_eq!(vault.total_spent(), 100_000);
}

#[test]
fn test_agent_exceeds_daily_limit() {
    let (env, vault_id, owner, agent, service, _) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    vault.add_agent(&owner, &agent, &1_0000000, &Vec::new(&env));

    let result = vault.try_agent_pay(&agent, &service, &2_0000000, &Symbol::new(&env, "x"));
    assert_eq!(result, Err(Ok(VaultError::ExceedsDailyLimit)));
}

#[test]
fn test_daily_limit_resets_after_24h() {
    let (env, vault_id, owner, agent, service, _) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    vault.add_agent(&owner, &agent, &1_0000000, &Vec::new(&env));

    vault.agent_pay(&agent, &service, &1_0000000, &Symbol::new(&env, "d1"));
    assert_eq!(vault.remaining_limit(&agent), 0);

    let current = env.ledger().get();
    env.ledger().set(LedgerInfo {
        timestamp: current.timestamp + 86400,
        ..current
    });

    assert_eq!(vault.remaining_limit(&agent), 1_0000000);
    vault.agent_pay(&agent, &service, &500_000, &Symbol::new(&env, "d2"));
}

#[test]
fn test_destination_whitelist() {
    let (env, vault_id, owner, agent, service, _) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);

    let allowed_only = Address::generate(&env);
    let mut allowed_list = Vec::new(&env);
    allowed_list.push_back(allowed_only.clone());

    vault.add_agent(&owner, &agent, &10_0000000, &allowed_list);

    vault.agent_pay(&agent, &allowed_only, &100_000, &Symbol::new(&env, "ok"));

    let result = vault.try_agent_pay(&agent, &service, &100_000, &Symbol::new(&env, "bad"));
    assert_eq!(result, Err(Ok(VaultError::DestinationNotAllowed)));
}

#[test]
fn test_deactivated_agent_cannot_pay() {
    let (env, vault_id, owner, agent, service, _) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);
    vault.add_agent(&owner, &agent, &10_0000000, &Vec::new(&env));
    vault.remove_agent(&owner, &agent);

    let result = vault.try_agent_pay(&agent, &service, &100_000, &Symbol::new(&env, "x"));
    assert_eq!(result, Err(Ok(VaultError::AgentInactive)));
}

#[test]
fn test_multiple_agents() {
    let (env, vault_id, owner, _, service, _) = setup();
    let vault = UserVaultClient::new(&env, &vault_id);
    vault.deposit(&owner, &100_0000000);

    let agent1 = Address::generate(&env);
    let agent2 = Address::generate(&env);

    vault.add_agent(&owner, &agent1, &5_0000000, &Vec::new(&env));
    vault.add_agent(&owner, &agent2, &3_0000000, &Vec::new(&env));

    assert_eq!(vault.agent_count(), 2);

    vault.agent_pay(&agent1, &service, &2_0000000, &Symbol::new(&env, "a1"));
    vault.agent_pay(&agent2, &service, &1_0000000, &Symbol::new(&env, "a2"));

    assert_eq!(vault.remaining_limit(&agent1), 3_0000000);
    assert_eq!(vault.remaining_limit(&agent2), 2_0000000);
}
