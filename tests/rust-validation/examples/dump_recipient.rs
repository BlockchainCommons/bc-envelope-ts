//! Prints a reference-produced `hasRecipient` envelope for the `recipientDecode`
//! vector (follow-up B1): `"Hello."` encrypted with key 07…07 and sealed to the
//! PrivateKeyBase from seed ff00…; the port must decrypt it.
//!
//!   cargo run --release --example dump_recipient
use bc_components::*;
use bc_envelope::prelude::*;

fn main() {
    bc_envelope::register_tags();
    let key = SymmetricKey::from_data([7u8; 32]);
    let seed: Vec<u8> = (0..32).map(|i| if i % 2 == 0 { 0xff } else { 0x00 }).collect();
    let bob = PrivateKeyBase::from_data(seed);
    let recipient = bob.encapsulation_private_key().public_key().unwrap();
    let env = Envelope::new("Hello.").encrypt_subject(&key).unwrap().add_recipient(&recipient, &key);
    println!("{}", env.ur_string());
    let back = env.decrypt_subject_to_recipient(&bob).unwrap();
    println!("{}", back.format());
}
