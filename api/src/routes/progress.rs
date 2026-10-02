use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth::CurrentUser;
use crate::error::ApiError;
use crate::state::AppState;
use crate::store;
use crate::sync_keys::{self, MAX_PAYLOAD_BYTES, MAX_RECORDS};

#[derive(Debug, Serialize)]
pub struct Record {
    pub key: String,
    pub payload: String,
    pub revision: i64,
}

impl From<store::progress::Record> for Record {
    fn from(record: store::progress::Record) -> Self {
        Self {
            key: record.key,
            payload: record.payload,
            revision: record.revision,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Progress {
    pub records: Vec<Record>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingRecord {
    pub key: String,
    pub payload: String,
    /// The revision this client last saw: 0 means "I have nothing".
    pub base_revision: i64,
}

#[derive(Debug, Deserialize)]
pub struct Save {
    pub records: Vec<IncomingRecord>,
}

#[derive(Debug, Serialize)]
pub struct Accepted {
    pub key: String,
    pub revision: i64,
}

#[derive(Debug, Serialize)]
pub struct Conflict {
    pub key: String,
    pub payload: String,
    pub revision: i64,
}

#[derive(Debug, Serialize)]
pub struct Saved {
    pub accepted: Vec<Accepted>,
    pub conflicts: Vec<Conflict>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/progress", get(list).put(save))
}

/// Everything this account has saved, in one response. There are three records
/// and they are tiny, so one round trip beats one request per game.
async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Progress>, ApiError> {
    let records = store::progress::all(state.pool()?, user.id).await?;
    Ok(Json(Progress {
        records: records.into_iter().map(Record::from).collect(),
    }))
}

/// Store what the client has, and answer with what it may not overwrite.
async fn save(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<Save>,
) -> Result<Json<Saved>, ApiError> {
    let pool = state.pool()?;

    if body.records.len() > MAX_RECORDS {
        return Err(ApiError::BadRequest("too_many_records"));
    }

    // Validate everything before writing anything: a request that would be
    // refused half way through should not leave half of itself behind.
    for record in &body.records {
        if !sync_keys::is_allowed(&record.key) {
            return Err(ApiError::BadRequest("unknown_record_key"));
        }
        if record.payload.len() > MAX_PAYLOAD_BYTES {
            return Err(ApiError::BadRequest("payload_too_large"));
        }
        if record.base_revision < 0 {
            return Err(ApiError::BadRequest("invalid_revision"));
        }
    }

    let mut accepted = Vec::with_capacity(body.records.len());
    let mut conflicts = Vec::new();

    for record in body.records {
        match store::progress::upsert(
            pool,
            user.id,
            &record.key,
            &record.payload,
            record.base_revision,
        )
        .await?
        {
            Some(revision) => accepted.push(Accepted {
                key: record.key,
                revision,
            }),
            // Not an error: the client named a revision the server does not
            // hold, so it gets the current row back, merges, and tries again.
            None => match store::progress::get(pool, user.id, &record.key).await? {
                Some(current) => conflicts.push(Conflict {
                    key: current.key,
                    payload: current.payload,
                    revision: current.revision,
                }),
                None => {
                    return Err(ApiError::internal(anyhow::anyhow!(
                        "a record disappeared between two statements"
                    )));
                }
            },
        }
    }

    Ok(Json(Saved {
        accepted,
        conflicts,
    }))
}
