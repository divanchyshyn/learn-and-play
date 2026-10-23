//! The storage keys that may be synced, read from `api/sync-keys.json`.
//!
//! That file is the single source of truth: the browser's sync registry
//! (`src/shared/syncable.js`) reads the same list, so a key can never be
//! synced from one side while being refused by the other. It lives beside the
//! service — the side that *enforces* the allowlist — and is compiled into the
//! binary with `include_str!`, which also means a missing or malformed list is a
//! build failure rather than a surprise at runtime.

use std::sync::OnceLock;

use serde::Deserialize;

/// `sync-keys.json` sits next to `Cargo.toml`, one directory above `src/`.
const SYNC_KEYS_JSON: &str = include_str!("../sync-keys.json");

/// The largest payload any single record may carry. Every real payload is well
/// under a kilobyte; this is a doorstop, not a design constraint.
pub const MAX_PAYLOAD_BYTES: usize = 65_536;

/// How many records one `PUT` may carry. There are three.
pub const MAX_RECORDS: usize = 20;

#[derive(Debug, Deserialize)]
struct SyncKeys {
    keys: Vec<String>,
}

/// The allowlist, parsed once.
pub fn allowed() -> &'static [String] {
    static KEYS: OnceLock<Vec<String>> = OnceLock::new();
    KEYS.get_or_init(|| {
        let parsed: SyncKeys =
            serde_json::from_str(SYNC_KEYS_JSON).expect("sync-keys.json must be valid JSON");
        assert!(
            !parsed.keys.is_empty(),
            "sync-keys.json must list at least one key"
        );
        parsed.keys
    })
}

/// May this record be stored? Anything not in the list is refused, so a client
/// cannot use the service as free storage.
pub fn is_allowed(key: &str) -> bool {
    allowed().iter().any(|allowed| allowed == key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_shipped_allowlist_is_exactly_the_durable_achievements() {
        assert_eq!(
            allowed(),
            [
                "soundLabyrinth:gallery",
                "wordFishing:journal",
                "cardBattle:album"
            ]
        );
    }

    #[test]
    fn only_allowlisted_keys_are_accepted() {
        assert!(is_allowed("soundLabyrinth:gallery"));
        assert!(is_allowed("cardBattle:album"));

        // A session in progress, a mute setting, or something invented.
        assert!(!is_allowed("soundLabyrinth:game"));
        assert!(!is_allowed("soundLabyrinth:progress"));
        assert!(!is_allowed("wordFishing:trip"));
        assert!(!is_allowed("soundLabyrinth:muted"));
        assert!(!is_allowed(""));
        assert!(!is_allowed("soundLabyrinth:gallery "));
    }

    #[test]
    fn case_matters_and_so_does_the_exact_spelling() {
        assert!(!is_allowed("soundlabyrinth:gallery"));
        assert!(!is_allowed("soundLabyrinth:Gallery"));
    }
}
