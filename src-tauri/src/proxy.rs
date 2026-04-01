// Shared proxy resolution module.
// Extracted from claude_code/mod.rs so all providers can reuse proxy detection.

use crate::state::UserPreferences;
use std::env;
use std::process::Command;

#[derive(Debug, PartialEq, Eq)]
pub enum ProxyResolutionError {
    InvalidManualUrl,
    InvalidResolvedUrl,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ProxyError {
    Resolution(ProxyResolutionError),
    AgentBuild,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProxyDecision {
    pub label: String,
    pub url: Option<String>,
}

fn has_scheme(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://") || value.starts_with("socks5://")
}

pub fn normalize_system_proxy_url(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }
    if value.contains("://") {
        return Some(value.into());
    }
    Some(format!("http://{value}"))
}

pub fn normalize_manual_proxy_url(raw: &str) -> Result<String, ProxyResolutionError> {
    let value = raw.trim();
    if value.is_empty() || !has_scheme(value) {
        return Err(ProxyResolutionError::InvalidManualUrl);
    }
    Ok(value.into())
}

#[cfg(any(test, target_os = "windows"))]
pub fn parse_proxy_assignment_value(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }

    if !value.contains('=') {
        return normalize_system_proxy_url(value);
    }

    let mut http_proxy = None;
    let mut https_proxy = None;
    let mut fallback = None;
    for part in value.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let (key, val) = part.split_once('=').unwrap_or(("", part));
        let normalized = normalize_system_proxy_url(val)?;
        match key.trim().to_ascii_lowercase().as_str() {
            "https" => https_proxy = Some(normalized),
            "http" => http_proxy = Some(normalized),
            _ => {
                if fallback.is_none() {
                    fallback = Some(normalized);
                }
            }
        }
    }

    https_proxy.or(http_proxy).or(fallback)
}

pub fn parse_scutil_proxy_output(text: &str) -> Option<String> {
    let map: std::collections::HashMap<&str, &str> = text
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, ':');
            let key = parts.next()?.trim();
            let val = parts.next()?.trim();
            Some((key, val))
        })
        .collect();

    // Prefer HTTPS-specific proxy, fall back to HTTP proxy.
    let (host, port) = if map.get("HTTPSEnable").copied() == Some("1") {
        (
            map.get("HTTPSProxy").copied().unwrap_or(""),
            map.get("HTTPSPort").copied().unwrap_or("8080"),
        )
    } else if map.get("HTTPEnable").copied() == Some("1") {
        (
            map.get("HTTPProxy").copied().unwrap_or(""),
            map.get("HTTPPort").copied().unwrap_or("8080"),
        )
    } else {
        return None;
    };

    if host.is_empty() {
        return None;
    }

    Some(format!("http://{host}:{port}"))
}

#[cfg(target_os = "macos")]
pub fn get_macos_system_proxy() -> Option<String> {
    let output = Command::new("scutil").arg("--proxy").output().ok()?;
    if !output.status.success() {
        return None;
    }
    parse_scutil_proxy_output(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(target_os = "macos"))]
pub fn get_macos_system_proxy() -> Option<String> {
    None
}

#[cfg(any(test, target_os = "windows"))]
pub fn parse_windows_reg_proxy_output(text: &str) -> Option<String> {
    let enabled = text.lines().any(|line| {
        line.contains("ProxyEnable") && (line.contains("0x1") || line.trim_end().ends_with(" 1"))
    });
    if !enabled {
        return None;
    }

    let server_line = text.lines().find(|line| line.contains("ProxyServer"))?;
    let raw = server_line
        .split_whitespace()
        .last()
        .map(str::trim)
        .unwrap_or_default();
    parse_proxy_assignment_value(raw)
}

#[cfg(any(test, target_os = "windows"))]
pub fn parse_windows_netsh_proxy_output(text: &str) -> Option<String> {
    let proxy_line = text.lines().find(|line| line.contains("Proxy Server(s)"))?;
    let raw = proxy_line.split_once(':')?.1.trim();
    if raw.eq_ignore_ascii_case("direct access (no proxy server)") {
        return None;
    }
    parse_proxy_assignment_value(raw)
}

#[cfg(target_os = "windows")]
pub fn get_windows_system_proxy() -> Option<String> {
    let reg_output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v",
            "ProxyEnable",
        ])
        .output()
        .ok();
    let reg_server_output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v",
            "ProxyServer",
        ])
        .output()
        .ok();

    if let (Some(enable), Some(server)) = (reg_output, reg_server_output) {
        if enable.status.success() && server.status.success() {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&enable.stdout),
                String::from_utf8_lossy(&server.stdout)
            );
            if let Some(proxy) = parse_windows_reg_proxy_output(&combined) {
                return Some(proxy);
            }
        }
    }

    let netsh = Command::new("netsh")
        .args(["winhttp", "show", "proxy"])
        .output()
        .ok()?;
    if !netsh.status.success() {
        return None;
    }
    parse_windows_netsh_proxy_output(&String::from_utf8_lossy(&netsh.stdout))
}

#[cfg(not(target_os = "windows"))]
pub fn get_windows_system_proxy() -> Option<String> {
    None
}

/// Resolve the outbound proxy for API requests.
///
/// Priority:
///   1. Explicit user preference (`off` / `manual`)
///   2. Standard proxy env vars (HTTPS_PROXY, https_proxy, ALL_PROXY, ...)
///   3. macOS System Preferences proxy (via `scutil --proxy`)
///   4. Windows system proxy / WinHTTP fallback
pub fn get_env_proxy() -> Option<String> {
    for var in &[
        "HTTPS_PROXY",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
        "HTTP_PROXY",
        "http_proxy",
    ] {
        if let Ok(val) = env::var(var) {
            if let Some(url) = normalize_system_proxy_url(&val) {
                return Some(url);
            }
        }
    }
    None
}

pub fn resolve_proxy(preferences: &UserPreferences) -> Result<ProxyDecision, ProxyResolutionError> {
    match preferences.network_proxy_mode.as_str() {
        "off" => Ok(ProxyDecision {
            label: "off".into(),
            url: None,
        }),
        "manual" => Ok(ProxyDecision {
            label: "manual".into(),
            url: Some(normalize_manual_proxy_url(&preferences.network_proxy_url)?),
        }),
        _ => {
            if let Some(url) = get_env_proxy() {
                Ok(ProxyDecision {
                    label: "system(env)".into(),
                    url: Some(url),
                })
            } else if let Some(url) = get_macos_system_proxy() {
                Ok(ProxyDecision {
                    label: "system(macos)".into(),
                    url: Some(url),
                })
            } else if let Some(url) = get_windows_system_proxy() {
                Ok(ProxyDecision {
                    label: "system(windows)".into(),
                    url: Some(url),
                })
            } else {
                Ok(ProxyDecision {
                    label: "system(none-detected)".into(),
                    url: None,
                })
            }
        }
    }
}

/// Build an HTTP agent with proxy settings from user preferences.
pub fn build_agent(preferences: &UserPreferences) -> Result<(ureq::Agent, ProxyDecision), ProxyError> {
    let mut builder = ureq::AgentBuilder::new();
    let proxy = resolve_proxy(preferences).map_err(ProxyError::Resolution)?;
    if let Some(proxy_url) = proxy.url.as_ref() {
        let proxy = ureq::Proxy::new(proxy_url)
            .map_err(|_| ProxyError::Resolution(ProxyResolutionError::InvalidResolvedUrl))?;
        builder = builder.proxy(proxy);
    }
    Ok((builder.build(), proxy))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn prefs() -> UserPreferences {
        crate::state::default_preferences()
    }

    #[test]
    fn parse_scutil_output_prefers_https_proxy() {
        let text = r#"
<dictionary> {
  HTTPEnable : 1
  HTTPProxy : 127.0.0.1
  HTTPPort : 7890
  HTTPSEnable : 1
  HTTPSProxy : 127.0.0.2
  HTTPSPort : 7891
}
"#;
        assert_eq!(
            parse_scutil_proxy_output(text),
            Some("http://127.0.0.2:7891".into())
        );
    }

    #[test]
    fn parse_windows_registry_proxy_prefers_https_assignment() {
        let text = r#"
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    http=127.0.0.1:8080;https=127.0.0.1:9443
"#;
        assert_eq!(
            parse_windows_reg_proxy_output(text),
            Some("http://127.0.0.1:9443".into())
        );
    }

    #[test]
    fn parse_windows_netsh_proxy_supports_direct_host_port() {
        let text = r#"
Current WinHTTP proxy settings:

    Proxy Server(s) : 10.0.0.2:8888
    Bypass List     : (none)
"#;
        assert_eq!(
            parse_windows_netsh_proxy_output(text),
            Some("http://10.0.0.2:8888".into())
        );
    }

    #[test]
    fn manual_proxy_requires_full_url() {
        let mut preferences = prefs();
        preferences.network_proxy_mode = "manual".into();
        preferences.network_proxy_url = "127.0.0.1:7890".into();
        assert_eq!(
            resolve_proxy(&preferences),
            Err(ProxyResolutionError::InvalidManualUrl)
        );
    }

    #[test]
    fn off_proxy_mode_bypasses_proxy() {
        let mut preferences = prefs();
        preferences.network_proxy_mode = "off".into();
        preferences.network_proxy_url = "http://127.0.0.1:7890".into();
        assert_eq!(
            resolve_proxy(&preferences),
            Ok(ProxyDecision {
                label: "off".into(),
                url: None
            })
        );
    }

    #[test]
    fn manual_proxy_mode_uses_configured_url() {
        let mut preferences = prefs();
        preferences.network_proxy_mode = "manual".into();
        preferences.network_proxy_url = "http://127.0.0.1:7890".into();
        assert_eq!(
            resolve_proxy(&preferences),
            Ok(ProxyDecision {
                label: "manual".into(),
                url: Some("http://127.0.0.1:7890".into())
            })
        );
    }
}
