#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Vec};

pub mod types;
use types::{DataKey, Feedback, FeedbackSummary, ReputationError};

#[contract]
pub struct ReputationRegistry;

#[contractimpl]
impl ReputationRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ReputationError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ReputationError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn post_feedback(
        env: Env,
        agent_id: u32,
        reviewer: Address,
        score: u32,
        category: String,
        data_uri: String,
        payment_proof_hash: String,
    ) -> Result<(), ReputationError> {
        reviewer.require_auth();

        if score < 1 || score > 5 {
            return Err(ReputationError::InvalidScore);
        }

        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::FeedbackCount(agent_id))
            .unwrap_or(0);

        let feedback = Feedback {
            agent_id,
            reviewer: reviewer.clone(),
            score,
            category,
            data_uri,
            payment_proof_hash,
            timestamp: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Feedback(agent_id, count), &feedback);
        env.storage()
            .persistent()
            .set(&DataKey::FeedbackCount(agent_id), &(count + 1));

        // Update summary
        let mut summary: FeedbackSummary = env
            .storage()
            .persistent()
            .get(&DataKey::Summary(agent_id))
            .unwrap_or(FeedbackSummary {
                total_reviews: 0,
                avg_score_x100: 0,
                category_counts: 0,
                total_score: 0,
            });

        summary.total_score += score;
        summary.total_reviews += 1;
        summary.avg_score_x100 = (summary.total_score * 100) / summary.total_reviews;
        summary.category_counts += 1;

        env.storage()
            .persistent()
            .set(&DataKey::Summary(agent_id), &summary);

        env.events().publish(
            (Symbol::new(&env, "feedback_posted"),),
            (agent_id, reviewer, score),
        );

        Ok(())
    }

    pub fn get_feedback(env: Env, agent_id: u32, offset: u32, limit: u32) -> Vec<Feedback> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::FeedbackCount(agent_id))
            .unwrap_or(0);

        let mut result = Vec::new(&env);
        let mut i = offset;
        let end = core::cmp::min(offset + limit, count);
        while i < end {
            if let Some(fb) = env
                .storage()
                .persistent()
                .get::<DataKey, Feedback>(&DataKey::Feedback(agent_id, i))
            {
                result.push_back(fb);
            }
            i += 1;
        }
        result
    }

    pub fn get_feedback_summary(env: Env, agent_id: u32) -> FeedbackSummary {
        env.storage()
            .persistent()
            .get(&DataKey::Summary(agent_id))
            .unwrap_or(FeedbackSummary {
                total_reviews: 0,
                avg_score_x100: 0,
                category_counts: 0,
                total_score: 0,
            })
    }
}

#[cfg(test)]
mod test;
