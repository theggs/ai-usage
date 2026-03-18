use crate::state::UserPreferences;

pub fn set_autostart_status(enabled: bool, mut preferences: UserPreferences) -> UserPreferences {
    preferences.autostart_enabled = enabled;
    preferences
}
