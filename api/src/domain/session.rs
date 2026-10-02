use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::RngCore;
use sha2::{Digest, Sha256};

/// The cookie name. The `__Host-` prefix is enforced by browsers: a cookie with
/// it must be `Secure`, must have `Path=/`, and must not carry a `Domain`, which
/// is exactly the shape this session wants.
pub const COOKIE_NAME: &str = "__Host-lap_sid";

/// 256 bits of operating-system randomness, base64url so it is safe in a cookie.
pub const TOKEN_BYTES: usize = 32;

/// A year, because there is no password reset — the account holds no email
/// address, so it has no way back in and must not ask a child to sign in again:
/// a child should sign in once on a device and then simply play.
pub const SESSION_DAYS: i64 = 365;

/// Mint a session token. The token itself is never stored: only its hash is.
pub fn mint_token() -> String {
    let mut bytes = [0u8; TOKEN_BYTES];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// What goes into the database: a one-way digest, so a dump of `sessions`
/// contains nothing that can be presented as a cookie.
pub fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_token_is_long_enough_to_be_unguessable_and_url_safe() {
        let token = mint_token();
        assert_eq!(token.len(), 43, "32 bytes of base64url is 43 characters");
        assert!(
            token
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "a cookie value may not need escaping: {token}"
        );
    }

    #[test]
    fn tokens_do_not_repeat() {
        let tokens: std::collections::HashSet<String> = (0..64).map(|_| mint_token()).collect();
        assert_eq!(tokens.len(), 64);
    }

    #[test]
    fn the_stored_value_is_a_hash_not_the_token() {
        let token = mint_token();
        let stored = hash_token(&token);

        assert_eq!(stored.len(), 32, "sha256 is 32 bytes");
        assert!(!stored.windows(token.len()).any(|w| w == token.as_bytes()));
        assert_eq!(stored, hash_token(&token), "hashing is deterministic");
        assert_ne!(stored, hash_token(&mint_token()));
    }

    #[test]
    fn the_cookie_name_keeps_the_host_prefix() {
        // The prefix is what makes a browser refuse to accept the cookie without
        // `Secure`, `Path=/` and no `Domain`.
        assert!(COOKIE_NAME.starts_with("__Host-"));
    }
}
