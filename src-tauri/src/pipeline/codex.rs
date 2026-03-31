use crate::snapshot::ServiceSnapshot;
use crate::state::UserPreferences;
use super::{ProviderFetcher, RefreshKind};

/// Fetcher implementation for the Codex provider.
///
/// Delegates to [`crate::codex::load_snapshot()`] which encapsulates
/// the full Codex CLI strategy chain (env var -> JSON-RPC).
pub struct CodexFetcher;

impl ProviderFetcher for CodexFetcher {
    fn provider_id(&self) -> &str {
        "codex"
    }

    fn strategy_name(&self) -> &str {
        "cli"
    }

    fn fetch(&self, _preferences: &UserPreferences, _refresh_kind: RefreshKind) -> ServiceSnapshot {
        crate::codex::load_snapshot()
    }

    // seed_stale_cache and clear_access_pause use default no-ops.
    // Codex has no stale cache or pause state.
}
