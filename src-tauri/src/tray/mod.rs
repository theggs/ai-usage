use crate::state::{
    AppState, AutoMenubarSelectionState, LastSuccessfulPopoverPlacement, PanelPlaceholderItem,
    UserPreferences,
};
use png::ColorType;
use serde::Serialize;
use std::io::Cursor;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Rect, Size, Wry,
};

const DEFAULT_POPOVER_WIDTH: u32 = 360;
const DEFAULT_POPOVER_HEIGHT: u32 = 620;
const POPOVER_VERTICAL_GAP: i32 = 8;
const SAFE_DEFAULT_TOP_OFFSET: i32 = 12;
const CLAUDE_CODE_BRAND_TINT: (u8, u8, u8) = (217, 119, 87);
const CODEX_TRAY_ICON: &[u8] = include_bytes!("../../icons/services/service-codex-tray.png");
const CLAUDE_CODE_TRAY_ICON: &[u8] =
    include_bytes!("../../icons/services/service-claude-code-tray.png");

#[derive(Clone, Debug, PartialEq, Eq)]
struct WorkArea {
    monitor_name: Option<String>,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct TrayAnchor {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PlacementSource {
    TrayAnchor,
    LastSuccessfulPosition,
    SafeDefault,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct PopoverPlacement {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitor_name: Option<String>,
    source: PlacementSource,
}

#[derive(Serialize)]
struct E2ETraySurface<'a> {
    severity: &'a str,
    service_name: &'a str,
    display_service_id: Option<&'a str>,
    icon_service_id: Option<&'a str>,
    title: Option<&'a str>,
    tooltip: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E2EWindowPlacement<'a> {
    visible: bool,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    source: &'a str,
    monitor_name: Option<&'a str>,
}

fn write_e2e_tray_surface(
    severity: &str,
    service_name: &str,
    display_service_id: Option<&str>,
    icon_service_id: Option<&str>,
    title: Option<&str>,
    tooltip: &str,
) {
    let Ok(path) = std::env::var("AI_USAGE_E2E_TRAY_STATE_FILE") else {
        return;
    };

    let payload = E2ETraySurface {
        severity,
        service_name,
        display_service_id,
        icon_service_id,
        title,
        tooltip,
    };

    if let Ok(json) = serde_json::to_string(&payload) {
        let _ = std::fs::write(path, json);
    }
}

fn write_e2e_window_placement(placement: Option<&PopoverPlacement>, visible: bool) {
    let Ok(path) = std::env::var("AI_USAGE_E2E_WINDOW_STATE_FILE") else {
        return;
    };

    let payload = if let Some(placement) = placement {
        let source = match placement.source {
            PlacementSource::TrayAnchor => "tray-anchor",
            PlacementSource::LastSuccessfulPosition => "last-successful-position",
            PlacementSource::SafeDefault => "safe-default",
        };
        E2EWindowPlacement {
            visible,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            source,
            monitor_name: placement.monitor_name.as_deref(),
        }
    } else {
        E2EWindowPlacement {
            visible,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            source: "none",
            monitor_name: None,
        }
    };

    if let Ok(json) = serde_json::to_string(&payload) {
        let _ = std::fs::write(path, json);
    }
}

pub fn record_e2e_window_hidden() {
    write_e2e_window_placement(None, false);
}

pub fn e2e_startup_anchor() -> (Option<Rect>, Option<PhysicalPosition<f64>>) {
    let x = std::env::var("AI_USAGE_E2E_TRAY_X")
        .ok()
        .and_then(|value| value.parse::<i32>().ok());
    let y = std::env::var("AI_USAGE_E2E_TRAY_Y")
        .ok()
        .and_then(|value| value.parse::<i32>().ok());
    let width = std::env::var("AI_USAGE_E2E_TRAY_WIDTH")
        .ok()
        .and_then(|value| value.parse::<u32>().ok());
    let height = std::env::var("AI_USAGE_E2E_TRAY_HEIGHT")
        .ok()
        .and_then(|value| value.parse::<u32>().ok());

    match (x, y, width, height) {
        (Some(x), Some(y), Some(width), Some(height)) => {
            let rect = Rect {
                position: Position::Physical(PhysicalPosition::new(x, y)),
                size: Size::Physical(PhysicalSize::new(width, height)),
            };
            let position = PhysicalPosition::new(
                f64::from(x) + (f64::from(width) / 2.0),
                f64::from(y) + (f64::from(height) / 2.0),
            );
            (Some(rect), Some(position))
        }
        _ => (None, None),
    }
}

fn clamp_i32(value: i32, min: i32, max: i32) -> i32 {
    if max < min {
        min
    } else {
        value.clamp(min, max)
    }
}

impl WorkArea {
    fn max_x(&self) -> i32 {
        self.x + self.width as i32
    }

    fn max_y(&self) -> i32 {
        self.y + self.height as i32
    }

    fn contains_point(&self, x: i32, y: i32) -> bool {
        x >= self.x && x < self.max_x() && y >= self.y && y < self.max_y()
    }

    fn center_distance_squared(&self, x: i32, y: i32) -> i64 {
        let center_x = self.x + (self.width as i32 / 2);
        let center_y = self.y + (self.height as i32 / 2);
        let dx = i64::from(center_x - x);
        let dy = i64::from(center_y - y);
        dx * dx + dy * dy
    }
}

impl TrayAnchor {
    fn center_x(&self) -> i32 {
        self.x + (self.width as i32 / 2)
    }

    fn center_y(&self) -> i32 {
        self.y + (self.height as i32 / 2)
    }

    fn bottom(&self) -> i32 {
        self.y + self.height as i32
    }
}

fn work_area_from_monitor(monitor: &Monitor) -> WorkArea {
    let work_area = monitor.work_area();
    WorkArea {
        monitor_name: monitor.name().cloned(),
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    }
}

fn to_physical_position(position: &Position) -> PhysicalPosition<i32> {
    match position {
        Position::Physical(position) => *position,
        Position::Logical(position) => PhysicalPosition::new(position.x.round() as i32, position.y.round() as i32),
    }
}

fn to_physical_size(size: &Size) -> PhysicalSize<u32> {
    match size {
        Size::Physical(size) => *size,
        Size::Logical(size) => PhysicalSize::new(size.width.max(0.0).round() as u32, size.height.max(0.0).round() as u32),
    }
}

fn tray_anchor_from_rect(rect: &Rect) -> TrayAnchor {
    let position = to_physical_position(&rect.position);
    let size = to_physical_size(&rect.size);
    TrayAnchor {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

fn select_work_area_for_point(x: i32, y: i32, work_areas: &[WorkArea]) -> Option<WorkArea> {
    work_areas
        .iter()
        .find(|area| area.contains_point(x, y))
        .cloned()
        .or_else(|| {
            work_areas
                .iter()
                .min_by_key(|area| area.center_distance_squared(x, y))
                .cloned()
        })
}

fn anchored_placement(
    anchor: &TrayAnchor,
    work_area: &WorkArea,
    size: PhysicalSize<u32>,
) -> PopoverPlacement {
    let width = size.width.max(DEFAULT_POPOVER_WIDTH);
    let height = size.height.max(DEFAULT_POPOVER_HEIGHT);
    let unclamped_x = anchor.center_x() - (width as i32 / 2);
    let max_x = work_area.max_x() - width as i32;
    let x = clamp_i32(unclamped_x, work_area.x, max_x);
    let max_y = work_area.max_y() - height as i32;
    let y = clamp_i32(anchor.bottom() + POPOVER_VERTICAL_GAP, work_area.y, max_y);

    PopoverPlacement {
        x,
        y,
        width,
        height,
        monitor_name: work_area.monitor_name.clone(),
        source: PlacementSource::TrayAnchor,
    }
}

fn placement_from_last_success(
    last: &LastSuccessfulPopoverPlacement,
    work_areas: &[WorkArea],
    size: PhysicalSize<u32>,
) -> Option<PopoverPlacement> {
    let width = size.width.max(last.width);
    let height = size.height.max(last.height);
    let work_area = work_areas
        .iter()
        .find(|area| area.monitor_name == last.monitor_name)
        .cloned()
        .or_else(|| select_work_area_for_point(last.x, last.y, work_areas))?;
    let x = clamp_i32(last.x, work_area.x, work_area.max_x() - width as i32);
    let y = clamp_i32(last.y, work_area.y, work_area.max_y() - height as i32);

    Some(PopoverPlacement {
        x,
        y,
        width,
        height,
        monitor_name: work_area.monitor_name.clone(),
        source: PlacementSource::LastSuccessfulPosition,
    })
}

fn safe_default_placement(work_area: &WorkArea, size: PhysicalSize<u32>) -> PopoverPlacement {
    let width = size.width.max(DEFAULT_POPOVER_WIDTH);
    let height = size.height.max(DEFAULT_POPOVER_HEIGHT);
    let centered_x = work_area.x + ((work_area.width as i32 - width as i32) / 2);
    let x = clamp_i32(centered_x, work_area.x, work_area.max_x() - width as i32);
    let y = clamp_i32(work_area.y + SAFE_DEFAULT_TOP_OFFSET, work_area.y, work_area.max_y() - height as i32);

    PopoverPlacement {
        x,
        y,
        width,
        height,
        monitor_name: work_area.monitor_name.clone(),
        source: PlacementSource::SafeDefault,
    }
}

fn resolve_popover_placement(
    tray_rect: Option<&Rect>,
    work_areas: &[WorkArea],
    last_successful: Option<&LastSuccessfulPopoverPlacement>,
    current_size: PhysicalSize<u32>,
    fallback_work_area: Option<&WorkArea>,
) -> Option<PopoverPlacement> {
    if let Some(rect) = tray_rect {
        let anchor = tray_anchor_from_rect(rect);
        if let Some(work_area) = select_work_area_for_point(anchor.center_x(), anchor.center_y(), work_areas) {
            return Some(anchored_placement(&anchor, &work_area, current_size));
        }
    }

    if let Some(last_successful) = last_successful {
        if let Some(placement) = placement_from_last_success(last_successful, work_areas, current_size) {
            return Some(placement);
        }
    }

    fallback_work_area
        .cloned()
        .or_else(|| work_areas.first().cloned())
        .map(|work_area| safe_default_placement(&work_area, current_size))
}

fn current_window_size(window: &tauri::WebviewWindow) -> PhysicalSize<u32> {
    window
        .outer_size()
        .ok()
        .filter(|size| size.width > 0 && size.height > 0)
        .unwrap_or_else(|| PhysicalSize::new(DEFAULT_POPOVER_WIDTH, DEFAULT_POPOVER_HEIGHT))
}

fn persist_last_successful_placement(app: &AppHandle, placement: &PopoverPlacement) {
    let app_state = app.state::<AppState>();
    let mut last_successful = app_state.last_successful_popover_placement.lock().unwrap();
    *last_successful = Some(LastSuccessfulPopoverPlacement {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        monitor_name: placement.monitor_name.clone(),
    });
}

fn fallback_work_area(
    window: &tauri::WebviewWindow,
    event_position: Option<PhysicalPosition<f64>>,
    work_areas: &[WorkArea],
) -> Option<WorkArea> {
    event_position
        .and_then(|position| window.monitor_from_point(position.x, position.y).ok().flatten())
        .map(|monitor| work_area_from_monitor(&monitor))
        .or_else(|| window.current_monitor().ok().flatten().map(|monitor| work_area_from_monitor(&monitor)))
        .or_else(|| window.primary_monitor().ok().flatten().map(|monitor| work_area_from_monitor(&monitor)))
        .or_else(|| work_areas.first().cloned())
}

fn apply_popover_placement(
    app: &AppHandle,
    window: &tauri::WebviewWindow,
    tray_rect: Option<Rect>,
    event_position: Option<PhysicalPosition<f64>>,
) {
    let work_areas = window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| work_area_from_monitor(&monitor))
        .collect::<Vec<_>>();
    let fallback_work_area = fallback_work_area(window, event_position, &work_areas);
    let app_state = app.state::<AppState>();
    let last_successful = app_state.last_successful_popover_placement.lock().unwrap().clone();
    let current_size = current_window_size(window);

    if let Some(placement) = resolve_popover_placement(
        tray_rect.as_ref(),
        &work_areas,
        last_successful.as_ref(),
        current_size,
        fallback_work_area.as_ref(),
    ) {
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(placement.x, placement.y)));
        persist_last_successful_placement(app, &placement);
        write_e2e_window_placement(Some(&placement), true);
    }
}

fn resolve_display_service_id(
    preferences: &UserPreferences,
    selection: Option<&AutoMenubarSelectionState>,
) -> Option<String> {
    if preferences.menubar_service == "auto" {
        selection.and_then(|current| current.current_service_id.clone())
    } else if !*preferences.provider_enabled.get("claude-code").unwrap_or(&preferences.claude_code_usage_enabled)
        && preferences.menubar_service == "claude-code"
    {
        Some("codex".into())
    } else {
        Some(preferences.menubar_service.clone())
    }
}

fn items_for_menubar_service(
    preferences: &UserPreferences,
    selection: Option<&AutoMenubarSelectionState>,
    items: &[PanelPlaceholderItem],
) -> Vec<PanelPlaceholderItem> {
    let Some(active_service) = resolve_display_service_id(preferences, selection) else {
        return Vec::new();
    };
    items
        .iter()
        .filter(|item| item.service_id == active_service)
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
    if service_name == "AIUsage" {
        return match summary {
            Some(value) if !value.is_empty() => format!("AIUsage · {value}"),
            _ => "AIUsage".to_string(),
        };
    }

    match summary {
        Some(value) if !value.is_empty() => format!("AIUsage · {service_name} · {value}"),
        _ => format!("AIUsage · {service_name}"),
    }
}

#[cfg(target_os = "macos")]
fn macos_tray_title(summary: Option<&str>) -> Option<String> {
    match summary {
        Some(value) if !value.is_empty() => Some(value.to_string()),
        // Clearing the title with an empty string is more reliable than `None`
        // for removing stale text from the macOS menu bar.
        _ => Some(String::new()),
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

fn service_base_icon(service_id: &str) -> Option<Image<'static>> {
    let bytes = match service_id {
        "codex" => CODEX_TRAY_ICON,
        "claude-code" => CLAUDE_CODE_TRAY_ICON,
        _ => return None,
    };

    let decoder = png::Decoder::new(Cursor::new(bytes));
    let mut reader = decoder.read_info().ok()?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buffer).ok()?;
    let source = &buffer[..info.buffer_size()];

    let rgba = match info.color_type {
        ColorType::Rgba => source.to_vec(),
        ColorType::Rgb => source
            .chunks_exact(3)
            .flat_map(|pixel| [pixel[0], pixel[1], pixel[2], 255])
            .collect(),
        ColorType::Grayscale => source
            .iter()
            .flat_map(|value| [*value, *value, *value, 255])
            .collect(),
        ColorType::GrayscaleAlpha => source
            .chunks_exact(2)
            .flat_map(|pixel| [pixel[0], pixel[0], pixel[0], pixel[1]])
            .collect(),
        ColorType::Indexed => return None,
    };

    Some(Image::new_owned(rgba, info.width, info.height))
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

fn solid_tinted_icon(base_icon: Image<'_>, tint: (u8, u8, u8)) -> Image<'static> {
    let mut rgba = base_icon.rgba().to_vec();
    for pixel in rgba.chunks_exact_mut(4) {
        if pixel[3] == 0 {
            continue;
        }
        pixel[0] = tint.0;
        pixel[1] = tint.1;
        pixel[2] = tint.2;
    }
    Image::new_owned(rgba, base_icon.width(), base_icon.height())
}

fn tray_icon_image(app: &AppHandle, service_id: Option<&str>, severity: &str) -> Image<'static> {
    if let Some(base_icon) = service_id.and_then(service_base_icon) {
        let base_icon = match service_id {
            Some("claude-code") => solid_tinted_icon(base_icon, CLAUDE_CODE_BRAND_TINT),
            _ => base_icon,
        };
        return match severity {
            "warning" => tinted_icon(base_icon.clone(), (255, 196, 54), 0.52),
            "danger" => tinted_icon(base_icon.clone(), (236, 96, 88), 0.42),
            _ => base_icon.clone(),
        };
    }

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
        let selection = app
            .state::<AppState>()
            .auto_menubar_selection
            .lock()
            .unwrap()
            .clone();
        let filtered = items_for_menubar_service(preferences, Some(&selection), items);
        let display_service_id = resolve_display_service_id(preferences, Some(&selection));
        let summary = format_summary(&preferences.tray_summary_mode, &filtered);
        let service_name = filtered
            .first()
            .map(|item| item.service_name.as_str())
            .unwrap_or_else(|| match display_service_id.as_deref() {
                Some("claude-code") => "Claude Code",
                Some("codex") => "Codex",
                _ => "AIUsage",
            });
        let severity = tray_severity(&filtered);
        let tooltip = tray_tooltip(service_name, summary.as_deref());

        #[cfg(target_os = "macos")]
        {
            let title = macos_tray_title(summary.as_deref());
            let _ = tray.set_title(title.as_deref());
        }

        #[cfg(not(target_os = "macos"))]
        let _ = tray.set_title::<&str>(None);

        let _ = tray.set_tooltip(Some(tooltip.clone()));
        let _ = tray.set_icon(Some(tray_icon_image(
            app,
            display_service_id.as_deref(),
            severity,
        )));
        write_e2e_tray_surface(
            severity,
            service_name,
            display_service_id.as_deref(),
            display_service_id.as_deref(),
            summary.as_deref(),
            &tooltip,
        );
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

    let selection = app
        .state::<AppState>()
        .auto_menubar_selection
        .lock()
        .unwrap()
        .clone();
    let filtered = items_for_menubar_service(preferences, Some(&selection), items);
    let display_service_id = resolve_display_service_id(preferences, Some(&selection));
    let summary = format_summary(&preferences.tray_summary_mode, &filtered);
    let severity = tray_severity(&filtered);
    builder = builder.icon(tray_icon_image(app, display_service_id.as_deref(), severity));
    if let Some(text) = summary.clone() {
        builder = builder.title(text);
    }

    let _ = builder
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray: &tauri::tray::TrayIcon<Wry>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                position,
                ..
            } = event
            {
                toggle_main_window_with_event(tray.app_handle(), Some(rect), Some(position));
            }
        })
        .build(app);

    apply_display_mode(app, preferences, items);
}

pub fn toggle_main_window(app: &AppHandle) {
    toggle_main_window_with_event(app, None, None);
}

pub fn toggle_main_window_with_event(
    app: &AppHandle,
    tray_rect: Option<Rect>,
    event_position: Option<PhysicalPosition<f64>>,
) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        if visible {
            let _ = window.hide();
            write_e2e_window_placement(None, false);
        } else {
            apply_popover_placement(app, &window, tray_rect, event_position);
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
        anchored_placement, fallback_tray_icon_image, format_summary, items_for_menubar_service,
        placement_from_last_success, resolve_display_service_id, resolve_popover_placement,
        safe_default_placement, service_base_icon, should_hide_on_focus_change, tinted_icon,
        tray_anchor_from_rect, tray_severity, tray_tooltip, PlacementSource, TrayAnchor,
        WorkArea,
    };
    use crate::state::{LastSuccessfulPopoverPlacement, PanelPlaceholderItem, QuotaDimension};
    use tauri::image::Image;
    use tauri::{PhysicalPosition, PhysicalSize, Position, Rect, Size};

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
                resets_at: None,
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_successful_refresh_at: "0".into(),
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
                resets_at: None,
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_successful_refresh_at: "0".into(),
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
                resets_at: None,
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_successful_refresh_at: "0".into(),
        }
    }

    #[test]
    fn filters_to_selected_service_for_summary() {
        let codex_item = item_for_service("codex", "Codex / 5h", 70);
        let claude_item = item_for_service("claude-code", "Claude Code / 5h", 30);
        let items = [codex_item, claude_item];

        // When menubar_service is "claude-code", summary reflects Claude Code only.
        let mut prefs = crate::state::default_preferences();
        prefs.claude_code_usage_enabled = true;
        prefs.provider_enabled.insert("claude-code".into(), true);
        prefs.menubar_service = "claude-code".into();
        let filtered = items_for_menubar_service(&prefs, None, &items);
        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("30%".into())
        );

        // When menubar_service is "codex", summary reflects Codex only.
        prefs.menubar_service = "codex".into();
        let filtered = items_for_menubar_service(&prefs, None, &items);
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
        prefs.claude_code_usage_enabled = true;
        prefs.provider_enabled.insert("claude-code".into(), true);
        prefs.menubar_service = "claude-code".into();
        let filtered = items_for_menubar_service(&prefs, None, &items);
        assert_eq!(format_summary("lowest-remaining", &filtered), None);
    }

    #[test]
    fn startup_filtering_uses_selected_service_for_initial_summary() {
        let items = [
            item_for_service("codex", "Codex / 5h", 72),
            item_for_service("claude-code", "Claude Code / 5h", 28),
        ];
        let mut prefs = crate::state::default_preferences();
        prefs.claude_code_usage_enabled = true;
        prefs.provider_enabled.insert("claude-code".into(), true);
        prefs.menubar_service = "claude-code".into();

        let filtered = items_for_menubar_service(&prefs, None, &items);

        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("28%".into())
        );
    }

    #[test]
    fn disabled_claude_menubar_selection_falls_back_to_codex() {
        let items = [
            item_for_service("codex", "Codex / 5h", 72),
            item_for_service("claude-code", "Claude Code / 5h", 28),
        ];
        let mut prefs = crate::state::default_preferences();
        prefs.claude_code_usage_enabled = false;
        prefs.provider_enabled.insert("claude-code".into(), false);
        prefs.menubar_service = "claude-code".into();

        let filtered = items_for_menubar_service(&prefs, None, &items);

        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("72%".into())
        );
        assert!(filtered.iter().all(|item| item.service_id == "codex"));
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
        assert_eq!(tray_tooltip("AIUsage", None), "AIUsage".to_string());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_title_uses_empty_string_to_clear_stale_text() {
        assert_eq!(super::macos_tray_title(Some("37%")).as_deref(), Some("37%"));
        assert_eq!(super::macos_tray_title(None).as_deref(), Some(""));
        assert_eq!(super::macos_tray_title(Some("")).as_deref(), Some(""));
    }

    #[test]
    fn resolves_auto_selection_to_current_service_id() {
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "auto".into();
        let selection = crate::state::AutoMenubarSelectionState {
            mode: crate::state::AutoMenubarMode::Single,
            current_service_id: Some("claude-code".into()),
            rotation_service_ids: vec![],
            last_resolved_at: 0,
            last_rotated_at: None,
            retained_from_previous: false,
        };

        assert_eq!(
            resolve_display_service_id(&prefs, Some(&selection)).as_deref(),
            Some("claude-code")
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
    fn loads_distinct_service_base_icons() {
        let codex = service_base_icon("codex").expect("codex icon");
        let claude = service_base_icon("claude-code").expect("claude icon");

        assert_eq!(codex.width(), claude.width());
        assert_eq!(codex.height(), claude.height());
        assert_ne!(codex.rgba(), claude.rgba());
    }

    #[test]
    fn solid_tint_preserves_alpha_while_applying_brand_color() {
        let base = Image::new_owned(vec![255, 255, 255, 255, 255, 255, 255, 0], 2, 1);
        let tinted = super::solid_tinted_icon(base, super::CLAUDE_CODE_BRAND_TINT);

        assert_eq!(
            tinted.rgba(),
            &[
                super::CLAUDE_CODE_BRAND_TINT.0,
                super::CLAUDE_CODE_BRAND_TINT.1,
                super::CLAUDE_CODE_BRAND_TINT.2,
                255,
                255,
                255,
                255,
                0
            ]
        );
    }

    #[test]
    fn codex_service_id_matches_saved_menubar_preference_value() {
        let items = [item_for_service("codex", "Codex / 5h", 55)];
        let mut prefs = crate::state::default_preferences();
        prefs.menubar_service = "codex".into();

        let filtered = items_for_menubar_service(&prefs, None, &items);

        assert_eq!(filtered.len(), 1);
        assert_eq!(
            format_summary("lowest-remaining", &filtered),
            Some("55%".into())
        );
    }

    fn work_area(x: i32, y: i32, width: u32, height: u32) -> WorkArea {
        WorkArea {
            monitor_name: Some(format!("{x}:{y}")),
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn tray_anchor_prefers_horizontal_center_line_when_space_is_available() {
        let rect = Rect {
            position: Position::Physical(PhysicalPosition::new(300, 0)),
            size: Size::Physical(PhysicalSize::new(20, 24)),
        };
        let anchor = tray_anchor_from_rect(&rect);
        let placement = anchored_placement(
            &anchor,
            &work_area(0, 0, 800, 900),
            PhysicalSize::new(360, 620),
        );

        assert_eq!(placement.x, 130);
        assert_eq!(placement.y, 32);
        assert_eq!(placement.source, PlacementSource::TrayAnchor);
    }

    #[test]
    fn tray_anchor_clamps_inside_left_and_right_edges() {
        let left = anchored_placement(
            &TrayAnchor {
                x: 0,
                y: 0,
                width: 20,
                height: 24,
            },
            &work_area(0, 0, 500, 900),
            PhysicalSize::new(360, 620),
        );
        let right = anchored_placement(
            &TrayAnchor {
                x: 470,
                y: 0,
                width: 20,
                height: 24,
            },
            &work_area(0, 0, 500, 900),
            PhysicalSize::new(360, 620),
        );

        assert_eq!(left.x, 0);
        assert_eq!(right.x, 140);
    }

    #[test]
    fn last_successful_placement_is_reused_and_clamped_when_tray_rect_is_missing() {
        let placement = placement_from_last_success(
            &LastSuccessfulPopoverPlacement {
                x: 720,
                y: 40,
                width: 360,
                height: 620,
                monitor_name: Some("0:0".into()),
            },
            &[work_area(0, 0, 800, 900)],
            PhysicalSize::new(360, 620),
        )
        .expect("last successful placement should resolve");

        assert_eq!(placement.x, 440);
        assert_eq!(placement.y, 40);
        assert_eq!(placement.source, PlacementSource::LastSuccessfulPosition);
    }

    #[test]
    fn safe_default_centers_the_panel_near_the_top_of_the_work_area() {
        let placement = safe_default_placement(&work_area(100, 40, 700, 900), PhysicalSize::new(360, 620));

        assert_eq!(placement.x, 270);
        assert_eq!(placement.y, 52);
        assert_eq!(placement.source, PlacementSource::SafeDefault);
    }

    #[test]
    fn resolve_popover_placement_uses_safe_default_when_no_anchor_or_history_is_available() {
        let fallback = work_area(0, 0, 800, 900);
        let placement = resolve_popover_placement(
            None,
            std::slice::from_ref(&fallback),
            None,
            PhysicalSize::new(360, 620),
            Some(&fallback),
        )
        .expect("safe default placement should resolve");

        assert_eq!(placement.source, PlacementSource::SafeDefault);
        assert_eq!(placement.x, 220);
        assert_eq!(placement.y, 12);
    }

    #[test]
    fn resolve_popover_placement_prefers_anchor_then_history_then_safe_default() {
        let fallback = work_area(0, 0, 800, 900);
        let rect = Rect {
            position: Position::Physical(PhysicalPosition::new(300, 0)),
            size: Size::Physical(PhysicalSize::new(20, 24)),
        };
        let anchor_first = resolve_popover_placement(
            Some(&rect),
            std::slice::from_ref(&fallback),
            Some(&LastSuccessfulPopoverPlacement {
                x: 40,
                y: 40,
                width: 360,
                height: 620,
                monitor_name: Some("0:0".into()),
            }),
            PhysicalSize::new(360, 620),
            Some(&fallback),
        )
        .expect("anchor placement should resolve");

        let history_second = resolve_popover_placement(
            None,
            std::slice::from_ref(&fallback),
            Some(&LastSuccessfulPopoverPlacement {
                x: 40,
                y: 40,
                width: 360,
                height: 620,
                monitor_name: Some("0:0".into()),
            }),
            PhysicalSize::new(360, 620),
            Some(&fallback),
        )
        .expect("history placement should resolve");

        assert_eq!(anchor_first.source, PlacementSource::TrayAnchor);
        assert_eq!(history_second.source, PlacementSource::LastSuccessfulPosition);
    }
}
