use crate::state::{PanelPlaceholderItem, UserPreferences};
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

pub fn format_summary(display_mode: &str, items: &[PanelPlaceholderItem]) -> Option<String> {
    match display_mode {
        "icon-only" => None,
        "icon-plus-percent" => items
            .first()
            .and_then(|item| item.quota_dimensions.first())
            .map(|dimension| format!("{}%", dimension.remaining_percent)),
        _ => {
            let values = items
                .iter()
                .filter_map(|item| item.quota_dimensions.first())
                .map(|dimension| format!("{}%", dimension.remaining_percent))
                .collect::<Vec<_>>();

            if values.is_empty() {
                None
            } else {
                Some(values.join(" / "))
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
        let summary = format_summary(&preferences.display_mode, items);
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

pub fn initialize_tray(app: &AppHandle, preferences: &UserPreferences, items: &[PanelPlaceholderItem]) {
    if app.tray_by_id("main-tray").is_some() {
        apply_display_mode(app, preferences, items);
        return;
    }

    let mut builder = TrayIconBuilder::with_id("main-tray").tooltip("AIUsage");
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let summary = format_summary(&preferences.display_mode, items);
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

#[cfg(test)]
mod tests {
    use super::format_summary;
    use crate::state::{PanelPlaceholderItem, QuotaDimension};

    fn item(percent: u8) -> PanelPlaceholderItem {
        PanelPlaceholderItem {
            service_id: "service".into(),
            service_name: "Service".into(),
            account_label: None,
            icon_key: "icon".into(),
            quota_dimensions: vec![QuotaDimension {
                label: "Window".into(),
                remaining_percent: percent,
                remaining_absolute: format!("{percent}%"),
                reset_hint: None,
            }],
            status_label: "demo".into(),
            last_refreshed_at: "0".into(),
        }
    }

    #[test]
    fn formats_icon_only_summary() {
        assert_eq!(format_summary("icon-only", &[item(64)]), None);
    }

    #[test]
    fn formats_single_dimension_summary() {
        assert_eq!(format_summary("icon-plus-percent", &[item(64)]), Some("64%".into()));
    }

    #[test]
    fn formats_multi_dimension_summary() {
        assert_eq!(
            format_summary("multi-dimension", &[item(64), item(48)]),
            Some("64% / 48%".into())
        );
    }
}
