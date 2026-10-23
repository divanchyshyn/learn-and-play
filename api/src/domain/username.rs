use std::fmt;

/// Usernames a child should not be able to claim. Small on purpose: there is no
/// impersonation surface here (no profiles, no messages), so this only stops the
/// obvious confusion.
pub const RESERVED: &[&str] = &[
    "admin",
    "administrator",
    "root",
    "system",
    "support",
    "moderator",
    "test",
];

pub const MIN_LENGTH: usize = 3;
pub const MAX_LENGTH: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UsernameError {
    TooShort,
    TooLong,
    MustStartWithLetter,
    InvalidCharacter,
    Reserved,
}

impl fmt::Display for UsernameError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::TooShort => "the username is too short",
            Self::TooLong => "the username is too long",
            Self::MustStartWithLetter => "the username must start with a letter",
            Self::InvalidCharacter => "the username may only use letters, digits, `-` and `_`",
            Self::Reserved => "that username is reserved",
        };
        formatter.write_str(message)
    }
}

/// Trim a typed-in username. Nothing else: a username is stored as typed, and
/// matched without regard to case (the unique index is on `lower(username)`).
pub fn normalize(raw: &str) -> String {
    raw.trim().to_owned()
}

/// Check a username and return it trimmed, ready to be stored.
///
/// Deliberately ASCII-only. It is a login handle typed by a child on a tablet
/// keyboard, and staying inside ASCII removes a whole class of problems
/// (homoglyphs, normalisation forms, widths) from an identifier that is
/// compared for equality.
pub fn validate(raw: &str) -> Result<String, UsernameError> {
    let username = normalize(raw);
    let characters: Vec<char> = username.chars().collect();

    if characters.len() < MIN_LENGTH {
        return Err(UsernameError::TooShort);
    }
    if characters.len() > MAX_LENGTH {
        return Err(UsernameError::TooLong);
    }
    if !characters[0].is_ascii_alphabetic() {
        return Err(UsernameError::MustStartWithLetter);
    }
    if !characters
        .iter()
        .all(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
    {
        return Err(UsernameError::InvalidCharacter);
    }
    if RESERVED.contains(&username.to_ascii_lowercase().as_str()) {
        return Err(UsernameError::Reserved);
    }

    Ok(username)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_names_a_child_would_actually_type() {
        for name in ["kim", "TestKid", "lise-2", "ola_nordmann", "abc123"] {
            assert_eq!(validate(name).unwrap(), name, "`{name}` should be allowed");
        }
    }

    #[test]
    fn trims_what_a_tablet_keyboard_adds() {
        assert_eq!(validate("  kim  ").unwrap(), "kim");
        assert_eq!(validate("\tkim\n").unwrap(), "kim");
    }

    #[test]
    fn refuses_invalid_names_with_a_reason() {
        assert_eq!(validate(""), Err(UsernameError::TooShort));
        assert_eq!(validate("ab"), Err(UsernameError::TooShort));
        assert_eq!(validate("   "), Err(UsernameError::TooShort));
        assert_eq!(
            validate("a".repeat(21).as_str()),
            Err(UsernameError::TooLong)
        );
        assert_eq!(validate("2kim"), Err(UsernameError::MustStartWithLetter));
        assert_eq!(validate("_kim"), Err(UsernameError::MustStartWithLetter));
        assert_eq!(validate("kim ola"), Err(UsernameError::InvalidCharacter));
        assert_eq!(validate("kim!"), Err(UsernameError::InvalidCharacter));
        assert_eq!(validate("Bjørn"), Err(UsernameError::InvalidCharacter));
    }

    #[test]
    fn refuses_reserved_names_whatever_the_case() {
        for name in ["admin", "Admin", "ADMIN", "root", "Support"] {
            assert_eq!(
                validate(name),
                Err(UsernameError::Reserved),
                "`{name}` should be reserved"
            );
        }
        // A name that merely contains a reserved word is fine.
        assert!(validate("admin2").is_ok());
    }

    #[test]
    fn the_boundaries_are_inclusive() {
        let shortest = "abc";
        let longest = "a".repeat(MAX_LENGTH);
        assert!(validate(shortest).is_ok());
        assert!(validate(&longest).is_ok());
        assert!(validate(&"a".repeat(MAX_LENGTH + 1)).is_err());
    }
}
