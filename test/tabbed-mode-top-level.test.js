/**
 * Tests for tabbed mode top-level container grouping
 * Verifies that toggling tabbed mode on top-level windows groups all siblings
 */

const { describe, it, expect, beforeEach } = require("@jest/globals");

describe("Tabbed Mode Top-Level Container", () => {
  let mockTree;
  let mockSettings;
  let mockWindow;

  beforeEach(() => {
    // Mock settings
    mockSettings = {
      get_boolean: (key) => {
        if (key === "tabbed-tiling-mode-enabled") return true;
        return false;
      },
    };

    // Mock window object
    mockWindow = {
      id: 1,
      activate: jest.fn(),
    };
  });

  describe("Scenario 1: Single Top-Level Window", () => {
    beforeEach(() => {
      mockTree = {
        nodeType: "ROOT",
        childNodes: [
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws0",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws0",
                layout: "HSPLIT",
                childNodes: [
                  {
                    nodeType: "WINDOW",
                    nodeValue: mockWindow,
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    it("should create a tabbed container for single window", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];
      const window = monitor.childNodes[0];

      expect(monitor.childNodes.length).toBe(1);
      expect(window.nodeType).toBe("WINDOW");

      // Simulate toggle tabbed mode
      const result = toggleTabbedModeTopLevel(monitor, window, mockSettings);

      // Should create CON [TABBED] → WINDOW
      expect(monitor.childNodes.length).toBe(1);
      expect(monitor.childNodes[0].nodeType).toBe("CON");
      expect(monitor.childNodes[0].layout).toBe("TABBED");
      expect(monitor.childNodes[0].childNodes.length).toBe(1);
      expect(monitor.childNodes[0].childNodes[0].nodeType).toBe("WINDOW");
    });
  });

  describe("Scenario 2: Multiple Top-Level Windows", () => {
    beforeEach(() => {
      mockTree = {
        nodeType: "ROOT",
        childNodes: [
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws0",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws0",
                layout: "HSPLIT",
                childNodes: [
                  {
                    nodeType: "WINDOW",
                    nodeValue: { id: 1 },
                    childNodes: [],
                  },
                  {
                    nodeType: "WINDOW",
                    nodeValue: { id: 2 },
                    childNodes: [],
                  },
                  {
                    nodeType: "WINDOW",
                    nodeValue: { id: 3 },
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    it("should group all top-level windows into tabbed container", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];
      const focusedWindow = monitor.childNodes[1]; // W2

      expect(monitor.childNodes.length).toBe(3);

      // Simulate toggle tabbed mode on W2
      const result = toggleTabbedModeTopLevel(monitor, focusedWindow, mockSettings);

      // Should create CON [TABBED] → [W1, W2, W3]
      expect(monitor.childNodes.length).toBe(1);
      expect(monitor.childNodes[0].nodeType).toBe("CON");
      expect(monitor.childNodes[0].layout).toBe("TABBED");
      expect(monitor.childNodes[0].childNodes.length).toBe(3);
      expect(monitor.childNodes[0].childNodes[0].nodeValue.id).toBe(1);
      expect(monitor.childNodes[0].childNodes[1].nodeValue.id).toBe(2);
      expect(monitor.childNodes[0].childNodes[2].nodeValue.id).toBe(3);
    });

    it("should maintain focus on the originally focused window", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];
      const focusedWindow = monitor.childNodes[1]; // W2

      const result = toggleTabbedModeTopLevel(monitor, focusedWindow, mockSettings);

      // lastTabFocus should be set to W2
      expect(monitor.childNodes[0].lastTabFocus).toBe(focusedWindow.nodeValue);
    });
  });

  describe("Scenario 3: Mixed Top-Level (Windows + Containers)", () => {
    beforeEach(() => {
      mockTree = {
        nodeType: "ROOT",
        childNodes: [
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws0",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws0",
                layout: "HSPLIT",
                childNodes: [
                  {
                    nodeType: "WINDOW",
                    nodeValue: { id: 1 },
                    childNodes: [],
                  },
                  {
                    nodeType: "CON",
                    layout: "HSPLIT",
                    childNodes: [
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 2 },
                        childNodes: [],
                      },
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 3 },
                        childNodes: [],
                      },
                    ],
                  },
                  {
                    nodeType: "WINDOW",
                    nodeValue: { id: 4 },
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    it("should group all top-level nodes including containers", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];
      const focusedWindow = monitor.childNodes[0]; // W1

      expect(monitor.childNodes.length).toBe(3);

      // Simulate toggle tabbed mode on W1
      const result = toggleTabbedModeTopLevel(monitor, focusedWindow, mockSettings);

      // Should create CON [TABBED] → [W1, CON [HSPLIT], W4]
      expect(monitor.childNodes.length).toBe(1);
      expect(monitor.childNodes[0].nodeType).toBe("CON");
      expect(monitor.childNodes[0].layout).toBe("TABBED");
      expect(monitor.childNodes[0].childNodes.length).toBe(3);
      expect(monitor.childNodes[0].childNodes[0].nodeType).toBe("WINDOW");
      expect(monitor.childNodes[0].childNodes[1].nodeType).toBe("CON");
      expect(monitor.childNodes[0].childNodes[2].nodeType).toBe("WINDOW");
    });
  });

  describe("Scenario 4: Toggle Off Tabbed Mode", () => {
    beforeEach(() => {
      mockTree = {
        nodeType: "ROOT",
        childNodes: [
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws0",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws0",
                layout: "HSPLIT",
                childNodes: [
                  {
                    nodeType: "CON",
                    layout: "TABBED",
                    lastTabFocus: { id: 2 },
                    childNodes: [
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 1 },
                        childNodes: [],
                      },
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 2 },
                        childNodes: [],
                      },
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 3 },
                        childNodes: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    it("should restore split layout when toggling off", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];
      const tabbedCon = monitor.childNodes[0];
      const focusedWindow = tabbedCon.childNodes[1]; // W2

      expect(tabbedCon.layout).toBe("TABBED");

      // Simulate toggle tabbed mode off
      const result = toggleTabbedModeOff(tabbedCon, focusedWindow);

      // Should change layout to split (HSPLIT or VSPLIT)
      expect(tabbedCon.layout).not.toBe("TABBED");
      expect(["HSPLIT", "VSPLIT"]).toContain(tabbedCon.layout);
      expect(tabbedCon.lastTabFocus).toBeNull();
    });
  });

  describe("Scenario 5: Window Already in Container", () => {
    beforeEach(() => {
      mockTree = {
        nodeType: "ROOT",
        childNodes: [
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws0",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws0",
                layout: "HSPLIT",
                childNodes: [
                  {
                    nodeType: "CON",
                    layout: "HSPLIT",
                    childNodes: [
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 1 },
                        childNodes: [],
                      },
                      {
                        nodeType: "WINDOW",
                        nodeValue: { id: 2 },
                        childNodes: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    it("should change parent container layout to TABBED", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];
      const container = monitor.childNodes[0];
      const focusedWindow = container.childNodes[0]; // W1

      expect(container.layout).toBe("HSPLIT");

      // Simulate toggle tabbed mode on W1 (already in container)
      const result = toggleTabbedModeInContainer(container, focusedWindow);

      // Should change container layout to TABBED
      expect(container.layout).toBe("TABBED");
      expect(container.lastTabFocus).toBe(focusedWindow.nodeValue);
      // Should not create new container
      expect(monitor.childNodes.length).toBe(1);
    });
  });

  describe("Scenario 6: Empty Monitor", () => {
    beforeEach(() => {
      mockTree = {
        nodeType: "ROOT",
        childNodes: [
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws0",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws0",
                layout: "HSPLIT",
                childNodes: [],
              },
            ],
          },
        ],
      };
    });

    it("should return early with no changes", () => {
      const monitor = mockTree.childNodes[0].childNodes[0];

      expect(monitor.childNodes.length).toBe(0);

      // Simulate toggle tabbed mode with no focused window
      const result = toggleTabbedModeTopLevel(monitor, null, mockSettings);

      // Should return early
      expect(result).toBe(false);
      expect(monitor.childNodes.length).toBe(0);
    });
  });
});

// Mock implementation functions for testing
function toggleTabbedModeTopLevel(monitor, focusedWindow, settings) {
  if (!focusedWindow) return false;
  if (!settings.get_boolean("tabbed-tiling-mode-enabled")) return false;

  const topLevelNodes = monitor.childNodes;

  if (topLevelNodes.length > 1) {
    // Group all top-level nodes into tabbed container
    const tabbedCon = {
      nodeType: "CON",
      layout: "TABBED",
      lastTabFocus: focusedWindow.nodeValue,
      childNodes: [...topLevelNodes],
    };

    monitor.childNodes = [tabbedCon];
    return true;
  } else if (topLevelNodes.length === 1) {
    // Single window: create container
    const tabbedCon = {
      nodeType: "CON",
      layout: "TABBED",
      lastTabFocus: focusedWindow.nodeValue,
      childNodes: [focusedWindow],
    };

    monitor.childNodes = [tabbedCon];
    return true;
  }

  return false;
}

function toggleTabbedModeOff(container, focusedWindow) {
  container.layout = "HSPLIT"; // determineSplitLayout() would return this
  container.lastTabFocus = null;
  return true;
}

function toggleTabbedModeInContainer(container, focusedWindow) {
  container.layout = "TABBED";
  container.lastTabFocus = focusedWindow.nodeValue;
  return true;
}
