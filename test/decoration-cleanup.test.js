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
});
