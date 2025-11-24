const {
  formatTree,
  formatNode,
  getPrefix,
  formatAttributes,
} = require("../lib/cli/tree-formatter");

describe("Tree Formatter", () => {
  describe("getPrefix", () => {
    it("should return empty string for root node", () => {
      const result = getPrefix(0, false, []);
      expect(result).toBe("");
    });

    it("should return └── for last child at depth 1", () => {
      const result = getPrefix(1, true, []);
      expect(result).toBe("└── ");
    });

    it("should return ├── for non-last child at depth 1", () => {
      const result = getPrefix(1, false, []);
      expect(result).toBe("├── ");
    });

    it("should handle nested levels with proper indentation", () => {
      const result = getPrefix(2, false, [false]);
      expect(result).toBe("│   ├── ");
    });

    it("should handle nested levels with last child", () => {
      const result = getPrefix(2, true, [true]);
      expect(result).toBe("    └── ");
    });
  });

  describe("formatAttributes", () => {
    it("should format window attributes with class, title, and id", () => {
      const node = {
        nodeType: "WINDOW",
        nodeValue: {
          get_wm_class: () => "firefox",
          get_title: () => "Mozilla Firefox",
          get_id: () => 12345,
        },
        mode: "TILE",
      };
      const result = formatAttributes(node, {});
      expect(result).toContain("class:firefox");
      expect(result).toContain('title:"Mozilla Firefox"');
      expect(result).toContain("id:12345");
    });

    it("should format container attributes with layout", () => {
      const node = {
        nodeType: "CON",
        nodeValue: "container1",
        layout: "HSPLIT",
      };
      const result = formatAttributes(node, {});
      expect(result).toContain("[HSPLIT]");
    });

    it("should include mode when --mode flag is set", () => {
      const node = {
        nodeType: "WINDOW",
        nodeValue: {
          get_wm_class: () => "firefox",
          get_title: () => "Firefox",
          get_id: () => 12345,
        },
        mode: "TILE",
      };
      const result = formatAttributes(node, { mode: true });
      expect(result).toContain("mode:TILE");
    });

    it("should include rect when --rect flag is set", () => {
      const node = {
        nodeType: "WINDOW",
        nodeValue: {
          get_wm_class: () => "firefox",
          get_title: () => "Firefox",
          get_id: () => 12345,
        },
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
      };
      const result = formatAttributes(node, { rect: true });
      expect(result).toContain("rect:1920x1080+0+0");
    });

    it("should include all attributes when --verbose flag is set", () => {
      const node = {
        nodeType: "WINDOW",
        nodeValue: {
          get_wm_class: () => "firefox",
          get_title: () => "Firefox",
          get_id: () => 12345,
        },
        mode: "TILE",
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
      };
      const result = formatAttributes(node, { verbose: true });
      expect(result).toContain("mode:TILE");
      expect(result).toContain("rect:1920x1080+0+0");
    });
  });

  describe("formatNode", () => {
    it("should format root node", () => {
      const node = {
        nodeType: "ROOT",
        childNodes: [],
      };
      const result = formatNode(node, 0, false, {});
      expect(result).toBe("ROOT");
    });

    it("should format workspace node", () => {
      const node = {
        nodeType: "WORKSPACE",
        nodeValue: "ws0",
        childNodes: [],
      };
      const result = formatNode(node, 1, true, {});
      expect(result).toBe("└── WORKSPACE ws0");
    });

    it("should format monitor node with layout", () => {
      const node = {
        nodeType: "MONITOR",
        nodeValue: "mo0ws0",
        layout: "HSPLIT",
        childNodes: [],
      };
      const result = formatNode(node, 2, false, {});
      expect(result).toContain("MONITOR mo0ws0 [HSPLIT]");
    });

    it("should format window node with attributes", () => {
      const node = {
        nodeType: "WINDOW",
        nodeValue: {
          get_wm_class: () => "firefox",
          get_title: () => "Firefox",
          get_id: () => 12345,
        },
        mode: "TILE",
        childNodes: [],
      };
      const result = formatNode(node, 3, true, {});
      expect(result).toContain("WINDOW");
      expect(result).toContain("class:firefox");
      expect(result).toContain('title:"Firefox"');
      expect(result).toContain("id:12345");
    });
  });

  describe("formatTree", () => {
    it("should format simple tree with one window", () => {
      const tree = {
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
                    nodeValue: {
                      get_wm_class: () => "test",
                      get_title: () => "Test Window",
                      get_id: () => 12345,
                    },
                    mode: "TILE",
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = formatTree(tree, {});
      expect(result).toContain("ROOT");
      expect(result).toContain("WORKSPACE ws0");
      expect(result).toContain("MONITOR mo0ws0");
      expect(result).toContain("WINDOW");
      expect(result).toContain("class:test");
    });

    it("should format tree with multiple windows", () => {
      const tree = {
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
                    nodeValue: {
                      get_wm_class: () => "firefox",
                      get_title: () => "Firefox",
                      get_id: () => 12345,
                    },
                    mode: "TILE",
                    childNodes: [],
                  },
                  {
                    nodeType: "WINDOW",
                    nodeValue: {
                      get_wm_class: () => "terminal",
                      get_title: () => "Terminal",
                      get_id: () => 12346,
                    },
                    mode: "TILE",
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = formatTree(tree, {});
      expect(result).toContain("├── WINDOW");
      expect(result).toContain("└── WINDOW");
      expect(result).toContain("class:firefox");
      expect(result).toContain("class:terminal");
    });

    it("should format tree with nested containers", () => {
      const tree = {
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
                    nodeValue: {
                      get_wm_class: () => "firefox",
                      get_title: () => "Firefox",
                      get_id: () => 12345,
                    },
                    mode: "TILE",
                    childNodes: [],
                  },
                  {
                    nodeType: "CON",
                    nodeValue: "container1",
                    layout: "VSPLIT",
                    childNodes: [
                      {
                        nodeType: "WINDOW",
                        nodeValue: {
                          get_wm_class: () => "terminal",
                          get_title: () => "Terminal",
                          get_id: () => 12346,
                        },
                        mode: "TILE",
                        childNodes: [],
                      },
                      {
                        nodeType: "WINDOW",
                        nodeValue: {
                          get_wm_class: () => "code",
                          get_title: () => "VSCode",
                          get_id: () => 12347,
                        },
                        mode: "TILE",
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
      const result = formatTree(tree, {});
      expect(result).toContain("CON [VSPLIT]");
      expect(result).toContain("class:firefox");
      expect(result).toContain("class:terminal");
      expect(result).toContain("class:code");
    });

    it("should format tree with multiple workspaces", () => {
      const tree = {
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
                    nodeValue: {
                      get_wm_class: () => "firefox",
                      get_title: () => "Firefox",
                      get_id: () => 12345,
                    },
                    mode: "TILE",
                    childNodes: [],
                  },
                ],
              },
            ],
          },
          {
            nodeType: "WORKSPACE",
            nodeValue: "ws1",
            childNodes: [
              {
                nodeType: "MONITOR",
                nodeValue: "mo0ws1",
                layout: "HSPLIT",
                childNodes: [
                  {
                    nodeType: "WINDOW",
                    nodeValue: {
                      get_wm_class: () => "chrome",
                      get_title: () => "Chrome",
                      get_id: () => 12346,
                    },
                    mode: "TILE",
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = formatTree(tree, {});
      expect(result).toContain("├── WORKSPACE ws0");
      expect(result).toContain("└── WORKSPACE ws1");
      expect(result).toContain("class:firefox");
      expect(result).toContain("class:chrome");
    });

    it("should format empty tree", () => {
      const tree = {
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
      const result = formatTree(tree, {});
      expect(result).toContain("ROOT");
      expect(result).toContain("WORKSPACE ws0");
      expect(result).toContain("MONITOR mo0ws0");
    });

    it("should include verbose information when --verbose flag is set", () => {
      const tree = {
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
                rect: { x: 0, y: 0, width: 1920, height: 1080 },
                childNodes: [
                  {
                    nodeType: "WINDOW",
                    nodeValue: {
                      get_wm_class: () => "firefox",
                      get_title: () => "Firefox",
                      get_id: () => 12345,
                    },
                    mode: "TILE",
                    rect: { x: 0, y: 0, width: 960, height: 1080 },
                    childNodes: [],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = formatTree(tree, { verbose: true });
      expect(result).toContain("mode:TILE");
      expect(result).toContain("rect:960x1080+0+0");
      expect(result).toContain("rect:1920x1080+0+0");
    });
  });
});
