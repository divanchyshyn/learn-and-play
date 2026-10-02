use chrono::{DateTime, Duration, Utc};

/// How long a quiet period has to be before a counter starts over.
pub const WINDOW_MINUTES: i64 = 15;

/// Failures from one address before it is told to wait. Generous: a family
/// sharing a tablet, or a child mistyping, must not be locked out of their own
/// game.
pub const MAX_IP_FAILURES: i32 = 20;

/// Failures against one username before it is told to wait. Tighter, because a
/// targeted guess is the thing worth slowing down.
pub const MAX_USER_FAILURES: i32 = 8;

/// The first block, and the ceiling it doubles up to.
pub const BLOCK_MINUTES: i64 = 5;
pub const MAX_BLOCK_MINUTES: i64 = 60;

/// A stored counter, as it comes out of `auth_attempts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Attempts {
    pub window_start: DateTime<Utc>,
    pub failures: i32,
    pub blocked_until: Option<DateTime<Utc>>,
}

impl Attempts {
    pub fn fresh(now: DateTime<Utc>) -> Self {
        Self {
            window_start: now,
            failures: 0,
            blocked_until: None,
        }
    }

    /// Has the quiet window passed, so this counter no longer counts?
    pub fn expired(&self, now: DateTime<Utc>) -> bool {
        now - self.window_start > Duration::minutes(WINDOW_MINUTES)
    }

    pub fn is_blocked(&self, now: DateTime<Utc>) -> bool {
        self.blocked_until.is_some_and(|until| until > now)
    }
}

/// What a new failure does to a counter. Pure, so the arithmetic can be tested
/// without a database or a clock.
pub fn record_failure(previous: Option<Attempts>, limit: i32, now: DateTime<Utc>) -> Attempts {
    let failures = match previous {
        Some(state) if !state.expired(now) => state.failures + 1,
        // A window that has passed, or no counter at all, starts again at one.
        _ => 1,
    };

    let blocked_until = if failures >= limit {
        Some(now + block_for(failures, limit))
    } else {
        None
    };

    Attempts {
        window_start: match previous {
            Some(state) if !state.expired(now) => state.window_start,
            _ => now,
        },
        failures,
        blocked_until,
    }
}

/// The block doubles with every failure past the limit, up to an hour. A
/// lockout that never ends would be worse than the guessing it prevents: a
/// child who has forgotten a password has nothing else to fall back on.
pub fn block_for(failures: i32, limit: i32) -> Duration {
    let steps = (failures - limit).clamp(0, 6) as u32;
    let minutes = (BLOCK_MINUTES * 2_i64.pow(steps)).min(MAX_BLOCK_MINUTES);
    Duration::minutes(minutes)
}

/// The counter a client address is counted under.
pub fn ip_key(address: &str) -> String {
    format!("ip:{address}")
}

/// The counter a username is counted under, case-insensitively (usernames are
/// unique that way, so `Kim` and `kim` are one account and one counter).
pub fn user_key(username: &str) -> String {
    format!("user:{}", username.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(minute: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_700_000_000 + minute * 60, 0).unwrap()
    }

    #[test]
    fn the_first_failure_starts_a_window() {
        let state = record_failure(None, MAX_USER_FAILURES, at(0));
        assert_eq!(state.failures, 1);
        assert_eq!(state.window_start, at(0));
        assert!(state.blocked_until.is_none());
    }

    #[test]
    fn failures_accumulate_inside_the_window_and_block_at_the_limit() {
        let mut state = None;
        for expected in 1..MAX_USER_FAILURES {
            state = Some(record_failure(state, MAX_USER_FAILURES, at(0)));
            assert_eq!(state.unwrap().failures, expected);
            assert!(
                !state.unwrap().is_blocked(at(0)),
                "below the limit nothing is blocked"
            );
        }

        let blocked = record_failure(state, MAX_USER_FAILURES, at(0));
        assert_eq!(blocked.failures, MAX_USER_FAILURES);
        assert!(blocked.is_blocked(at(0)));
        assert_eq!(blocked.blocked_until, Some(at(0) + Duration::minutes(5)));
    }

    #[test]
    fn a_quiet_window_starts_the_count_over() {
        let stale = Attempts {
            window_start: at(0),
            failures: MAX_USER_FAILURES - 1,
            blocked_until: None,
        };

        let after = record_failure(Some(stale), MAX_USER_FAILURES, at(WINDOW_MINUTES + 1));
        assert_eq!(after.failures, 1, "the old window no longer counts");
        assert_eq!(after.window_start, at(WINDOW_MINUTES + 1));
        assert!(!after.is_blocked(at(WINDOW_MINUTES + 1)));
    }

    #[test]
    fn a_block_ends_when_its_time_passes() {
        let blocked = Attempts {
            window_start: at(0),
            failures: MAX_USER_FAILURES,
            blocked_until: Some(at(5)),
        };

        assert!(blocked.is_blocked(at(4)));
        assert!(!blocked.is_blocked(at(6)), "the wait is over at its end");
    }

    #[test]
    fn the_block_grows_and_then_stops_growing() {
        assert_eq!(block_for(8, 8), Duration::minutes(5));
        assert_eq!(block_for(9, 8), Duration::minutes(10));
        assert_eq!(block_for(10, 8), Duration::minutes(20));
        assert_eq!(block_for(11, 8), Duration::minutes(40));
        assert_eq!(block_for(12, 8), Duration::minutes(60));
        assert_eq!(
            block_for(50, 8),
            Duration::minutes(60),
            "an hour is the ceiling"
        );
    }

    #[test]
    fn counters_are_keyed_by_address_and_by_name() {
        assert_eq!(ip_key("203.0.113.7"), "ip:203.0.113.7");
        assert_eq!(user_key("Kim"), "user:kim");
        assert_eq!(user_key("kim"), user_key("KIM"));
    }
}
