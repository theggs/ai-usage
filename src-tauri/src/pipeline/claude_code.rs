use crate::snapshot::ServiceSnapshot;
use crate::state::{QuotaDimension, UserPreferences};
use super::{ProviderFetcher, RefreshKind};

/// Fetcher implementation for the Claude Code provider.
///
/// Delegates to [`crate::claude_code::load_snapshot()`] which encapsulates
/// the full credential strategy chain (env -> keychain -> file -> API).
pub struct ClaudeCodeFetcher;

impl ProviderFetcher for ClaudeCodeFetcher {
    fn provider_id(&self) -> &str {
        "claude-code"
    }

    fn strategy_name(&self) -> &str {
        "oauth-api"
    }

    fn fetch(&self, preferences: &UserPreferences, refresh_kind: RefreshKind) -> ServiceSnapshot {
        let mapped_kind = match refresh_kind {
            RefreshKind::Automatic => crate::claude_code::RefreshKind::Automatic,
            RefreshKind::Manual => crate::claude_code::RefreshKind::Manual,
        };
        crate::claude_code::load_snapshot(preferences, mapped_kind)
    }

    fn seed_stale_cache(&self, dimensions: Vec<QuotaDimension>) {
        crate::claude_code::seed_stale_cache(dimensions);
    }

    fn clear_access_pause(&self) {
        crate::claude_code::clear_access_pause();
    }
}
