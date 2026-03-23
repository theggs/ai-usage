#!/usr/bin/env swift
// Click a button in the AIUsage app by its accessibility label.
// Usage: swift click-button.swift "设置"
// Usage: swift click-button.swift "返回"

import Cocoa
import Foundation

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: click-button.swift <button-label> [pid]\n", stderr)
    exit(1)
}

let targetLabel = CommandLine.arguments[1]

// Find the ai_usage process — use explicit PID if provided, otherwise search
var pid: pid_t = 0
if CommandLine.arguments.count > 2, let explicitPid = Int32(CommandLine.arguments[2]) {
    pid = explicitPid
} else {
    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.aiusage.desktop")
    if let app = apps.first {
        pid = app.processIdentifier
    } else {
        // Fallback: search by name
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

// Get the accessibility element for the app
let appElement = AXUIElementCreateApplication(pid)

// Get all windows
var windowsRef: CFTypeRef?
AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
guard let windows = windowsRef as? [AXUIElement], let window = windows.first else {
    fputs("No windows found\n", stderr)
    exit(1)
}

// Recursive search for a button with matching title/description
func roleValue(_ element: AXUIElement) -> String {
    var roleRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef)
    return roleRef as? String ?? ""
}

func parentElement(_ element: AXUIElement) -> AXUIElement? {
    var parentRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXParentAttribute as CFString, &parentRef)
    guard let parentRef else { return nil }
    return (parentRef as! AXUIElement)
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

func postClick(at point: CGPoint) {
    let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
    let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
    let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
    move?.post(tap: .cghidEventTap)
    usleep(80_000)
    down?.post(tap: .cghidEventTap)
    usleep(80_000)
    up?.post(tap: .cghidEventTap)
}

guard let matchingElement = findMatchingElement(window, label: targetLabel) else {
    fputs("Button '\(targetLabel)' not found\n", stderr)
    exit(1)
}

var button: AXUIElement? = matchingElement
while let current = button {
    let role = roleValue(current)
    if role == "AXButton" || role == "AXLink" {
        button = current
        break
    }
    button = parentElement(current)
}

guard let button else {
    fputs("Clickable ancestor for '\(targetLabel)' not found\n", stderr)
    exit(1)
}

// Press the button
let result = AXUIElementPerformAction(button, kAXPressAction as CFString)
if result == .success {
    print("clicked")
} else {
    if let point = elementCenter(button) {
        postClick(at: point)
        print("clicked")
    } else {
        fputs("Click failed with error: \(result.rawValue)\n", stderr)
        exit(1)
    }
}
