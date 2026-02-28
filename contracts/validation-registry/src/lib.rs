#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Vec};

pub mod types;
use types::{DataKey, Validation, ValidationError, ValidationStatus};

#[contract]
pub struct ValidationRegistry;

#[contractimpl]
impl ValidationRegistry {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ValidationError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ValidationError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextRequestId, &1u32);
        Ok(())
    }

    pub fn request_validation(
        env: Env,
        agent_id: u32,
        validator: Address,
        request_uri: String,
        data_hash: String,
    ) -> u32 {
        validator.require_auth();

        let request_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextRequestId)
            .unwrap();

        let validation = Validation {
            request_id,
            agent_id,
            validator: validator.clone(),
            request_uri,
            data_hash,
            status: ValidationStatus::Pending,
            success: false,
            evidence_uri: String::from_str(&env, ""),
            requested_at: env.ledger().timestamp(),
            completed_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Validation(request_id), &validation);

        // Track per-agent validations
        let mut agent_vals: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::AgentValidations(agent_id))
            .unwrap_or(Vec::new(&env));
        agent_vals.push_back(request_id);
        env.storage()
            .persistent()
            .set(&DataKey::AgentValidations(agent_id), &agent_vals);

        env.storage()
            .instance()
            .set(&DataKey::NextRequestId, &(request_id + 1));

        env.events().publish(
            (Symbol::new(&env, "validation_req"),),
            (request_id, agent_id, validator),
        );

        request_id
    }

    pub fn submit_validation(
        env: Env,
        request_id: u32,
        validator: Address,
        success: bool,
        evidence_uri: String,
    ) -> Result<(), ValidationError> {
        validator.require_auth();

        let mut validation: Validation = env
            .storage()
            .persistent()
            .get(&DataKey::Validation(request_id))
            .ok_or(ValidationError::RequestNotFound)?;

        if validation.validator != validator {
            return Err(ValidationError::NotValidator);
        }

        if validation.status != ValidationStatus::Pending {
            return Err(ValidationError::AlreadyCompleted);
        }

        validation.status = if success {
            ValidationStatus::Completed
        } else {
            ValidationStatus::Failed
        };
        validation.success = success;
        validation.evidence_uri = evidence_uri;
        validation.completed_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Validation(request_id), &validation);

        env.events().publish(
            (Symbol::new(&env, "validation_done"),),
            (request_id, validator, success),
        );

        Ok(())
    }

    pub fn get_validations(env: Env, agent_id: u32) -> Vec<Validation> {
        let request_ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::AgentValidations(agent_id))
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        for i in 0..request_ids.len() {
            let rid = request_ids.get(i).unwrap();
            if let Some(v) = env
                .storage()
                .persistent()
                .get::<DataKey, Validation>(&DataKey::Validation(rid))
            {
                result.push_back(v);
            }
        }
        result
    }

    pub fn get_validation(env: Env, request_id: u32) -> Result<Validation, ValidationError> {
        env.storage()
            .persistent()
            .get(&DataKey::Validation(request_id))
            .ok_or(ValidationError::RequestNotFound)
    }
}

#[cfg(test)]
mod test;
