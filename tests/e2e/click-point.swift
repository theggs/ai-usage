#!/usr/bin/env swift
// Click a global screen point.
// Usage: click-point.swift <x> <y>

import Cocoa
import Foundation

guard CommandLine.arguments.count > 2,
      let x = Double(CommandLine.arguments[1]),
      let y = Double(CommandLine.arguments[2]) else {
    fputs("Usage: click-point.swift <x> <y>\n", stderr)
    exit(1)
}

let point = CGPoint(x: x, y: y)

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

postClick(at: point)
print("clicked")
