import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("release workflow contract", () => {
  it("publishes releases from master pushes and tags with generated notes", () => {
    const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");

    expect(workflow).toContain('tags: ["v*"]');
    expect(workflow).toContain("actions/checkout@v6");
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain("node-version-file: .nvmrc");
    expect(workflow).toContain("actions/upload-artifact@v6");
    expect(workflow).toContain("actions/download-artifact@v7");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("gh release upload");
  });
});
