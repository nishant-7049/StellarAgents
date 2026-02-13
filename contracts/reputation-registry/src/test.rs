#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, ReputationRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(ReputationRegistry, ());
    let client = ReputationRegistryClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, client)
}

#[test]
fn test_post_and_get() {
    let (env, client) = setup();
    let reviewer = Address::generate(&env);

    client.post_feedback(
        &1u32,
        &reviewer,
        &4u32,
        &String::from_str(&env, "quality"),
        &String::from_str(&env, "ipfs://abc"),
        &String::from_str(&env, "txhash123"),
    );

    let feedback = client.get_feedback(&1u32, &0u32, &10u32);
    assert_eq!(feedback.len(), 1);
    let fb = feedback.get(0).unwrap();
    assert_eq!(fb.score, 4);
    assert_eq!(fb.agent_id, 1);
}

#[test]
fn test_summary_calculation() {
    let (env, client) = setup();
    let reviewer1 = Address::generate(&env);
    let reviewer2 = Address::generate(&env);

    client.post_feedback(
        &1u32,
        &reviewer1,
        &5u32,
        &String::from_str(&env, "quality"),
        &String::from_str(&env, ""),
        &String::from_str(&env, ""),
    );
    client.post_feedback(
        &1u32,
        &reviewer2,
        &3u32,
        &String::from_str(&env, "speed"),
        &String::from_str(&env, ""),
        &String::from_str(&env, ""),
    );

    let summary = client.get_feedback_summary(&1u32);
    assert_eq!(summary.total_reviews, 2);
    // (5+3)*100/2 = 400
    assert_eq!(summary.avg_score_x100, 400);
    assert_eq!(summary.total_score, 8);
}

#[test]
fn test_invalid_score_rejected() {
    let (env, client) = setup();
    let reviewer = Address::generate(&env);

    let result = client.try_post_feedback(
        &1u32,
        &reviewer,
        &0u32,
        &String::from_str(&env, "quality"),
        &String::from_str(&env, ""),
        &String::from_str(&env, ""),
    );
    assert!(result.is_err());

    let result = client.try_post_feedback(
        &1u32,
        &reviewer,
        &6u32,
        &String::from_str(&env, "quality"),
        &String::from_str(&env, ""),
        &String::from_str(&env, ""),
    );
    assert!(result.is_err());
}
