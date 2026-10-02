use anyhow::{Context, Result, bail};

/// What the process should do. `serve` is the default and the container's entry
/// point; `migrate` is a one-shot command used by the deploy workflows, so a
/// migration is applied deliberately rather than as a surprise at boot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    Serve,
    Migrate,
}

/// Everything the service needs from its environment. Values are read once at
/// startup: a missing `DATABASE_URL` is **not** an error, because the service
/// has to boot (and answer `/api/health`) before the database exists.
#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub database_url: Option<String>,
    pub public_origin: Option<String>,
    /// The test environment sets this so search engines leave it alone.
    pub noindex: bool,
    pub command: Command,
}

pub const DEFAULT_PORT: u16 = 8080;

impl Config {
    pub fn from_env() -> Result<Self> {
        Self::from_pairs(std::env::vars())
    }

    /// Split out from [`Config::from_env`] so a test can drive the parsing
    /// without touching the process environment (which tests share).
    pub fn from_pairs<I, K, V>(pairs: I) -> Result<Self>
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        let mut port = DEFAULT_PORT;
        let mut database_url = None;
        let mut public_origin = None;
        let mut noindex = false;

        for (key, value) in pairs {
            let value = value.into();
            let value = value.trim().to_owned();
            if value.is_empty() {
                continue;
            }
            match key.into().as_str() {
                "PORT" => {
                    port = value
                        .parse()
                        .with_context(|| format!("PORT must be a number, got `{value}`"))?;
                }
                "DATABASE_URL" => database_url = Some(value),
                "PUBLIC_ORIGIN" => public_origin = Some(value.trim_end_matches('/').to_owned()),
                "NOINDEX" => noindex = truthy(&value),
                _ => {}
            }
        }

        Ok(Self {
            port,
            database_url,
            public_origin,
            noindex,
            command: Command::Serve,
        })
    }
}

/// The handful of spellings a person might reasonably write for "on".
fn truthy(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

/// Reads the one optional argument this binary takes. An unknown argument is a
/// hard error: silently ignoring a typo would send the container into `serve`
/// when the operator meant `migrate`, or the other way round.
pub fn parse_command(args: &[String]) -> Result<Command> {
    match args.first().map(String::as_str) {
        None | Some("serve") => Ok(Command::Serve),
        Some("migrate") => Ok(Command::Migrate),
        Some(other) => bail!("unknown command `{other}`; expected `serve` or `migrate`"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_a_serving_process_on_the_container_port() {
        let config = Config::from_pairs(Vec::<(String, String)>::new()).unwrap();
        assert_eq!(config.port, DEFAULT_PORT);
        assert!(config.database_url.is_none());
        assert!(config.public_origin.is_none());
        assert!(!config.noindex);
        assert_eq!(config.command, Command::Serve);
    }

    #[test]
    fn reads_every_value_it_understands() {
        let config = Config::from_pairs([
            ("PORT", "9000"),
            ("DATABASE_URL", "postgres://user:pw@host/db?sslmode=require"),
            ("PUBLIC_ORIGIN", "https://test.play2learn.divanchyshyn.com/"),
            ("NOINDEX", "1"),
            ("SOMETHING_ELSE", "ignored"),
        ])
        .unwrap();

        assert_eq!(config.port, 9000);
        assert_eq!(
            config.database_url.as_deref(),
            Some("postgres://user:pw@host/db?sslmode=require")
        );
        // A trailing slash would produce `//api/...` in anything built from it.
        assert_eq!(
            config.public_origin.as_deref(),
            Some("https://test.play2learn.divanchyshyn.com")
        );
        assert!(config.noindex);
    }

    #[test]
    fn empty_values_read_as_not_set() {
        let config = Config::from_pairs([("DATABASE_URL", "  "), ("NOINDEX", "")]).unwrap();
        assert!(config.database_url.is_none());
        assert!(!config.noindex);
    }

    #[test]
    fn a_bad_port_is_refused_rather_than_defaulted() {
        let error = Config::from_pairs([("PORT", "http")]).unwrap_err();
        assert!(error.to_string().contains("PORT"), "{error}");
    }

    #[test]
    fn noindex_accepts_the_obvious_spellings() {
        for value in ["1", "true", "TRUE", "yes", "on"] {
            assert!(
                Config::from_pairs([("NOINDEX", value)]).unwrap().noindex,
                "`{value}` should mean on"
            );
        }
        for value in ["0", "false", "no", "off", "maybe"] {
            assert!(
                !Config::from_pairs([("NOINDEX", value)]).unwrap().noindex,
                "`{value}` should mean off"
            );
        }
    }

    #[test]
    fn the_command_is_serve_unless_asked_otherwise() {
        assert_eq!(parse_command(&[]).unwrap(), Command::Serve);
        assert_eq!(
            parse_command(&["serve".to_owned()]).unwrap(),
            Command::Serve
        );
        assert_eq!(
            parse_command(&["migrate".to_owned()]).unwrap(),
            Command::Migrate
        );
        let error = parse_command(&["migarte".to_owned()]).unwrap_err();
        assert!(error.to_string().contains("migarte"), "{error}");
        assert!(error.to_string().contains("migrate"), "{error}");
    }
}
