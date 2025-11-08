/**
 * Production Code Validation Test Suite
 *
 * These tests validate that the actual production code contains the proper
 * null checks and error handling that were added to fix the identified bugs.
 */

const fs = require("fs");
const path = require("path");

describe("Production Code Bug Fix Validation", () => {
  let windowJsContent;
  let treeJsContent;

  beforeAll(() => {
    // Read the actual production files
    windowJsContent = fs.readFileSync(path.join(__dirname, "../lib/extension/window.js"), "utf8");
    treeJsContent = fs.readFileSync(path.join(__dirname, "../lib/extension/tree.js"), "utf8");
  });

  describe("Move Command Null Check Fix", () => {
    test("should have null checks for focusNodeWindow and parentNode in Move command", () => {
      // Verify the fix is present in the actual code
      expect(windowJsContent).toMatch(/focusNodeWindow\s*&&\s*focusNodeWindow\.parentNode/);
      expect(windowJsContent).toMatch(
        /focusNodeWindow\.parentNode\.layout\s*===\s*LAYOUT_TYPES\.STACKED/
      );
    });

    test("should have null checks for tabbed layout handling", () => {
      expect(windowJsContent).toMatch(
        /focusNodeWindow\s*&&\s*focusNodeWindow\.parentNode\s*&&\s*focusNodeWindow\.parentNode\.layout\s*===\s*LAYOUT_TYPES\.TABBED/
      );
    });
  });

  describe("Float Command Null Check Fix", () => {
    test("should have null check for focusWindow in FloatToggle commands", () => {
      // Verify the fix is present
      expect(windowJsContent).toMatch(/if\s*\(\s*!\s*focusWindow\s*\)/);
      expect(windowJsContent).toMatch(
        /FloatClassToggle:\s*No\s*focused\s*window,\s*ignoring\s*command/
      );
    });
  });

  describe("Actor Insertion Fix", () => {
    test("should validate focusActor before insertion in updateDecorationLayout", () => {
      // Verify focusActor validation is present
      expect(windowJsContent).toMatch(/focusActor\s*&&\s*focusActor\.get_stage\(\)\s*!==\s*null/);
    });
  });

  describe("Decoration Disposal Fix", () => {
    test("should clean decoration when CON node is removed", () => {
      // Verify decoration cleanup is present in removeChild
      expect(treeJsContent).toMatch(/node\.isCon\(\)\s*&&\s*node\.decoration/);
      expect(treeJsContent).toMatch(/global\.window_group\.remove_child\(node\.decoration\)/);
      expect(treeJsContent).toMatch(/node\.decoration\.destroy\(\)/);
    });

    test("should have emergency cleanup command", () => {
      // Verify NukeOrphanedDecorations command exists
      expect(windowJsContent).toMatch(/case\s+"NukeOrphanedDecorations":/);
      expect(windowJsContent).toMatch(/child\.type\s*===\s*"forge-deco"/);
    });
  });
});
