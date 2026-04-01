use crate::pipeline::{ProviderFetcher, RefreshKind};
use crate::snapshot::ServiceSnapshot;
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
        crate::glm::load_snapshot(preferences)
    }
}
