use crate::state::{PanelPlaceholderItem, UserPreferences};
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

fn items_for_menubar_service(
    preferences: &UserPreferences,
    items: &[PanelPlaceholderItem],
) -> Vec<PanelPlaceholderItem> {
    items
        .iter()
        .filter(|item| item.service_id == preferences.menubar_service)
        .cloned()
        .collect()
}

fn all_dimensions(items: &[PanelPlaceholderItem]) -> Vec<crate::state::QuotaDimension> {
    items
        .iter()
        .flat_map(|item| item.quota_dimensions.clone())
        .collect::<Vec<_>>()
}

fn sort_by_remaining_percent(
    dimensions: Vec<crate::state::QuotaDimension>,
) -> Vec<crate::state::QuotaDimension> {
    let mut sorted = dimensions
        .into_iter()
        .filter(|dimension| dimension.remaining_percent.is_some())
        .collect::<Vec<_>>();
    sorted.sort_by_key(|dimension| dimension.remaining_percent.unwrap_or(101));
    sorted
}

fn matches_5h(label: &str) -> bool {
    let normalized = label.to_ascii_lowercase();
    normalized.contains("5h")
}

fn matches_week(label: &str) -> bool {
    let normalized = label.to_ascii_lowercase();
    normalized.contains("week") || normalized.contains("7d")
}

fn infer_window_minutes(label: &str) -> u64 {
    let normalized = label.to_ascii_lowercase();
    if normalized.contains("5h") {
        return 300;
    }
    if normalized.contains("week") || normalized.contains("7d") {
        return 10_080;
    }

    if let Some(index) = normalized.find('h') {
        if let Some(value) = normalized[..index]
            .chars()
            .rev()
            .take_while(|ch| ch.is_ascii_digit())
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
            .parse::<u64>()
            .ok()
        {
            return value * 60;
        }
    }

    if let Some(index) = normalized.find('d') {
        if let Some(value) = normalized[..index]
            .chars()
            .rev()
            .take_while(|ch| ch.is_ascii_digit())
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
            .parse::<u64>()
            .ok()
        {
            return value * 1_440;
        }
    }

    if let Some(index) = normalized.find('m') {
        if let Some(value) = normalized[..index]
            .chars()
            .rev()
            .take_while(|ch| ch.is_ascii_digit())
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
            .parse::<u64>()
            .ok()
        {
            return value;
        }
    }

    u64::MAX
}

fn sort_by_window_duration(
    dimensions: Vec<crate::state::QuotaDimension>,
) -> Vec<crate::state::QuotaDimension> {
    let mut sorted = dimensions
        .into_iter()
        .filter(|dimension| dimension.remaining_percent.is_some())
        .collect::<Vec<_>>();
    sorted.sort_by_key(|dimension| infer_window_minutes(&dimension.label));
    sorted
}

fn to_summary_value(dimension: &crate::state::QuotaDimension) -> String {
    dimension
        .remaining_percent
        .map(|percent| format!("{percent}%"))
        .unwrap_or_else(|| dimension.remaining_absolute.clone())
}

pub fn format_summary(summary_mode: &str, items: &[PanelPlaceholderItem]) -> Option<String> {
    let dimensions = all_dimensions(items);
    let sorted = sort_by_remaining_percent(dimensions.clone());

    match summary_mode {
        "icon-only" => None,
        "lowest-remaining" => sorted.first().map(to_summary_value),
        "window-5h" => sort_by_remaining_percent(
            dimensions
                .iter()
                .filter(|dimension| matches_5h(&dimension.label))
                .cloned()
                .collect::<Vec<_>>(),
        )
        .first()
        .or_else(|| sorted.first())
        .map(to_summary_value),
        "window-week" => sort_by_remaining_percent(
            dimensions
                .iter()
                .filter(|dimension| matches_week(&dimension.label))
                .cloned()
                .collect::<Vec<_>>(),
        )
        .first()
        .or_else(|| sorted.first())
        .map(to_summary_value),
        _ => {
            let ordered = sort_by_window_duration(dimensions);
            if ordered.is_empty() {
                None
            } else {
                Some(
                    ordered
                        .iter()
                        .map(to_summary_value)
                        .collect::<Vec<_>>()
                        .join(" / "),
                )
            }
        }
    }
}

pub fn apply_display_mode(
    app: &AppHandle,
    preferences: &UserPreferences,
    items: &[PanelPlaceholderItem],
) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let filtered = items_for_menubar_service(preferences, items);
        let summary = format_summary(&preferences.tray_summary_mode, &filtered);
        let tooltip = summary
            .clone()
            .map(|value| format!("AIUsage · {value}"))
            .unwrap_or_else(|| "AIUsage".to_string());

        #[cfg(target_os = "macos")]
        match summary.as_deref() {
            Some(text) => {
                let _ = tray.set_title(Some(text));
            }
            None => {
                let _ = tray.set_title::<&str>(None);
            }
        }

        #[cfg(not(target_os = "macos"))]
        let _ = tray.set_title::<&str>(None);

        let _ = tray.set_tooltip(Some(tooltip));
    }
}

pub fn initialize_tray(
    app: &AppHandle,
    preferences: &UserPreferences,
    items: &[PanelPlaceholderItem],
) {
    if app.tray_by_id("main-tray").is_some() {
        apply_display_mode(app, preferences, items);
        return;
    }

    let mut builder = TrayIconBuilder::with_id("main-tray").tooltip("AIUsage");
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let filtered = items_for_menubar_service(preferences, items);
    let summary = format_summary(&preferences.tray_summary_mode, &filtered);
    if let Some(text) = summary.clone() {
        builder = builder.title(text);
    }

    let _ = builder
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray: &tauri::tray::TrayIcon<Wry>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app);

    apply_display_mode(app, preferences, items);
}

pub fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        if visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

pub fn should_hide_on_focus_change(is_focused: bool) -> bool {
    !is_focused
}

#[cfg(test)]
mod tests {
    use super::{format_summary, items_for_menubar_service, should_hide_on_focus_change};
    use crate::state::{PanelPlaceholderItem, QuotaDimension};

    fn item(percent: u8) -> PanelPlaceholderItem {
        PanelPlaceholderItem {
            service_id: "service".into(),
            service_name: "Service".into(),
            account_label: None,
            icon_key: "icon".into(),
            quota_dimensions: vec![QuotaDimension {
                label: "Window".into(),
                remaining_percent: Some(percent),
                remaining_absolute: format!("{percent}%"),
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_refreshed_at: "0".into(),
        }
    }

    fn item_with_label(label: &str, percent: u8) -> PanelPlaceholderItem {
        PanelPlaceholderItem {
            service_id: "service".into(),
            service_name: "Service".into(),
            account_label: None,
            icon_key: "icon".into(),
            quota_dimensions: vec![QuotaDimension {
                label: label.into(),
                remaining_percent: Some(percent),
                remaining_absolute: format!("{percent}%"),
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_refreshed_at: "0".into(),
        }
    }

    #[test]
    fn formats_icon_only_summary() {
        assert_eq!(format_summary("icon-only", &[item(64)]), None);
    }

    #[test]
    fn formats_single_dimension_summary() {
        assert_eq!(
            format_summary("lowest-remaining", &[item(64)]),
            Some("64%".into())
        );
    }

    #[test]
    fn formats_multi_dimension_summary() {
        assert_eq!(
            format_summary(
                "multi-dimension",
                &[item_with_label("codex / week", 48), item_with_label("codex / 5h", 64)]
            ),
            Some("64% / 48%".into())
        );
    }

    #[test]
    fn formats_window_specific_summaries() {
        let items = [
            item_with_label("codex / 5h", 52),
            item_with_label("codex / week", 6),
        ];

        assert_eq!(format_summary("window-5h", &items), Some("52%".into()));
        assert_eq!(format_summary("window-week", &items), Some("6%".into()));
    }

    #[test]
    fn hides_when_focus_is_lost() {
        assert!(should_hide_on_focus_change(false));
        assert!(!should_hide_on_focus_change(true));
    }

    fn item_for_service(service_id: &str, label: &str, percent: u8) -> PanelPlaceholderItem {
        PanelPlaceholderItem {
            service_id: service_id.into(),
            service_name: service_id.into(),
            account_label: None,
            icon_key: service_id.into(),
            quota_dimensions: vec![QuotaDimension {
                label: label.into(),
                remaining_percent: Some(percent),
                remaining_absolute: format!("{percent}%"),
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_refreshed_at: "0".into(),
        }
    }

    #[test]
    fn filters_to_selected_service_for_summary() {
        let codex_item = item_for_service("codex", "Codex / 5h", 70);
        let claude_item = item_for_service("claude-code", "Claude Code / 5h", 30);
        let items = [codex_item, claude_item];

        // When menubar_service is "claude-code", summary reflects Claude Code only.
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "claude-code".into();
        let filtered = items_for_menubar_service(&prefs, &items);
        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("30%".into())
        );

        // When menubar_service is "codex", summary reflects Codex only.
        prefs.menubar_service = "codex".into();
        let filtered = items_for_menubar_service(&prefs, &items);
        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("70%".into())
        );
    }

    #[test]
    fn returns_none_when_filtered_items_list_is_empty() {
        let codex_item = item_for_service("codex", "Codex / 5h", 50);
        let items = [codex_item];

        // menubar_service doesn't match any item → empty filtered list → None summary.
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "claude-code".into();
        let filtered = items_for_menubar_service(&prefs, &items);
        assert_eq!(format_summary("lowest-remaining", &filtered), None);
    }

    #[test]
    fn startup_filtering_uses_selected_service_for_initial_summary() {
        let items = [
            item_for_service("codex", "Codex / 5h", 72),
            item_for_service("claude-code", "Claude Code / 5h", 28),
        ];
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "claude-code".into();

        let filtered = items_for_menubar_service(&prefs, &items);

        assert_eq!(format_summary("lowest-remaining", &filtered), Some("28%".into()));
    }

    #[test]
    fn codex_service_id_matches_saved_menubar_preference_value() {
        let items = [item_for_service("codex", "Codex / 5h", 55)];
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "codex".into();

        let filtered = items_for_menubar_service(&prefs, &items);

        assert_eq!(filtered.len(), 1);
        assert_eq!(format_summary("lowest-remaining", &filtered), Some("55%".into()));
    }
}
