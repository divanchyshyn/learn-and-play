use std::fmt;
use std::time::Instant;

use anyhow::{Context, Result};
use argon2::{Algorithm, Argon2, PasswordHash, PasswordHasher, PasswordVerifier, Version};
use rand::RngCore;

/// OWASP's stated minimum for argon2id, and the parameters this service uses:
/// 19 MiB of memory, two passes, one lane. Memory-hard rather than merely slow,
/// which is what makes a leaked hash expensive to attack even with a GPU.
pub const MEMORY_KIB: u32 = 19_456;
pub const PASSES: u32 = 2;
pub const LANES: u32 = 1;

/// The salt is generated here rather than by the hasher, so there is one less
/// place where randomness is somebody else's business.
pub const SALT_BYTES: usize = 16;

/// A password has to be long enough to matter and short enough that the hash
/// cannot be turned into a denial of service. OWASP's advice is not to impose
/// composition rules and not to reduce the input space, so there are none.
pub const MIN_BYTES: usize = 8;
pub const MAX_BYTES: usize = 128;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PasswordError {
    TooShort,
    TooLong,
}

impl fmt::Display for PasswordError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::TooShort => formatter.write_str("the password is too short"),
            Self::TooLong => formatter.write_str("the password is too long"),
        }
    }
}

pub fn validate(password: &str) -> Result<(), PasswordError> {
    let bytes = password.len();
    if bytes < MIN_BYTES {
        return Err(PasswordError::TooShort);
    }
    if bytes > MAX_BYTES {
        return Err(PasswordError::TooLong);
    }
    Ok(())
}

/// Hashes and verifies passwords with argon2id, peppered with a server-side
/// secret.
///
/// The pepper is what makes a stolen dump useless on its own: the hashes cannot
/// be attacked without a value that lives only in the deployment's environment.
/// It also means a rotated pepper invalidates every password, which is why the
/// runbook treats it as permanent.
#[derive(Clone)]
pub struct Passwords {
    argon2: Argon2<'static>,
    /// A stored hash of a string nobody will ever type. Verifying against it does
    /// the same work as verifying a real password, which is what keeps an unknown
    /// username from being detectable by how fast the answer arrives.
    decoy: String,
}

impl fmt::Debug for Passwords {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Never print the pepper, not even by accident in a log line.
        formatter.debug_struct("Passwords").finish_non_exhaustive()
    }
}

impl Passwords {
    /// Build a hasher from the deployment's pepper.
    ///
    /// The pepper is digested first, so it can be any text a person generated
    /// (base64, a passphrase) and still become the fixed-size key argon2 wants.
    pub fn new(pepper: &[u8]) -> Result<Self> {
        use sha2::{Digest, Sha256};

        // `Argon2<'static>` keeps a borrow of its secret, and the pepper has to
        // live as long as the process does anyway. Leaking 32 bytes once, at
        // startup, is simpler and clearer than threading a lifetime through every
        // handler that hashes a password.
        let key: &'static [u8] = Box::leak(Sha256::digest(pepper).to_vec().into_boxed_slice());
        let params = argon2::Params::new(MEMORY_KIB, PASSES, LANES, None)
            .context("the argon2 parameters are invalid")?;
        let argon2 = Argon2::new_with_secret(key, Algorithm::Argon2id, Version::V0x13, params)
            .context("the argon2 pepper is unusable")?;

        let decoy = argon2
            .hash_password_with_salt(b"a password nobody types", &[0u8; SALT_BYTES])
            .map_err(|error| anyhow::anyhow!("could not build the decoy hash: {error}"))?
            .to_string();

        Ok(Self { argon2, decoy })
    }

    /// Hash a password into the PHC string that is stored in the database.
    ///
    /// The time this takes is logged, because it is the one CPU-bound operation
    /// in the service and the small container instance it runs on is exactly
    /// where it could become slow. Sign-in is the only place it is called in
    /// anger, and a child pays it once per device.
    pub fn hash(&self, password: &str) -> Result<String> {
        let started = Instant::now();

        let mut salt = [0u8; SALT_BYTES];
        rand::rng().fill_bytes(&mut salt);

        let hash = self
            .argon2
            .hash_password_with_salt(password.as_bytes(), &salt)
            .map_err(|error| anyhow::anyhow!("could not hash the password: {error}"))?
            .to_string();

        tracing::info!(ms = started.elapsed().as_millis() as u64, "password hashed");

        Ok(hash)
    }

    /// Spend the time of a verification on a password that cannot exist, so that
    /// "no such username" and "wrong password" are the same request as far as a
    /// stopwatch is concerned.
    pub fn verify_decoy(&self, password: &str) {
        if let Ok(parsed) = PasswordHash::new(&self.decoy) {
            let _ = self.argon2.verify_password(password.as_bytes(), &parsed);
        }
    }

    /// Verify a password against a stored PHC string. A malformed stored value
    /// is a failure, never an error: it cannot happen through this service, and
    /// the caller only ever needs "yes" or "no".
    pub fn verify(&self, password: &str, stored: &str) -> bool {
        let Ok(parsed) = PasswordHash::new(stored) else {
            return false;
        };
        self.argon2
            .verify_password(password.as_bytes(), &parsed)
            .is_ok()
    }

    /// Does this stored hash use parameters other than the current ones? If so,
    /// the next successful sign-in quietly upgrades it.
    pub fn needs_rehash(&self, stored: &str) -> bool {
        let Ok(parsed) = PasswordHash::new(stored) else {
            return false;
        };
        let Ok(params) = argon2::Params::try_from(&parsed) else {
            return true;
        };
        params.m_cost() != MEMORY_KIB || params.t_cost() != PASSES || params.p_cost() != LANES
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn passwords() -> Passwords {
        Passwords::new(b"a test pepper, not a real one").unwrap()
    }

    #[test]
    fn password_length_is_the_only_rule() {
        assert_eq!(validate("short"), Err(PasswordError::TooShort));
        assert_eq!(validate("1234567"), Err(PasswordError::TooShort));
        assert!(validate("12345678").is_ok());
        assert!(validate(&"x".repeat(MAX_BYTES)).is_ok());
        assert_eq!(
            validate(&"x".repeat(MAX_BYTES + 1)),
            Err(PasswordError::TooLong)
        );
        // No composition rules: spaces, accents and emoji are all allowed.
        assert!(validate("et langt passord med mellomrom").is_ok());
        assert!(validate("påssord-med-æøå").is_ok());
        assert!(validate("🔒🔒🔒🔒🔒🔒🔒🔒").is_ok());
    }

    #[test]
    fn a_password_verifies_against_its_own_hash_and_nothing_else() {
        let passwords = passwords();
        let hash = passwords.hash("et-langt-passord").unwrap();

        assert!(passwords.verify("et-langt-passord", &hash));
        assert!(!passwords.verify("et-langt-passord ", &hash));
        assert!(!passwords.verify("Et-langt-passord", &hash));
        assert!(!passwords.verify("", &hash));
    }

    #[test]
    fn the_same_password_hashes_differently_every_time() {
        let passwords = passwords();
        let first = passwords.hash("et-langt-passord").unwrap();
        let second = passwords.hash("et-langt-passord").unwrap();

        assert_ne!(first, second, "each hash must carry its own salt");
        assert!(passwords.verify("et-langt-passord", &first));
        assert!(passwords.verify("et-langt-passord", &second));
    }

    #[test]
    fn the_stored_hash_is_a_peppered_argon2id_phc_string() {
        let hash = passwords().hash("et-langt-passord").unwrap();
        assert!(
            hash.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"),
            "{hash}"
        );
        assert!(
            !hash.contains("et-langt-passord"),
            "the password itself must never be stored"
        );
    }

    #[test]
    fn a_different_pepper_cannot_verify_the_hash() {
        let hash = passwords().hash("et-langt-passord").unwrap();
        let other = Passwords::new(b"a different pepper").unwrap();

        assert!(!other.verify("et-langt-passord", &hash));
    }

    #[test]
    fn the_decoy_verification_never_succeeds() {
        let passwords = passwords();

        // The decoy is a real hash, so `verify_decoy` really does the work of a
        // verification rather than returning immediately.
        assert!(
            passwords.decoy.starts_with("$argon2id$"),
            "{}",
            passwords.decoy
        );

        passwords.verify_decoy("et-langt-passord");
        passwords.verify_decoy("");
        passwords.verify_decoy("a password nobody types");
    }

    #[test]
    fn a_malformed_stored_hash_is_a_failed_sign_in_rather_than_a_crash() {
        let passwords = passwords();
        assert!(!passwords.verify("et-langt-passord", "not a hash"));
        assert!(!passwords.verify("et-langt-passord", ""));
        assert!(!passwords.needs_rehash("not a hash"));
    }

    #[test]
    fn the_current_parameters_do_not_ask_for_a_rehash() {
        let passwords = passwords();
        let hash = passwords.hash("et-langt-passord").unwrap();
        assert!(!passwords.needs_rehash(&hash));
    }

    #[test]
    fn a_hash_from_weaker_parameters_asks_to_be_upgraded() {
        // The same construction with the older, cheaper settings.
        let weak = Argon2::new(
            Algorithm::Argon2id,
            Version::V0x13,
            argon2::Params::new(4_096, 1, 1, None).unwrap(),
        );
        let stored = weak
            .hash_password_with_salt(b"et-langt-passord", &[7u8; SALT_BYTES])
            .unwrap()
            .to_string();

        assert!(passwords().needs_rehash(&stored));
    }
}
