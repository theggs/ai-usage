use crate::pipeline::{ProviderFetcher, RefreshKind};
use crate::snapshot::{ServiceSnapshot, SnapshotStatus};
use crate::state::UserPreferences;

pub struct GlmFetcher;

impl ProviderFetcher for GlmFetcher {
    fn provider_id(&self) -> &str {
        "glm-coding"
    }

    fn strategy_name(&self) -> &str {
        "api"
    }

    fn fetch(&self, preferences: &UserPreferences, _refresh_kind: RefreshKind) -> ServiceSnapshot {
        let has_token = std::env::var("ZAI_API_KEY")
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false)
            || std::env::var("ZHIPU_API_KEY")
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false)
            || std::env::var("ZHIPUAI_API_KEY")
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false)
            || preferences
                .provider_tokens
                .get("glm-coding")
                .map(|t| !t.is_empty())
                .unwrap_or(false);

        if !has_token {
            return ServiceSnapshot {
                status: SnapshotStatus::NoCredentials,
                dimensions: vec![],
                source: "glm-api".into(),
            };
        }

        // Real fetch implementation in Plan 02
        ServiceSnapshot {
            status: SnapshotStatus::NoCredentials,
            dimensions: vec![],
            source: "glm-api".into(),
        }
    }
}
