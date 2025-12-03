/**
 * Tests for tree condensing feature
 * Verifies that redundant nested containers are condensed unless explicitly created
 */

const { describe, it, expect, beforeEach } = require("@jest/globals");

describe("Tree Condensing", () => {
  let mockTree;
  let mockSettings;

  beforeEach(() => {
    // Mock settings
    mockSettings = {
      get_boolean: (key) => {
        if (key === "condense-redundant-containers") return true;
        return false;
      },
    };

    // Create mock tree structure with redundant nesting
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
                  layout: "HSPLIT", // Redundant: same as parent
                  explicitSplit: false,
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

  it("should condense redundant HSPLIT → HSPLIT containers", () => {
    // Given: MONITOR [HSPLIT] → CON [HSPLIT] → 2 windows
    const monitor = mockTree.childNodes[0].childNodes[0];
    const redundantCon = monitor.childNodes[0];

    expect(monitor.layout).toBe("HSPLIT");
    expect(redundantCon.layout).toBe("HSPLIT");
    expect(redundantCon.childNodes.length).toBe(2);

    // When: condensing is applied
    const condensed = condenseRedundantContainers(monitor, mockSettings);

    // Then: CON should be removed, windows moved to MONITOR
    expect(condensed).toBe(true);
    expect(monitor.childNodes.length).toBe(2);
    expect(monitor.childNodes[0].nodeType).toBe("WINDOW");
    expect(monitor.childNodes[1].nodeType).toBe("WINDOW");
  });

  it("should NOT condense explicit splits", () => {
    // Given: Explicit split container
    const monitor = mockTree.childNodes[0].childNodes[0];
    const explicitCon = monitor.childNodes[0];
    explicitCon.explicitSplit = true;

    // When: condensing is applied
    const condensed = condenseRedundantContainers(monitor, mockSettings);

    // Then: Container should be preserved
    expect(condensed).toBe(false);
    expect(monitor.childNodes.length).toBe(1);
    expect(monitor.childNodes[0].nodeType).toBe("CON");
  });

  it("should NOT condense different layout types", () => {
    // Given: HSPLIT → VSPLIT (different layouts)
    const monitor = mockTree.childNodes[0].childNodes[0];
    const differentCon = monitor.childNodes[0];
    differentCon.layout = "VSPLIT";

    // When: condensing is applied
    const condensed = condenseRedundantContainers(monitor, mockSettings);

    // Then: Container should be preserved
    expect(condensed).toBe(false);
    expect(monitor.childNodes.length).toBe(1);
    expect(monitor.childNodes[0].layout).toBe("VSPLIT");
  });

  it("should NOT condense when setting is disabled", () => {
    // Given: Setting disabled
    mockSettings.get_boolean = () => false;
    const monitor = mockTree.childNodes[0].childNodes[0];

    // When: condensing is applied
    const condensed = condenseRedundantContainers(monitor, mockSettings);

    // Then: Nothing should change
    expect(condensed).toBe(false);
    expect(monitor.childNodes.length).toBe(1);
    expect(monitor.childNodes[0].nodeType).toBe("CON");
  });
});

/**
 * Mock implementation of condensing logic
 * This will be replaced with actual implementation in tree.js
 */
function condenseRedundantContainers(parentNode, settings) {
  if (!settings.get_boolean("condense-redundant-containers")) {
    return false;
  }

  let condensed = false;

  for (let i = parentNode.childNodes.length - 1; i >= 0; i--) {
    const child = parentNode.childNodes[i];

    if (child.nodeType === "CON" && child.layout === parentNode.layout && !child.explicitSplit) {
      // Move child's children to parent
      const grandchildren = [...child.childNodes];
      parentNode.childNodes.splice(i, 1); // Remove redundant container

      grandchildren.forEach((grandchild) => {
        parentNode.childNodes.push(grandchild);
      });

      condensed = true;
    }
  }

  return condensed;
}
