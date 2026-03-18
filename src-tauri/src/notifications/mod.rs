use crate::state::NotificationCheckResult;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("demo-{now}")
}

pub fn send_demo_notification(message: Option<String>) -> NotificationCheckResult {
    NotificationCheckResult {
        notification_id: now_id(),
        triggered_at: now_id(),
        result: "sent".into(),
        message_preview: message.unwrap_or_else(|| "AIUsage demo notification".into()),
    }
}
