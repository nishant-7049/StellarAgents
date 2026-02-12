#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, Bytes, BytesN, Env, FromVal,
    IntoVal, Symbol, Val, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FactoryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    UserAlreadyHasVault = 3,
}

#[contracttype]
pub enum DataKey {
    VaultWasmHash,
    UserVault(Address),
    VaultCount,
    Admin,
    UsdcToken,
}

#[contract]
pub struct VaultFactory;

#[contractimpl]
impl VaultFactory {
    pub fn initialize(
        env: Env,
        admin: Address,
        vault_wasm_hash: BytesN<32>,
        usdc_token: Address,
    ) -> Result<(), FactoryError> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(FactoryError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::VaultWasmHash, &vault_wasm_hash);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::VaultCount, &0u32);
        Ok(())
    }

    pub fn create_vault(env: Env, owner: Address) -> Result<Address, FactoryError> {
        owner.require_auth();
        if env
            .storage()
            .persistent()
            .has(&DataKey::UserVault(owner.clone()))
        {
            return Err(FactoryError::UserAlreadyHasVault);
        }

        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::VaultWasmHash)
            .ok_or(FactoryError::NotInitialized)?;
        let usdc_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::UsdcToken)
            .ok_or(FactoryError::NotInitialized)?;

        // Create deterministic salt from owner address
        let owner_val: Val = owner.clone().into_val(&env);
        let owner_bytes: Bytes = Bytes::from_val(&env, &owner_val);
        let salt = env.crypto().sha256(&owner_bytes);

        let vault_addr: Address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, ());

        let init_args: Vec<Val> = Vec::from_array(
            &env,
            [
                owner.clone().into_val(&env),
                usdc_token.into_val(&env),
                env.current_contract_address().into_val(&env),
            ],
        );
        env.invoke_contract::<()>(&vault_addr, &Symbol::new(&env, "initialize"), init_args);

        env.storage()
            .persistent()
            .set(&DataKey::UserVault(owner.clone()), &vault_addr);
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::VaultCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::VaultCount, &(count + 1));

        env.events().publish(
            (Symbol::new(&env, "vault_created"),),
            (owner, vault_addr.clone()),
        );
        Ok(vault_addr)
    }

    pub fn get_vault(env: Env, owner: Address) -> Option<Address> {
        env.storage().persistent().get(&DataKey::UserVault(owner))
    }

    pub fn has_vault(env: Env, owner: Address) -> bool {
        env.storage().persistent().has(&DataKey::UserVault(owner))
    }

    pub fn vault_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::VaultCount)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
