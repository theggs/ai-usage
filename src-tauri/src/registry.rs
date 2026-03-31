/// Provider descriptor — the single source of truth for provider metadata.
/// Every provider in the system is registered here. No other module should
/// hardcode service-ID arrays.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderDescriptor {
    pub id: &'static str,
    pub display_name: &'static str,
    pub default_enabled: bool,
    pub dashboard_url: Option<&'static str>,
}

pub const PROVIDERS: &[ProviderDescriptor] = &[
    ProviderDescriptor {
        id: "codex",
        display_name: "Codex",
        default_enabled: true,
        dashboard_url: Some("https://chatgpt.com/admin/usage"),
    },
    ProviderDescriptor {
        id: "claude-code",
        display_name: "Claude Code",
        default_enabled: false,
        dashboard_url: Some("https://console.anthropic.com/settings/usage"),
    },
];

/// Returns all provider IDs in registration order.
pub fn provider_ids() -> Vec<&'static str> {
    PROVIDERS.iter().map(|p| p.id).collect()
}

/// Returns all valid menubar service IDs (provider IDs + "auto").
pub fn menubar_service_ids() -> Vec<&'static str> {
    let mut ids = provider_ids();
    ids.push("auto");
    ids
}

/// Looks up a provider by ID. Returns `None` if not found.
pub fn get_provider(id: &str) -> Option<&'static ProviderDescriptor> {
    PROVIDERS.iter().find(|p| p.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn providers_contains_codex_and_claude_code() {
        let ids: Vec<&str> = PROVIDERS.iter().map(|p| p.id).collect();
        assert_eq!(ids, vec!["codex", "claude-code"]);
    }

    #[test]
    fn get_provider_codex() {
        let p = get_provider("codex").expect("codex should exist");
        assert_eq!(p.display_name, "Codex");
        assert!(p.default_enabled);
    }

    #[test]
    fn get_provider_claude_code() {
        let p = get_provider("claude-code").expect("claude-code should exist");
        assert_eq!(p.display_name, "Claude Code");
        assert!(!p.default_enabled);
    }

    #[test]
    fn get_provider_unknown_returns_none() {
        assert!(get_provider("unknown").is_none());
    }

    #[test]
    fn provider_ids_returns_all() {
        assert_eq!(provider_ids(), vec!["codex", "claude-code"]);
    }

    #[test]
    fn menubar_service_ids_includes_auto() {
        assert_eq!(menubar_service_ids(), vec!["codex", "claude-code", "auto"]);
    }
}
