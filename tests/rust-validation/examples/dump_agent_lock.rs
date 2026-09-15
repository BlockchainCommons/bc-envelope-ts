//! Prints a reference-produced SSH-agent-locked envelope for the `agentUnlock`
//! vectors: `"Hello."` wrapped and locked through an in-memory agent holding
//! the Ed25519 identity `alice` derived from the seed 59f2…5948 (the corpus's
//! `SEED_A`), with a fixed salt and subject nonce (the encrypted key's nonce
//! is drawn by the reference); the port must unlock it through its own
//! in-memory agent.
//!
//!   cargo run --release --offline --features agent --example dump_agent_lock
use std::cell::RefCell;
use std::rc::Rc;

use bc_components::{
    EncryptedKey, KeyDerivationParams, Nonce, PrivateKeyBase, SSHAgent, SSHAgentParams, Salt,
    SymmetricKey,
};
use bc_envelope::prelude::*;

struct MemoryAgent { keys: Vec<ssh_key::PrivateKey> }
impl SSHAgent for MemoryAgent {
    fn list_identities(&mut self) -> bc_components::Result<Vec<ssh_key::PublicKey>> { Ok(self.keys.iter().map(|k| k.public_key().clone()).collect()) }
    fn add_identity(&mut self, key: &ssh_key::PrivateKey) -> bc_components::Result<()> { self.keys.push(key.clone()); Ok(()) }
    fn remove_identity(&mut self, key: &ssh_key::PrivateKey) -> bc_components::Result<()> { self.keys.retain(|k| k.comment() != key.comment()); Ok(()) }
    fn remove_all_identities(&mut self) -> bc_components::Result<()> { self.keys.clear(); Ok(()) }
    fn sign(&mut self, key: &ssh_key::PublicKey, data: &[u8]) -> bc_components::Result<ssh_key::Signature> {
        let k = self.keys.iter().find(|k| k.comment() == key.comment()).ok_or_else(|| bc_components::Error::ssh_agent("Identity not found"))?;
        let sig = k.sign("test_namespace", ssh_key::HashAlg::Sha256, data).map_err(|e| bc_components::Error::ssh_agent(format!("Failed to sign data: {}", e)))?;
        Ok(sig.signature().clone())
    }
}

fn main() {
    bc_envelope::register_tags();
    let seed = hex::decode("59f2293a5bce7d4de59e71b4207ac5d2b5c6bfbf4e4a3d2b1f0e9d8c7b6a5948").unwrap();
    let key = PrivateKeyBase::from_data(seed).ssh_signing_private_key(ssh_key::Algorithm::Ed25519, "alice").unwrap();
    let agent: Rc<RefCell<dyn SSHAgent>> = Rc::new(RefCell::new(MemoryAgent { keys: vec![key.to_ssh().unwrap().clone()] }));
    let salt = Salt::from_data(hex::decode("101112131415161718191a1b1c1d1e1f").unwrap());
    let content_key = SymmetricKey::from_data([7u8; 32]);
    let params = SSHAgentParams::new_opt(salt, "", Some(agent.clone()));
    let encrypted_key = EncryptedKey::lock_opt(KeyDerivationParams::SSHAgent(params), b"alice", &content_key).unwrap();
    let nonce = Nonce::from_data([0x0b; 12]);
    let env = Envelope::new("Hello.")
        .wrap()
        .encrypt_subject_opt(&content_key, Some(nonce))
        .unwrap()
        .add_assertion(known_values::HAS_SECRET, encrypted_key);
    println!("{}", hex::encode(env.tagged_cbor_data()));
    println!("{}", env.format());
}
