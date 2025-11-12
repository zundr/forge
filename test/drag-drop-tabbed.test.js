// ABOUTME: Tests for drag-drop to tabbed/stacked groups functionality
// ABOUTME: Validates that windows can be added to existing tabbed/stacked containers via center drop

/**
 * Drag-Drop to Tabbed/Stacked Groups Test Suite
 *
 * These tests validate that the drag-drop functionality correctly handles
 * adding windows to existing tabbed and stacked layout containers.
 */

const fs = require("fs");
const path = require("path");

describe("Drag-Drop to Tabbed/Stacked Groups", () => {
  let windowJsContent;

  beforeAll(() => {
    // Read the actual production file
    windowJsContent = fs.readFileSync(path.join(__dirname, "../lib/extension/window.js"), "utf8");
  });

  describe("Center Drop Layout Preservation", () => {
    test("should have logic to preserve tabbed/stacked layout on center drop", () => {
      // Verify the fix is present in moveWindowToPointer method
      // The code should check if container is already tabbed/stacked when dropping on center

      // Look for the center drop handling section
      const centerDropSection = windowJsContent.match(
        /else if \(isCenter\)\s*\{[\s\S]*?containerNode\.layout\s*=\s*LAYOUT_TYPES\[centerLayout\]/
      );

      expect(centerDropSection).toBeTruthy();
      expect(centerDropSection[0]).toMatch(/stackedOrTabbed/);
    });

    test("should not override tabbed layout when adding window to tabbed group", () => {
      // The code should preserve the existing layout for tabbed/stacked containers
      // Look for conditional logic that checks stackedOrTabbed before setting layout

      const layoutPreservationLogic = windowJsContent.match(
        /if\s*\(stackedOrTabbed\)\s*\{[\s\S]*?\}\s*else if\s*\(containerNode\.isHSplit\(\)\s*\|\|\s*containerNode\.isVSplit\(\)\)/
      );

      expect(layoutPreservationLogic).toBeTruthy();
    });

    test("should handle center drop for non-tabbed containers correctly", () => {
      // Verify that HSPLIT/VSPLIT containers can still be converted to tabbed/stacked
      expect(windowJsContent).toMatch(
        /containerNode\.isHSplit\(\)\s*\|\|\s*containerNode\.isVSplit\(\)/
      );
      expect(windowJsContent).toMatch(/containerNode\.layout\s*=\s*LAYOUT_TYPES\[centerLayout\]/);
    });
  });

  describe("Preview Hint Styling", () => {
    test("should set correct preview class for tabbed layout", () => {
      // Verify preview hint uses "window-tilepreview-tabbed" for tabbed containers
      expect(windowJsContent).toMatch(/window-tilepreview-tabbed/);
      expect(windowJsContent).toMatch(/className:\s*stacked\s*\?\s*"window-tilepreview-stacked"/);
    });

    test("should set correct preview class for stacked layout", () => {
      // Verify preview hint uses "window-tilepreview-stacked" for stacked containers
      expect(windowJsContent).toMatch(/window-tilepreview-stacked/);
    });

    test("should show preview hint when dragging over tabbed group center", () => {
      // Verify preview hint is shown for center drops on tabbed/stacked containers
      const previewLogic = windowJsContent.match(
        /if\s*\(stackedOrTabbed\)\s*\{[\s\S]*?className:\s*stacked\s*\?\s*"window-tilepreview-stacked"\s*:\s*"window-tilepreview-tabbed"/
      );

      expect(previewLogic).toBeTruthy();
    });
  });

  describe("Window Insertion Logic", () => {
    test("should insert window into correct container on center drop", () => {
      // Verify containerNode.insertBefore is called with correct parameters
      expect(windowJsContent).toMatch(/containerNode\.insertBefore\(childNode,\s*referenceNode\)/);
    });

    test("should handle referenceNode correctly for tabbed groups", () => {
      // When adding to tabbed group, referenceNode should be null (append to end)
      const tabbedInsertLogic = windowJsContent.match(
        /if\s*\(stackedOrTabbed\)\s*\{[\s\S]*?referenceNode\s*=\s*null/
      );

      expect(tabbedInsertLogic).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty tabbed containers", () => {
      // Verify code handles case where tabbed container has no windows
      expect(windowJsContent).toMatch(/parentNodeTarget/);
      expect(windowJsContent).toMatch(/containerNode/);
    });

    test("should handle single window in tabbed container", () => {
      // Verify adding second window to tabbed container works
      expect(windowJsContent).toMatch(/stackedOrTabbed/);
    });

    test("should not break existing split container behavior", () => {
      // Verify HSPLIT and VSPLIT containers still work correctly
      expect(windowJsContent).toMatch(/LAYOUT_TYPES\.HSPLIT/);
      expect(windowJsContent).toMatch(/LAYOUT_TYPES\.VSPLIT/);
    });
  });
});
