#!/usr/bin/env swift
// Send a key press to the AIUsage app.
// Usage: swift press-key.swift escape

import Cocoa
import Foundation

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: press-key.swift <key> [pid]\n", stderr)
    exit(1)
}

let keyName = CommandLine.arguments[1].lowercased()
let virtualKey: CGKeyCode

switch keyName {
case "escape", "esc":
    virtualKey = 53
case "r":
    virtualKey = 15
case "d":
    virtualKey = 2
case "u":
    virtualKey = 32
case "o":
    virtualKey = 31
case "f5":
    virtualKey = 96
case "f6":
    virtualKey = 97
case "f7":
    virtualKey = 98
case "f8":
    virtualKey = 100
case "f9":
    virtualKey = 101
case "f10":
    virtualKey = 109
default:
    fputs("Unsupported key '\(keyName)'\n", stderr)
    exit(1)
}

var pid: pid_t = 0
if CommandLine.arguments.count > 2, let explicitPid = Int32(CommandLine.arguments[2]) {
    pid = explicitPid
} else {
    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.aiusage.desktop")
    if let app = apps.first {
        pid = app.processIdentifier
    }
}

if pid != 0, let app = NSRunningApplication(processIdentifier: pid) {
    app.activate(options: [.activateIgnoringOtherApps])
    usleep(120_000)
}

let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: virtualKey, keyDown: true)
let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: virtualKey, keyDown: false)
keyDown?.post(tap: .cghidEventTap)
usleep(80_000)
keyUp?.post(tap: .cghidEventTap)
print("pressed")
