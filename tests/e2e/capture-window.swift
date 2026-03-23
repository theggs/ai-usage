#!/usr/bin/env swift
// Capture a specific window into a PNG using CoreGraphics.
// Usage: capture-window.swift <window-id> <output-path>

import AppKit
import CoreGraphics
import Foundation

guard CommandLine.arguments.count > 2 else {
    fputs("Usage: capture-window.swift <window-id> <output-path>\n", stderr)
    exit(1)
}

guard let windowId = UInt32(CommandLine.arguments[1]) else {
    fputs("Invalid window id\n", stderr)
    exit(1)
}

let outputPath = CommandLine.arguments[2]

guard let image = CGWindowListCreateImage(
    .null,
    .optionIncludingWindow,
    CGWindowID(windowId),
    [.boundsIgnoreFraming, .bestResolution]
) else {
    fputs("Could not capture window image\n", stderr)
    exit(1)
}

let rep = NSBitmapImageRep(cgImage: image)
guard let pngData = rep.representation(using: .png, properties: [:]) else {
    fputs("Could not encode PNG\n", stderr)
    exit(1)
}

do {
    try pngData.write(to: URL(fileURLWithPath: outputPath))
    print("captured")
} catch {
    fputs("Could not write PNG: \(error)\n", stderr)
    exit(1)
}
