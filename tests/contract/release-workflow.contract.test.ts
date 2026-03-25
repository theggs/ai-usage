import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("release workflow contract", () => {
  it("publishes releases from master pushes and tags with generated notes", () => {
    const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");

    expect(workflow).toContain('branches: ["master"]');
    expect(workflow).toContain('tags: ["*"]');
    expect(workflow).toContain("actions/checkout@v6");
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain("node-version-file: .nvmrc");
    expect(workflow).toContain("actions/upload-artifact@v6");
    expect(workflow).toContain("actions/download-artifact@v7");
    expect(workflow).toContain("nightly-${short_sha}");
    expect(workflow).toContain("--generate-notes");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("gh release upload");
  });
});
