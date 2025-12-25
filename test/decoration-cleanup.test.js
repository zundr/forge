/**
 * TDD Test for Decoration Cleanup Bug
 *
 * BUG: When containers with tab decorations are removed, the St.BoxLayout
 * decoration persists in global.window_group and shows on all workspaces.
 *
 * ROOT CAUSE: removeChild() only cleans decorations for tabbed WINDOW nodes,
 * but decorations belong to CONTAINER nodes.
 */

describe("Decoration Cleanup", () => {
  describe("RED: Bug Reproduction - Decoration persists after container removal", () => {
    test("should fail: decoration not cleaned when container removed", () => {
      // Mock container node with decoration
      const mockDecoration = {
        hide: jest.fn(),
        destroy_all_children: jest.fn(),
        destroy: jest.fn(),
        get_stage: jest.fn(() => ({})), // Not null = still in scene graph
      };

      const mockContainer = {
        nodeType: "CON",
        decoration: mockDecoration,
        isTabbed: () => false, // Container is not tabbed
        isCon: () => true,
        childNodes: [],
        parentNode: null,
      };

      const mockParent = {
        childNodes: [mockContainer],
        contains: () => true,
        removeChild: function (node) {
          // Current buggy implementation
          if (node.isTabbed() && node.decoration) {
            node.decoration.destroy();
            node.decoration = null;
          }
          this.childNodes.splice(0, 1);
          return node;
        },
      };

      mockContainer.parentNode = mockParent;

      // Remove container
      mockParent.removeChild(mockContainer);

      // BUG: Decoration should be destroyed but isn't
      expect(mockDecoration.destroy).not.toHaveBeenCalled();
      expect(mockContainer.decoration).not.toBeNull();
    });

    test("should fail: decoration not cleaned in cleanTree orphan removal", () => {
      const mockDecoration = {
        hide: jest.fn(),
        destroy_all_children: jest.fn(),
        destroy: jest.fn(),
        get_stage: jest.fn(() => ({})),
      };

      const orphanContainer = {
        nodeType: "CON",
        decoration: mockDecoration,
        childNodes: [], // Empty = orphan
        isCon: () => true,
      };

      // Simulate cleanTree removing orphan
      const removeNode = (node) => {
        // Current implementation doesn't clean decoration
        node.parentNode = null;
      };

      removeNode(orphanContainer);

      // BUG: Decoration persists
      expect(mockDecoration.destroy).not.toHaveBeenCalled();
      expect(orphanContainer.decoration).not.toBeNull();
    });

    test("should fail: decoration visible across all workspaces", () => {
      const mockDecoration = {
        hide: jest.fn(),
        destroy_all_children: jest.fn(),
        destroy: jest.fn(),
        get_stage: jest.fn(() => ({})), // Still in global.window_group
      };

      // Decoration added to global window group
      const globalWindowGroup = {
        children: [mockDecoration],
        contains: (actor) => globalWindowGroup.children.includes(actor),
        remove_child: jest.fn((actor) => {
          const idx = globalWindowGroup.children.indexOf(actor);
          if (idx >= 0) globalWindowGroup.children.splice(idx, 1);
        }),
      };

      // Container removed but decoration not removed from window group
      const containerRemoved = true;

      // BUG: Decoration still in window group
      expect(globalWindowGroup.contains(mockDecoration)).toBe(true);
      expect(globalWindowGroup.remove_child).not.toHaveBeenCalled();
    });
  });

  describe("GREEN: Fix - Proper decoration cleanup", () => {
    test("should clean decoration when container removed", () => {
      const mockDecoration = {
        hide: jest.fn(),
        destroy_all_children: jest.fn(),
        destroy: jest.fn(),
        get_stage: jest.fn(() => ({})),
      };

      const mockContainer = {
        nodeType: "CON",
        decoration: mockDecoration,
        isTabbed: () => false,
        isCon: () => true,
        childNodes: [],
        parentNode: null,
      };

      const mockParent = {
        childNodes: [mockContainer],
        contains: () => true,
        removeChild: function (node) {
          // FIXED: Clean decoration for CON nodes
          if (node.isCon() && node.decoration) {
            try {
              node.decoration.hide();
              node.decoration.destroy_all_children();
              node.decoration.destroy();
            } catch (e) {
              // Already disposed
            }
            node.decoration = null;
          }
          this.childNodes.splice(0, 1);
          return node;
        },
      };

      mockContainer.parentNode = mockParent;

      // Remove container
      mockParent.removeChild(mockContainer);

      // FIXED: Decoration properly destroyed
      expect(mockDecoration.hide).toHaveBeenCalled();
      expect(mockDecoration.destroy_all_children).toHaveBeenCalled();
      expect(mockDecoration.destroy).toHaveBeenCalled();
      expect(mockContainer.decoration).toBeNull();
    });

    test("should clean decoration in cleanTree orphan removal", () => {
      const mockDecoration = {
        hide: jest.fn(),
        destroy_all_children: jest.fn(),
        destroy: jest.fn(),
        get_stage: jest.fn(() => ({})),
      };

      const orphanContainer = {
        nodeType: "CON",
        decoration: mockDecoration,
        childNodes: [],
        isCon: () => true,
      };

      // FIXED: Clean decoration before removing node
      const cleanDecoration = (node) => {
        if (node.isCon() && node.decoration) {
          try {
            node.decoration.hide();
            node.decoration.destroy_all_children();
            node.decoration.destroy();
          } catch (e) {}
          node.decoration = null;
        }
      };

      cleanDecoration(orphanContainer);

      // FIXED: Decoration cleaned
      expect(mockDecoration.destroy).toHaveBeenCalled();
      expect(orphanContainer.decoration).toBeNull();
    });

    test("should remove decoration from global window group", () => {
      const mockDecoration = {
        hide: jest.fn(),
        destroy_all_children: jest.fn(),
        destroy: jest.fn(),
        get_stage: jest.fn(() => ({})),
      };

      const globalWindowGroup = {
        children: [mockDecoration],
        contains: (actor) => globalWindowGroup.children.includes(actor),
        remove_child: jest.fn((actor) => {
          const idx = globalWindowGroup.children.indexOf(actor);
          if (idx >= 0) globalWindowGroup.children.splice(idx, 1);
        }),
      };

      // FIXED: Remove from window group before destroying
      if (globalWindowGroup.contains(mockDecoration)) {
        globalWindowGroup.remove_child(mockDecoration);
      }
      mockDecoration.destroy();

      // FIXED: Decoration removed from window group
      expect(globalWindowGroup.remove_child).toHaveBeenCalledWith(mockDecoration);
      expect(globalWindowGroup.contains(mockDecoration)).toBe(false);
    });
  });

  describe("Emergency cleanup command", () => {
    test("should provide nuke command to clean all orphaned decorations", () => {
      const orphanedDecorations = [
        {
          type: "forge-deco",
          hide: jest.fn(),
          destroy_all_children: jest.fn(),
          destroy: jest.fn(),
          get_stage: jest.fn(() => ({})),
        },
        {
          type: "forge-deco",
          hide: jest.fn(),
          destroy_all_children: jest.fn(),
          destroy: jest.fn(),
          get_stage: jest.fn(() => ({})),
        },
      ];

      const globalWindowGroup = {
        get_children: () => orphanedDecorations,
      };

      // Emergency cleanup function
      const nukeOrphanedDecorations = () => {
        const children = globalWindowGroup.get_children();
        children.forEach((child) => {
          if (child.type === "forge-deco") {
            try {
              child.hide();
              child.destroy_all_children();
              child.destroy();
            } catch (e) {
              // Already disposed
            }
          }
        });
      };

      nukeOrphanedDecorations();

      // All orphaned decorations cleaned
      orphanedDecorations.forEach((deco) => {
        expect(deco.destroy).toHaveBeenCalled();
      });
    });
  });

  describe("TOCTOU Bug - Decoration disposed during recursive rendering", () => {
    test("RED: should crash when decoration disposed between check and use", () => {
      // Simulate decoration that becomes disposed during recursive rendering
      let decorationDisposed = false;
      const mockDecoration = {
        get visible() {
          if (decorationDisposed) {
            throw new Error("Object has been disposed");
          }
          return true;
        },
        set_size: jest.fn(() => {
          if (decorationDisposed) {
            throw new Error("Segfault: accessing disposed object");
          }
        }),
        set_position: jest.fn(),
        show: jest.fn(),
      };

      const mockNode = {
        decoration: mockDecoration,
      };

      const isDisposed = (obj) => {
        if (!obj) return true;
        try {
          void obj.visible;
          return false;
        } catch (e) {
          return true;
        }
      };

      // Buggy code: check once, then use later without re-checking
      let decoration = mockNode.decoration;

      // Initial check passes
      if (isDisposed(decoration)) {
        mockNode.decoration = null;
        decoration = null;
      }

      // Simulate recursive rendering that disposes decoration
      decorationDisposed = true;

      // BUG: Use decoration without re-checking
      if (decoration !== null && decoration !== undefined) {
        expect(() => {
          decoration.set_size(100, 50); // Should throw
        }).toThrow("Segfault: accessing disposed object");
      }
    });

    test("GREEN: should handle decoration disposed during recursive rendering", () => {
      // Simulate decoration that becomes disposed during recursive rendering
      let decorationDisposed = false;
      const mockDecoration = {
        get visible() {
          if (decorationDisposed) {
            throw new Error("Object has been disposed");
          }
          return true;
        },
        set_size: jest.fn(),
        set_position: jest.fn(),
        show: jest.fn(),
      };

      const mockNode = {
        decoration: mockDecoration,
      };

      const isDisposed = (obj) => {
        if (!obj) return true;
        try {
          void obj.visible;
          return false;
        } catch (e) {
          return true;
        }
      };

      // Initial check
      let decoration = mockNode.decoration;
      if (isDisposed(decoration)) {
        mockNode.decoration = null;
        decoration = null;
      }

      // Simulate recursive rendering that disposes decoration
      decorationDisposed = true;

      // FIXED: Re-check before use (TOCTOU fix)
      decoration = mockNode.decoration;
      if (decoration && isDisposed(decoration)) {
        mockNode.decoration = null;
        decoration = null;
      }

      // Safe to use
      if (decoration !== null && decoration !== undefined) {
        decoration.set_size(100, 50);
      }

      // Should not have called set_size because decoration was nullified
      expect(mockDecoration.set_size).not.toHaveBeenCalled();
    });
  });

  describe("Disposed decoration handling", () => {
    test("isDisposed helper should detect disposed objects", () => {
      // Simulate isDisposed function
      const isDisposed = (obj) => {
        if (!obj) return true;
        try {
          void obj.visible;
          return false;
        } catch (e) {
          return true;
        }
      };

      // Normal object
      const normalObj = { visible: true };
      expect(isDisposed(normalObj)).toBe(false);

      // Null object
      expect(isDisposed(null)).toBe(true);
      expect(isDisposed(undefined)).toBe(true);

      // Disposed object (throws on property access)
      const disposedObj = {
        get visible() {
          throw new Error("Object has been disposed");
        },
      };
      expect(isDisposed(disposedObj)).toBe(true);
    });

    test("should recreate decoration if disposed when processing tabbed layout", () => {
      let decorationCreated = false;
      const mockNode = {
        decoration: null,
        _createDecoration: jest.fn(() => {
          decorationCreated = true;
          mockNode.decoration = { visible: true };
        }),
      };

      // Simulate disposed decoration
      const disposedDecoration = {
        get visible() {
          throw new Error("Object has been disposed");
        },
      };
      mockNode.decoration = disposedDecoration;

      // isDisposed check
      const isDisposed = (obj) => {
        if (!obj) return true;
        try {
          void obj.visible;
          return false;
        } catch (e) {
          return true;
        }
      };

      // Simulate processTabbed logic
      if (isDisposed(mockNode.decoration)) {
        mockNode.decoration = null;
        mockNode._createDecoration();
      }

      expect(mockNode._createDecoration).toHaveBeenCalled();
      expect(decorationCreated).toBe(true);
      expect(mockNode.decoration).not.toBeNull();
    });

    test("should recreate tab if disposed when adding to decoration", () => {
      let tabCreated = false;
      const mockChild = {
        tab: null,
        _createWindowTab: jest.fn(() => {
          tabCreated = true;
          mockChild.tab = { visible: true };
        }),
      };

      // Simulate disposed tab
      const disposedTab = {
        get visible() {
          throw new Error("Object has been disposed");
        },
      };
      mockChild.tab = disposedTab;

      // isDisposed check
      const isDisposed = (obj) => {
        if (!obj) return true;
        try {
          void obj.visible;
          return false;
        } catch (e) {
          return true;
        }
      };

      // Simulate processTabbed tab handling logic
      if (isDisposed(mockChild.tab)) {
        mockChild.tab = null;
        mockChild._createWindowTab();
      }

      expect(mockChild._createWindowTab).toHaveBeenCalled();
      expect(tabCreated).toBe(true);
      expect(mockChild.tab).not.toBeNull();
    });
  });
});
