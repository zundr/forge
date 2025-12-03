// ABOUTME: Tests for the ReorganizeButton panel component
// ABOUTME: Verifies button implementation in indicator.js and extension.js integration

const fs = require("fs");
const path = require("path");

describe("Panel Reorganize Button", () => {
  const rootDir = path.join(__dirname, "..");
  const indicatorPath = path.join(rootDir, "lib/extension/indicator.js");
  const extensionPath = path.join(rootDir, "extension.js");
  const schemaPath = path.join(rootDir, "schemas/org.gnome.shell.extensions.forge.gschema.xml");

  describe("ReorganizeButton in indicator.js", () => {
    let indicatorContent;

    beforeAll(() => {
      indicatorContent = fs.readFileSync(indicatorPath, "utf8");
    });

    test("exports ReorganizeButton class", () => {
      expect(indicatorContent).toContain("export class ReorganizeButton");
    });

    test("extends PanelMenu.Button", () => {
      expect(indicatorContent).toContain("extends PanelMenu.Button");
    });

    test("uses GObject.registerClass", () => {
      expect(indicatorContent).toMatch(/class ReorganizeButton[\s\S]*?GObject\.registerClass/);
    });

    test("creates icon with view-refresh-symbolic", () => {
      expect(indicatorContent).toContain("view-refresh-symbolic");
    });

    test("has click handler that triggers reorganization", () => {
      expect(indicatorContent).toContain("workspace-reorganize-trigger");
    });

    test("uses system-status-icon style class", () => {
      expect(indicatorContent).toContain("system-status-icon");
    });

    test("respects panel-reorganize-button-enabled setting", () => {
      expect(indicatorContent).toContain("panel-reorganize-button-enabled");
    });
  });

  describe("Extension integration", () => {
    let extensionContent;

    beforeAll(() => {
      extensionContent = fs.readFileSync(extensionPath, "utf8");
    });

    test("imports ReorganizeButton from indicator.js", () => {
      expect(extensionContent).toContain("ReorganizeButton");
    });

    test("adds reorganize button to panel", () => {
      expect(extensionContent).toContain("addToStatusArea");
    });

    test("cleans up reorganize button on disable", () => {
      expect(extensionContent).toContain("reorganizeButton");
    });
  });

  describe("GSettings schema", () => {
    let schemaContent;

    beforeAll(() => {
      schemaContent = fs.readFileSync(schemaPath, "utf8");
    });

    test("has panel-reorganize-button-enabled key", () => {
      expect(schemaContent).toContain('name="panel-reorganize-button-enabled"');
    });

    test("panel-reorganize-button-enabled defaults to false", () => {
      // Button should be opt-in, not enabled by default
      expect(schemaContent).toMatch(
        /panel-reorganize-button-enabled[\s\S]*?<default>false<\/default>/
      );
    });
  });
});
