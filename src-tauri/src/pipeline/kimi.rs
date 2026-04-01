use crate::pipeline::{ProviderFetcher, RefreshKind};
use crate::snapshot::ServiceSnapshot;
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
        crate::kimi::load_snapshot(preferences)
    }
}
