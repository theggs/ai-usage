use crate::pipeline::{ProviderFetcher, RefreshKind};
use crate::snapshot::{ServiceSnapshot, SnapshotStatus};
use crate::state::UserPreferences;

pub struct KimiFetcher;

impl ProviderFetcher for KimiFetcher {
    fn provider_id(&self) -> &str {
        "kimi-code"
    }

    fn strategy_name(&self) -> &str {
        "api"
    }

    fn fetch(&self, preferences: &UserPreferences, _refresh_kind: RefreshKind) -> ServiceSnapshot {
        let has_token = std::env::var("KIMI_API_KEY")
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false)
            || preferences
                .provider_tokens
                .get("kimi-code")
                .map(|t| !t.is_empty())
                .unwrap_or(false);

        if !has_token {
            return ServiceSnapshot {
                status: SnapshotStatus::NoCredentials,
                dimensions: vec![],
                source: "kimi-api".into(),
            };
        }

        // Real fetch implementation in Plan 02
        ServiceSnapshot {
            status: SnapshotStatus::NoCredentials,
            dimensions: vec![],
            source: "kimi-api".into(),
        }
    }
}
