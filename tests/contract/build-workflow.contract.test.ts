import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("build workflow contract", () => {
  it("defines macOS and Windows build jobs with stable artifact paths", () => {
    const workflow = readFileSync(".github/workflows/desktop-build.yml", "utf8");

    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("actions/checkout@v6");
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain("node-version-file: .nvmrc");
    expect(workflow).toContain("actions/upload-artifact@v6");
    expect(workflow).toContain("build-metadata");
    expect(workflow).toContain("--bundles app");
    expect(workflow).toContain("--bundles nsis");
    expect(workflow).toContain("target/release/bundle/**");
  });
});
