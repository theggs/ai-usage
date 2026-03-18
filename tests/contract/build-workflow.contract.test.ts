import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("build workflow contract", () => {
  it("defines macOS and Windows build jobs", () => {
    const workflow = readFileSync(".github/workflows/desktop-build.yml", "utf8");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("build-metadata");
  });
});
