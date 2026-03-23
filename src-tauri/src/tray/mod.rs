use crate::state::{PanelPlaceholderItem, UserPreferences};
use serde::Serialize;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

#[derive(Serialize)]
struct E2ETraySurface<'a> {
    severity: &'a str,
    service_name: &'a str,
    title: Option<&'a str>,
    tooltip: &'a str,
}

fn write_e2e_tray_surface(
    severity: &str,
    service_name: &str,
    title: Option<&str>,
    tooltip: &str,
) {
    let Ok(path) = std::env::var("AI_USAGE_E2E_TRAY_STATE_FILE") else {
        return;
    };

    let payload = E2ETraySurface {
        severity,
        service_name,
        title,
        tooltip,
    };

    if let Ok(json) = serde_json::to_string(&payload) {
        let _ = std::fs::write(path, json);
    }
}

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

fn tray_severity(items: &[PanelPlaceholderItem]) -> &'static str {
    let dimensions = all_dimensions(items);
    if dimensions.is_empty() {
        return "empty";
    }
    if dimensions
        .iter()
        .any(|dimension| matches!(dimension.remaining_percent, Some(percent) if percent < 20))
    {
        return "danger";
    }
    if dimensions
        .iter()
        .any(|dimension| matches!(dimension.remaining_percent, Some(percent) if (20..=50).contains(&percent)))
    {
        return "warning";
    }
    "normal"
}

fn tray_tooltip(service_name: &str, summary: Option<&str>) -> String {
    match summary {
        Some(value) if !value.is_empty() => format!("AIUsage · {service_name} · {value}"),
        _ => format!("AIUsage · {service_name}"),
    }
}

fn fallback_tray_icon_image(severity: &str) -> Image<'static> {
    let size = 18u32;
    let center = (size as f32 - 1.0) / 2.0;
    let radius = 7.0f32;
    let mut rgba = vec![0u8; (size * size * 4) as usize];

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let distance = (dx * dx + dy * dy).sqrt();
            let pixel = ((y * size + x) * 4) as usize;

            let (r, g, b, a) = match severity {
                "warning" => {
                    if distance <= radius {
                        (217, 119, 6, 255)
                    } else {
                        (0, 0, 0, 0)
                    }
                }
                "danger" => {
                    if distance <= radius {
                        (220, 38, 38, 255)
                    } else {
                        (0, 0, 0, 0)
                    }
                }
                _ => {
                    if distance <= radius {
                        (15, 23, 42, 255)
                    } else {
                        (0, 0, 0, 0)
                    }
                }
            };

            rgba[pixel] = r;
            rgba[pixel + 1] = g;
            rgba[pixel + 2] = b;
            rgba[pixel + 3] = a;
        }
    }

    match severity {
        "warning" => {
            for y in 4..12 {
                let pixel = ((y * size + 8) * 4) as usize;
                rgba[pixel] = 255;
                rgba[pixel + 1] = 255;
                rgba[pixel + 2] = 255;
                rgba[pixel + 3] = 255;
            }
            let pixel = ((14 * size + 8) * 4) as usize;
            rgba[pixel] = 255;
            rgba[pixel + 1] = 255;
            rgba[pixel + 2] = 255;
            rgba[pixel + 3] = 255;
        }
        "danger" => {
            for offset in 0..7 {
                let left = ((5 + offset) * size + (5 + offset)) * 4;
                let right = ((5 + offset) * size + (11 - offset)) * 4;
                for pixel in [left as usize, right as usize] {
                    rgba[pixel] = 255;
                    rgba[pixel + 1] = 255;
                    rgba[pixel + 2] = 255;
                    rgba[pixel + 3] = 255;
                }
            }
        }
        _ => {
            for (x, y) in [
                (5, 9),
                (6, 10),
                (7, 11),
                (8, 10),
                (9, 9),
                (10, 8),
                (11, 7),
                (12, 6),
            ] {
                let pixel = ((y * size + x) * 4) as usize;
                rgba[pixel] = 255;
                rgba[pixel + 1] = 255;
                rgba[pixel + 2] = 255;
                rgba[pixel + 3] = 255;
            }
        }
    }

    Image::new_owned(rgba, size, size)
}

fn tinted_icon(base_icon: Image<'_>, tint: (u8, u8, u8), mix: f32) -> Image<'static> {
    let mut rgba = base_icon.rgba().to_vec();
    for pixel in rgba.chunks_exact_mut(4) {
        if pixel[3] == 0 {
            continue;
        }

        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let max_channel = r.max(g).max(b);
        let min_channel = r.min(g).min(b);
        let luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
        let saturation = if max_channel <= 0.0 {
            0.0
        } else {
            (max_channel - min_channel) / max_channel
        };

        // Keep dark base areas almost untouched, and concentrate tint on
        // brighter highlights so the result feels like a native icon variant.
        let highlight_weight = ((luminance - 0.16) / 0.84).clamp(0.0, 1.0).powf(1.05);
        let color_weight = (0.22 + 0.78 * saturation).clamp(0.0, 1.0);
        let local_mix = mix * highlight_weight * color_weight;

        let screen_r = 255.0 - ((255.0 - r) * (255.0 - tint.0 as f32) / 255.0);
        let screen_g = 255.0 - ((255.0 - g) * (255.0 - tint.1 as f32) / 255.0);
        let screen_b = 255.0 - ((255.0 - b) * (255.0 - tint.2 as f32) / 255.0);

        let lift = local_mix * 0.24;

        pixel[0] = (r + (screen_r - r) * local_mix + (255.0 - r) * lift).min(255.0).round() as u8;
        pixel[1] = (g + (screen_g - g) * local_mix + (255.0 - g) * lift).min(255.0).round() as u8;
        pixel[2] = (b + (screen_b - b) * local_mix + (255.0 - b) * lift).min(255.0).round() as u8;
    }
    Image::new_owned(rgba, base_icon.width(), base_icon.height())
}

fn tray_icon_image(app: &AppHandle, severity: &str) -> Image<'static> {
    if let Some(base_icon) = app.default_window_icon() {
        return match severity {
            "warning" => tinted_icon(base_icon.clone(), (255, 196, 54), 0.68),
            "danger" => tinted_icon(base_icon.clone(), (236, 96, 88), 0.52),
            _ => base_icon.clone().to_owned(),
        };
    }
    fallback_tray_icon_image(severity)
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
        let service_name = filtered
            .first()
            .map(|item| item.service_name.as_str())
            .unwrap_or_else(|| match preferences.menubar_service.as_str() {
                "claude-code" => "Claude Code",
                _ => "Codex",
            });
        let severity = tray_severity(&filtered);
        let tooltip = tray_tooltip(service_name, summary.as_deref());

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

        let _ = tray.set_tooltip(Some(tooltip.clone()));
        let _ = tray.set_icon(Some(tray_icon_image(app, severity)));
        write_e2e_tray_surface(severity, service_name, summary.as_deref(), &tooltip);
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

    let filtered = items_for_menubar_service(preferences, items);
    let summary = format_summary(&preferences.tray_summary_mode, &filtered);
    let severity = tray_severity(&filtered);
    builder = builder.icon(tray_icon_image(app, severity));
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
    use super::{
        fallback_tray_icon_image, format_summary, items_for_menubar_service,
        should_hide_on_focus_change, tinted_icon, tray_severity, tray_tooltip,
    };
    use crate::state::{PanelPlaceholderItem, QuotaDimension};
    use tauri::image::Image;

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
                &[
                    item_with_label("codex / week", 48),
                    item_with_label("codex / 5h", 64)
                ]
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

        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("28%".into())
        );
    }

    #[test]
    fn formats_tooltip_with_service_name() {
        assert_eq!(
            tray_tooltip("Codex", Some("37%")),
            "AIUsage · Codex · 37%".to_string()
        );
        assert_eq!(
            tray_tooltip("Claude Code", None),
            "AIUsage · Claude Code".to_string()
        );
    }

    #[test]
    fn derives_tray_severity_from_lowest_percent() {
        assert_eq!(tray_severity(&[item(64)]), "normal");
        assert_eq!(tray_severity(&[item(45)]), "warning");
        assert_eq!(tray_severity(&[item(18)]), "danger");
        assert_eq!(tray_severity(&[]), "empty");
    }

    #[test]
    fn creates_distinct_tray_icon_images_for_each_severity() {
        let normal = fallback_tray_icon_image("normal");
        let warning = fallback_tray_icon_image("warning");
        let danger = fallback_tray_icon_image("danger");

        assert_eq!(normal.width(), 18);
        assert_eq!(normal.height(), 18);
        assert_ne!(normal.rgba(), warning.rgba());
        assert_ne!(warning.rgba(), danger.rgba());
    }

    #[test]
    fn tints_existing_app_icon_for_warning_and_danger_states() {
        let base = Image::new_owned(vec![10, 20, 30, 255, 100, 120, 140, 255], 2, 1);
        let warning = tinted_icon(base.clone(), (245, 158, 11), 0.62);
        let danger = tinted_icon(base.clone(), (239, 68, 68), 0.72);

        assert_eq!(warning.width(), 2);
        assert_eq!(danger.height(), 1);
        assert_ne!(warning.rgba(), base.rgba());
        assert_ne!(danger.rgba(), base.rgba());
    }

    #[test]
    fn codex_service_id_matches_saved_menubar_preference_value() {
        let items = [item_for_service("codex", "Codex / 5h", 55)];
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "codex".into();

        let filtered = items_for_menubar_service(&prefs, &items);

        assert_eq!(filtered.len(), 1);
        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("55%".into())
        );
    }
}
