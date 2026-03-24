#!/usr/bin/env swift
// Move the cursor to a labeled element in the AIUsage app.
// Usage: swift hover-button.swift "预览全部促销状态"

import Cocoa
import Foundation

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: hover-button.swift <element-label> [pid]\n", stderr)
    exit(1)
}

let targetLabel = CommandLine.arguments[1]

var pid: pid_t = 0
if CommandLine.arguments.count > 2, let explicitPid = Int32(CommandLine.arguments[2]) {
    pid = explicitPid
} else {
    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.aiusage.desktop")
    if let app = apps.first {
        pid = app.processIdentifier
    } else {
        let workspace = NSWorkspace.shared
        for app in workspace.runningApplications {
            let name = app.localizedName ?? ""
            if name.lowercased().contains("ai_usage") || name.lowercased().contains("aiusage") {
                pid = app.processIdentifier
                break
            }
        }
    }
}

guard pid != 0 else {
    fputs("AIUsage app not found\n", stderr)
    exit(1)
}

let appElement = AXUIElementCreateApplication(pid)

var windowsRef: CFTypeRef?
AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
guard let windows = windowsRef as? [AXUIElement], let window = windows.first else {
    fputs("No windows found\n", stderr)
    exit(1)
}

func findMatchingElement(_ element: AXUIElement, label: String) -> AXUIElement? {
    var titleRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleRef)
    let title = titleRef as? String ?? ""

    var descRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descRef)
    let desc = descRef as? String ?? ""

    var valueRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueRef)
    let value = valueRef as? String ?? ""

    if title == label || desc == label || value == label {
        return element
    }

    var childrenRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
    if let children = childrenRef as? [AXUIElement] {
        for child in children {
            if let found = findMatchingElement(child, label: label) {
                return found
            }
        }
    }

    return nil
}

func elementCenter(_ element: AXUIElement) -> CGPoint? {
    var positionRef: CFTypeRef?
    var sizeRef: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionRef) == .success,
          AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeRef) == .success,
          let positionValue = positionRef,
          let sizeValue = sizeRef else {
        return nil
    }

    var position = CGPoint.zero
    var size = CGSize.zero
    AXValueGetValue(positionValue as! AXValue, .cgPoint, &position)
    AXValueGetValue(sizeValue as! AXValue, .cgSize, &size)
    return CGPoint(x: position.x + size.width / 2.0, y: position.y + size.height / 2.0)
}

guard let matchingElement = findMatchingElement(window, label: targetLabel) else {
    fputs("Element '\(targetLabel)' not found\n", stderr)
    exit(1)
}

guard let point = elementCenter(matchingElement) else {
    fputs("Could not resolve the element center for '\(targetLabel)'\n", stderr)
    exit(1)
}

let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
move?.post(tap: .cghidEventTap)
print("hovered")
