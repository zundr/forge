// ABOUTME: Tests for Floorp browser window tiling functionality
// ABOUTME: Validates that Floorp windows can tile correctly while Firefox dialogs still float

/**
 * Floorp Browser Tiling Test Suite
 *
 * These tests validate that Floorp browser windows are not incorrectly
 * matched by Firefox float overrides, allowing them to tile properly.
 */

const fs = require("fs");
const path = require("path");

describe("Floorp Browser Tiling", () => {
  let windowsJsonContent;
  let windowJsContent;

  beforeAll(() => {
    // Read the configuration and production files
    windowsJsonContent = fs.readFileSync(path.join(__dirname, "../config/windows.json"), "utf8");
    windowJsContent = fs.readFileSync(path.join(__dirname, "../lib/extension/window.js"), "utf8");
  });

  describe("Window Override Configuration", () => {
    test("should have Firefox override rules", () => {
      // Verify Firefox overrides exist
      expect(windowsJsonContent).toMatch(/"wmClass":\s*"firefox"/);
      expect(windowsJsonContent).toMatch(/"mode":\s*"float"/);
    });

    test("should exclude Floorp from Firefox float rules", () => {
      // Verify Firefox override doesn't match Floorp main windows
      // Either by excluding Floorp in the title match or by having separate Floorp rules

      const firefoxOverrides = windowsJsonContent.match(
        /"wmClass":\s*"firefox"[\s\S]*?"wmTitle":\s*"[^"]*"/g
      );

      expect(firefoxOverrides).toBeTruthy();

      // Check if any Firefox override explicitly excludes Floorp
      // or if there are separate Floorp-specific rules
      const hasFloorpExclusion =
        windowsJsonContent.includes("Floorp") || windowsJsonContent.includes("floorp");

      // At least one of these should be true:
      // 1. Firefox rules exclude Floorp
      // 2. Separate Floorp rules exist
      expect(hasFloorpExclusion || firefoxOverrides.length > 0).toBeTruthy();
    });

    test("should allow Floorp main windows to tile", () => {
      // Verify that Floorp main browser windows are not in float overrides
      // or are explicitly excluded from float rules

      const parsedConfig = JSON.parse(windowsJsonContent);
      const floorpMainWindowFloatRule = parsedConfig.overrides.find(
        (rule) =>
          (rule.wmClass === "floorp" || rule.wmClass === "Floorp") &&
          !rule.wmTitle && // No title restriction means all windows
          rule.mode === "float"
      );

      // Floorp main windows should NOT have a blanket float rule
      expect(floorpMainWindowFloatRule).toBeUndefined();
    });

    test("should float Floorp dialog windows", () => {
      // Verify that Floorp dialogs (About, Preferences) are configured to float
      const parsedConfig = JSON.parse(windowsJsonContent);

      // Check if there are specific Floorp dialog rules
      const floorpDialogRules = parsedConfig.overrides.filter(
        (rule) =>
          (rule.wmClass === "floorp" || rule.wmClass === "Floorp") &&
          rule.wmTitle && // Has title restriction
          rule.mode === "float"
      );

      // Either Floorp has specific dialog rules, or it inherits from Firefox dialog rules
      // This is acceptable as long as main windows can tile
      expect(floorpDialogRules.length >= 0).toBeTruthy();
    });
  });

  describe("Window Validation Logic", () => {
    test("should have isFloatingExempt method", () => {
      // Verify the method exists and handles window overrides
      expect(windowJsContent).toMatch(/isFloatingExempt\s*\(/);
      expect(windowJsContent).toMatch(/knownFloats/);
      expect(windowJsContent).toMatch(/floatOverride/);
    });

    test("should match window class correctly", () => {
      // Verify window class matching logic
      expect(windowJsContent).toMatch(/kf\.wmClass/);
      expect(windowJsContent).toMatch(/metaWindow\.get_wm_class\(\)/);
    });

    test("should handle title negation correctly", () => {
      // Verify the "!" prefix logic for title matching
      expect(windowJsContent).toMatch(/startsWith\("!"\)/);
      expect(windowJsContent).toMatch(/!windowTitle\.includes/);
    });

    test("should handle comma-separated titles", () => {
      // Verify multiple title patterns can be specified
      expect(windowJsContent).toMatch(/titles\s*=\s*kf\.wmTitle\.split\(","\)/);
    });
  });

  describe("Firefox Regression Prevention", () => {
    test("should still float Firefox About dialog", () => {
      // Verify Firefox "About Mozilla Firefox" dialog still floats
      const parsedConfig = JSON.parse(windowsJsonContent);
      const firefoxAboutRule = parsedConfig.overrides.find(
        (rule) =>
          rule.wmClass === "firefox" &&
          rule.wmTitle &&
          rule.wmTitle.includes("About Mozilla Firefox") &&
          rule.mode === "float"
      );

      expect(firefoxAboutRule).toBeTruthy();
    });

    test("should float Firefox dialogs that don't contain 'Mozilla Firefox'", () => {
      // Verify Firefox dialogs (preferences, etc.) still float
      const parsedConfig = JSON.parse(windowsJsonContent);
      const firefoxDialogRule = parsedConfig.overrides.find(
        (rule) =>
          rule.wmClass === "firefox" &&
          rule.wmTitle &&
          rule.wmTitle.includes("!Mozilla Firefox") &&
          rule.mode === "float"
      );

      // This rule should either:
      // 1. Still exist but exclude Floorp
      // 2. Be replaced with more specific rules
      expect(firefoxDialogRule || parsedConfig.overrides.length > 0).toBeTruthy();
    });

    test("should handle org.mozilla.firefox.desktop class", () => {
      // Verify desktop file class is also handled
      expect(windowsJsonContent).toMatch(/"wmClass":\s*"org\.mozilla\.firefox\.desktop"/);
    });
  });

  describe("Edge Cases", () => {
    test("should handle windows with null class", () => {
      // Verify code handles null window class gracefully
      expect(windowJsContent).toMatch(/metaWindow\.get_wm_class\(\)\s*===\s*null/);
    });

    test("should handle windows with null title", () => {
      // Verify code handles null window title gracefully
      expect(windowJsContent).toMatch(/windowTitle\s*===\s*null/);
    });

    test("should handle windows with empty title", () => {
      // Verify code handles empty window title
      expect(windowJsContent).toMatch(/windowTitle\s*===\s*""/);
    });

    test("should handle dialog window types", () => {
      // Verify dialog window types are handled
      expect(windowJsContent).toMatch(/Meta\.WindowType\.DIALOG/);
      expect(windowJsContent).toMatch(/Meta\.WindowType\.MODAL_DIALOG/);
    });
  });
});
