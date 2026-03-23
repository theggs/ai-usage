#!/usr/bin/env swift
// Drag from one accessibility element to another inside the AIUsage window.
// Usage: drag-element.swift "<source-label>" "<target-label>" [pid]

import Cocoa
import Foundation

guard CommandLine.arguments.count > 2 else {
    fputs("Usage: drag-element.swift <source-label> <target-label> [pid]\n", stderr)
    exit(1)
}

let sourceLabel = CommandLine.arguments[1]
let targetLabel = CommandLine.arguments[2]

func resolvePid() -> pid_t {
    if CommandLine.arguments.count > 3, let explicitPid = Int32(CommandLine.arguments[3]) {
        return explicitPid
    }

    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.aiusage.desktop")
    if let app = apps.first {
        return app.processIdentifier
    }

    for app in NSWorkspace.shared.runningApplications {
        let name = (app.localizedName ?? "").lowercased()
        if name.contains("ai_usage") || name.contains("aiusage") {
            return app.processIdentifier
        }
    }
    return 0
}

func stringValue(_ element: AXUIElement, _ attribute: CFString) -> String {
    var ref: CFTypeRef?
    AXUIElementCopyAttributeValue(element, attribute, &ref)
    return ref as? String ?? ""
}

func childElements(_ element: AXUIElement) -> [AXUIElement] {
    var ref: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &ref)
    return ref as? [AXUIElement] ?? []
}

func findElement(_ element: AXUIElement, label: String) -> AXUIElement? {
    let title = stringValue(element, kAXTitleAttribute as CFString)
    let description = stringValue(element, kAXDescriptionAttribute as CFString)
    let value = stringValue(element, kAXValueAttribute as CFString)

    if title == label || description == label || value == label {
        return element
    }

    for child in childElements(element) {
        if let found = findElement(child, label: label) {
            return found
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

func postMouse(_ type: CGEventType, point: CGPoint) {
    let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)
    event?.post(tap: .cghidEventTap)
}

let pid = resolvePid()
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

guard let sourceElement = findElement(window, label: sourceLabel) else {
    fputs("Source element '\(sourceLabel)' not found\n", stderr)
    exit(1)
}

guard let targetElement = findElement(window, label: targetLabel) else {
    fputs("Target element '\(targetLabel)' not found\n", stderr)
    exit(1)
}

guard let sourcePoint = elementCenter(sourceElement),
      let targetPoint = elementCenter(targetElement) else {
    fputs("Could not resolve element frames\n", stderr)
    exit(1)
}

postMouse(.mouseMoved, point: sourcePoint)
usleep(120_000)
postMouse(.leftMouseDown, point: sourcePoint)
usleep(120_000)

let steps = 8
for step in 1...steps {
    let progress = CGFloat(step) / CGFloat(steps)
    let point = CGPoint(
        x: sourcePoint.x + (targetPoint.x - sourcePoint.x) * progress,
        y: sourcePoint.y + (targetPoint.y - sourcePoint.y) * progress
    )
    postMouse(.leftMouseDragged, point: point)
    usleep(60_000)
}

usleep(120_000)
postMouse(.leftMouseUp, point: targetPoint)
print("dragged")
