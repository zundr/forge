// ABOUTME: Tests for workspace configuration separation from window overrides
// ABOUTME: Verifies that workspace rules use separate config file (workspaces.json)

const fs = require("fs");
const path = require("path");

describe("Workspace Config Separation", () => {
  const rootDir = path.join(__dirname, "..");
  const settingsPath = path.join(rootDir, "lib/shared/settings.js");
  const workspacePath = path.join(rootDir, "lib/prefs/workspace.js");
  const windowPath = path.join(rootDir, "lib/extension/window.js");
  const keybindingsPath = path.join(rootDir, "lib/extension/keybindings.js");
  const schemaPath = path.join(rootDir, "schemas/org.gnome.shell.extensions.forge.gschema.xml");
  const defaultConfigPath = path.join(rootDir, "config/workspaces.json");

  describe("Default config file", () => {
    test("workspaces.json exists in config directory", () => {
      expect(fs.existsSync(defaultConfigPath)).toBe(true);
    });

    test("workspaces.json has rules array structure", () => {
      const content = JSON.parse(fs.readFileSync(defaultConfigPath, "utf8"));
      expect(content).toHaveProperty("rules");
      expect(Array.isArray(content.rules)).toBe(true);
    });
  });

  describe("ConfigManager", () => {
    let settingsContent;

    beforeAll(() => {
      settingsContent = fs.readFileSync(settingsPath, "utf8");
    });

    test("has workspaceProps getter", () => {
      expect(settingsContent).toContain("get workspaceProps()");
    });

    test("has workspaceProps setter", () => {
      expect(settingsContent).toContain("set workspaceProps(props)");
    });

    test("has defaultWorkspaceConfigFile getter", () => {
      expect(settingsContent).toContain("get defaultWorkspaceConfigFile()");
    });

    test("has workspaceConfigFile getter", () => {
      expect(settingsContent).toContain("get workspaceConfigFile()");
    });

    test("loads workspaces.json file", () => {
      expect(settingsContent).toContain("workspaces.json");
    });
  });

  describe("WorkspacePage", () => {
    let workspaceContent;

    beforeAll(() => {
      workspaceContent = fs.readFileSync(workspacePath, "utf8");
    });

    test("uses workspaceProps instead of windowProps", () => {
      expect(workspaceContent).toContain("workspaceProps");
      // Should not use windowProps for workspace rules
      expect(workspaceContent).not.toContain("windowProps.overrides");
    });

    test("has help label explaining matching", () => {
      expect(workspaceContent).toContain("Rules match windows by Class");
    });

    test("has reorganize button", () => {
      expect(workspaceContent).toContain("Reorganize Windows");
    });

    test("triggers workspace-reorganize-trigger setting", () => {
      expect(workspaceContent).toContain("workspace-reorganize-trigger");
    });

    test("uses workspace-rules-reload-trigger setting", () => {
      expect(workspaceContent).toContain("workspace-rules-reload-trigger");
    });
  });

  describe("WindowManager", () => {
    let windowContent;

    beforeAll(() => {
      windowContent = fs.readFileSync(windowPath, "utf8");
    });

    test("has reloadWorkspaceRules method", () => {
      expect(windowContent).toContain("reloadWorkspaceRules()");
    });

    test("initializes workspaceRules in constructor", () => {
      expect(windowContent).toContain("this.reloadWorkspaceRules()");
    });

    test("getWorkspacePlacementRule uses workspaceRules", () => {
      expect(windowContent).toContain("this.workspaceRules");
    });

    test("has ReorganizeWorkspaces command", () => {
      expect(windowContent).toContain('case "ReorganizeWorkspaces"');
    });

    test("has reorganizeWindowsByWorkspaceRules method", () => {
      expect(windowContent).toContain("reorganizeWindowsByWorkspaceRules()");
    });

    test("listens for workspace-rules-reload-trigger", () => {
      expect(windowContent).toContain('case "workspace-rules-reload-trigger"');
    });

    test("listens for workspace-reorganize-trigger", () => {
      expect(windowContent).toContain('case "workspace-reorganize-trigger"');
    });
  });

  describe("Keybindings", () => {
    let keybindingsContent;

    beforeAll(() => {
      keybindingsContent = fs.readFileSync(keybindingsPath, "utf8");
    });

    test("has workspace-reorganize keybinding", () => {
      expect(keybindingsContent).toContain('"workspace-reorganize"');
    });

    test("workspace-reorganize triggers ReorganizeWorkspaces command", () => {
      expect(keybindingsContent).toContain('name: "ReorganizeWorkspaces"');
    });
  });

  describe("GSettings Schema", () => {
    let schemaContent;

    beforeAll(() => {
      schemaContent = fs.readFileSync(schemaPath, "utf8");
    });

    test("has workspace-rules-reload-trigger setting", () => {
      expect(schemaContent).toContain('name="workspace-rules-reload-trigger"');
    });

    test("has workspace-reorganize-trigger setting", () => {
      expect(schemaContent).toContain('name="workspace-reorganize-trigger"');
    });

    test("has workspace-reorganize keybinding", () => {
      expect(schemaContent).toContain('name="workspace-reorganize"');
    });
  });
});
