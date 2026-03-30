use crate::state::QuotaDimension;
use serde::{Deserialize, Serialize};

/// Exhaustive status enum shared by all services.
/// Serialises as `{ "kind": "VariantName", ...variant_fields }`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind")]
pub enum SnapshotStatus {
    /// Live data successfully fetched.
    Fresh,
    /// CLI binary not found on this device (Codex-specific).
    CliNotFound,
    /// CLI installed but no logged-in session available.
    NotLoggedIn,
    /// No OAuth credentials found (Claude Code-specific).
    NoCredentials,
    /// Session invalid (HTTP 401); attempting automatic recovery.
    SessionRecovery,
    /// HTTP 429; automatic refresh paused.
    RateLimited {
        retry_after_minutes: u32,
    },
    /// HTTP 403; automatic refresh paused.
    AccessDenied,
    /// Proxy configuration is invalid.
    ProxyInvalid,
    /// Transient server/network error.
    TemporarilyUnavailable {
        detail: String,
    },
    /// Connected and authenticated but no quota dimensions returned.
    NoData,
    /// Service query is disabled by user preference.
    Disabled,
}

impl SnapshotStatus {
    /// Returns true when the status represents live, successfully fetched data.
    pub fn is_fresh(&self) -> bool {
        matches!(self, SnapshotStatus::Fresh)
    }
}

/// Unified snapshot returned by both Codex and Claude Code modules.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSnapshot {
    pub status: SnapshotStatus,
    pub dimensions: Vec<QuotaDimension>,
    pub source: String,
}
