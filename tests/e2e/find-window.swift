#!/usr/bin/env swift
// Find the AIUsage main panel window via CGWindowListCopyWindowInfo.
// Only matches on-screen windows at the expected panel size (360×620).
// Prints JSON: {"id":123,"owner":"ai_usage","bounds":{"X":0,"Y":0,"Width":360,"Height":620}}

import CoreGraphics
import Foundation

let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []

for window in windowList {
    guard let owner = window[kCGWindowOwnerName as String] as? String else { continue }
    let lowerOwner = owner.lowercased()
    guard lowerOwner.contains("ai_usage") || lowerOwner.contains("aiusage") else { continue }
    guard let windowId = window[kCGWindowNumber as String] as? Int else { continue }

    let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let w = (bounds["Width"] as? Double) ?? 0.0
    let h = (bounds["Height"] as? Double) ?? 0.0

    // Skip non-panel windows (e.g. hidden helper windows)
    guard w > 100 && w < 500 && h > 400 && h < 900 else { continue }

    let x = (bounds["X"] as? Double) ?? 0.0
    let y = (bounds["Y"] as? Double) ?? 0.0
    let result: [String: Any] = [
        "id": windowId,
        "owner": owner,
        "bounds": ["X": x, "Y": y, "Width": w, "Height": h] as [String: Double]
    ]
    if let data = try? JSONSerialization.data(withJSONObject: result),
       let json = String(data: data, encoding: .utf8) {
        print(json)
    }
    break
}
