#!/usr/bin/env swift
// Move the cursor to a global screen point.
// Usage: move-point.swift <x> <y>

import Cocoa
import Foundation

guard CommandLine.arguments.count > 2,
      let x = Double(CommandLine.arguments[1]),
      let y = Double(CommandLine.arguments[2]) else {
    fputs("Usage: move-point.swift <x> <y>\n", stderr)
    exit(1)
}

let point = CGPoint(x: x, y: y)
let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
move?.post(tap: .cghidEventTap)
print("moved")
