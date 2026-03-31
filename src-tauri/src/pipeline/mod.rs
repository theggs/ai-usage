use crate::snapshot::ServiceSnapshot;
use crate::state::{QuotaDimension, UserPreferences};
use std::sync::OnceLock;

pub mod claude_code;
pub mod codex;

/// Describes when a refresh was triggered.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefreshKind {
    /// Periodic automatic refresh (e.g. timer-driven).
    Automatic,
    /// User-initiated manual refresh.
    Manual,
}

/// Unified fetch interface for all provider integrations.
///
/// Each implementation represents one **strategy** for fetching quota data
/// from a provider. A provider may have multiple strategies registered
/// (e.g., OAuth API, web scraping, local probe); the pipeline tries them
/// in registration order until one returns `Fresh`.
///
/// Implementations are thin delegation wrappers that call the existing
/// provider-specific modules (e.g. `codex::load_snapshot()`).
pub trait ProviderFetcher: Send + Sync {
    /// Stable provider identifier (matches registry key, e.g. "codex").
    fn provider_id(&self) -> &str;

    /// Human-readable strategy name (e.g. "oauth-api", "web-scrape", "cli").
    /// Used for logging and future UI display of active fetch strategy.
    fn strategy_name(&self) -> &str;

    /// Fetch the current quota snapshot for this provider.
    fn fetch(&self, preferences: &UserPreferences, refresh_kind: RefreshKind) -> ServiceSnapshot;

    /// Seed the stale cache with previously-known dimensions.
    /// Default is no-op for providers without stale cache support.
    fn seed_stale_cache(&self, _dimensions: Vec<QuotaDimension>) {}

    /// Clear any access-pause state (e.g. after rate-limit cooldown).
    /// Default is no-op for providers without pause state.
    fn clear_access_pause(&self) {}
}

/// Returns a static list of all registered fetchers.
fn fetchers() -> &'static Vec<Box<dyn ProviderFetcher>> {
    static FETCHERS: OnceLock<Vec<Box<dyn ProviderFetcher>>> = OnceLock::new();
    FETCHERS.get_or_init(|| {
        vec![
            Box::new(codex::CodexFetcher),
            Box::new(claude_code::ClaudeCodeFetcher),
        ]
    })
}

/// Look up the primary (first registered) fetcher by provider ID.
/// Used for provider-level operations like `seed_stale_cache` and `clear_access_pause`.
pub fn get_fetcher(provider_id: &str) -> Option<&'static dyn ProviderFetcher> {
    fetchers()
        .iter()
        .find(|f| f.provider_id() == provider_id)
        .map(|f| f.as_ref())
}

/// Returns all registered strategies for a provider, in priority order.
pub fn get_strategies(provider_id: &str) -> Vec<&'static dyn ProviderFetcher> {
    fetchers()
        .iter()
        .filter(|f| f.provider_id() == provider_id)
        .map(|f| f.as_ref())
        .collect()
}

/// Try each registered strategy for a provider until one returns `Fresh`.
/// Falls back to the last non-fresh result if all strategies fail.
/// Returns `None` only if no strategies are registered for the provider.
pub fn fetch_provider(
    provider_id: &str,
    preferences: &UserPreferences,
    refresh_kind: RefreshKind,
) -> Option<ServiceSnapshot> {
    let strategies = get_strategies(provider_id);
    if strategies.is_empty() {
        return None;
    }
    let mut last_result = None;
    for strategy in &strategies {
        let result = strategy.fetch(preferences, refresh_kind);
        if result.status.is_fresh() {
            return Some(result);
        }
        last_result = Some(result);
    }
    last_result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_fetcher_codex_returns_some() {
        let fetcher = get_fetcher("codex");
        assert!(fetcher.is_some(), "get_fetcher('codex') should return Some");
        assert_eq!(fetcher.unwrap().provider_id(), "codex");
    }

    #[test]
    fn get_fetcher_claude_code_returns_some() {
        let fetcher = get_fetcher("claude-code");
        assert!(fetcher.is_some(), "get_fetcher('claude-code') should return Some");
        assert_eq!(fetcher.unwrap().provider_id(), "claude-code");
    }

    #[test]
    fn get_fetcher_unknown_returns_none() {
        let fetcher = get_fetcher("unknown");
        assert!(fetcher.is_none(), "get_fetcher('unknown') should return None");
    }

    #[test]
    fn fetchers_contains_exactly_two_entries() {
        let all = fetchers();
        assert_eq!(all.len(), 2, "fetchers() should contain exactly 2 entries");
    }

    #[test]
    fn codex_fetcher_provider_id() {
        let fetcher = codex::CodexFetcher;
        assert_eq!(fetcher.provider_id(), "codex");
        assert_eq!(fetcher.strategy_name(), "cli");
    }

    #[test]
    fn claude_code_fetcher_provider_id() {
        let fetcher = claude_code::ClaudeCodeFetcher;
        assert_eq!(fetcher.provider_id(), "claude-code");
        assert_eq!(fetcher.strategy_name(), "oauth-api");
    }

    #[test]
    fn get_strategies_returns_all_for_provider() {
        let strategies = get_strategies("codex");
        assert_eq!(strategies.len(), 1);
        assert_eq!(strategies[0].strategy_name(), "cli");
    }

    #[test]
    fn get_strategies_unknown_returns_empty() {
        let strategies = get_strategies("unknown");
        assert!(strategies.is_empty());
    }
}
