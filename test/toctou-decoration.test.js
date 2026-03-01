/**
 * TDD Tests for TOCTOU Decoration Disposal Bug
 *
 * BUG: 'Object St.BoxLayout has been already disposed' crash in tree.js
 * ROOT CAUSE: TOCTOU race — isDisposed() check passes, then GC disposes
 * the object before the next method call.
 *
 * FIX: Use try-catch at point of use instead of check-then-use pattern.
 */

describe("TOCTOU Decoration Disposal", () => {
  /**
   * Simulates a disposed St.BoxLayout that throws on any property access.
   * This is what GNOME Shell GC does to GObjects.
   */
  function createDisposedDecoration() {
    return new Proxy(
      {},
      {
        get(target, prop) {
          throw new Error("Object St.BoxLayout has been already disposed");
        },
      }
    );
  }

  function createLiveDecoration() {
    const children = [];
    return {
      set_size: jest.fn(),
      set_position: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      contains: jest.fn((child) => children.includes(child)),
      add_child: jest.fn((child) => children.push(child)),
      destroy_all_children: jest.fn(),
      destroy: jest.fn(),
      visible: true,
    };
  }

  /**
   * Simulates the decoration operations block from processNode().
   * This is the FIXED version using try-catch at point of use.
   */
  function applyDecorationOps(
    node,
    adjustWidth,
    stackedHeight,
    adjustX,
    adjustY,
    showDecoration,
    child
  ) {
    if (!node.decoration) return;

    try {
      node.decoration.set_size(adjustWidth, stackedHeight);
      node.decoration.set_position(adjustX, adjustY);

      if (showDecoration) {
        node.decoration.show();
      } else {
        node.decoration.hide();
      }

      if (child?.tab) {
        try {
          if (!node.decoration.contains(child.tab)) {
            node.decoration.add_child(child.tab);
          }
        } catch (e) {
          child.tab = null;
        }
      }
    } catch (e) {
      node.decoration = null;
    }
  }

  describe("try-catch handles disposed decoration gracefully", () => {
    test("disposed decoration: no crash, node.decoration set to null", () => {
      const node = { decoration: createDisposedDecoration() };

      expect(() => {
        applyDecorationOps(node, 100, 30, 0, 0, true, null);
      }).not.toThrow();

      expect(node.decoration).toBeNull();
    });

    test("live decoration: operations succeed normally", () => {
      const decoration = createLiveDecoration();
      const node = { decoration };

      applyDecorationOps(node, 200, 40, 10, 5, true, null);

      expect(decoration.set_size).toHaveBeenCalledWith(200, 40);
      expect(decoration.set_position).toHaveBeenCalledWith(10, 5);
      expect(decoration.show).toHaveBeenCalled();
      expect(node.decoration).toBe(decoration); // not nullified
    });

    test("live decoration: hide when showDecoration=false", () => {
      const decoration = createLiveDecoration();
      const node = { decoration };

      applyDecorationOps(node, 100, 30, 0, 0, false, null);

      expect(decoration.hide).toHaveBeenCalled();
      expect(decoration.show).not.toHaveBeenCalled();
    });

    test("tab added to decoration when not already contained", () => {
      const decoration = createLiveDecoration();
      const node = { decoration };
      const child = { tab: { label: "test" } };

      applyDecorationOps(node, 100, 30, 0, 0, true, child);

      expect(decoration.add_child).toHaveBeenCalledWith(child.tab);
    });

    test("tab NOT added when already contained", () => {
      const decoration = createLiveDecoration();
      decoration.contains = jest.fn(() => true);
      const node = { decoration };
      const child = { tab: { label: "test" } };

      applyDecorationOps(node, 100, 30, 0, 0, true, child);

      expect(decoration.add_child).not.toHaveBeenCalled();
    });

    test("decoration disposed mid-operation during tab add: no crash", () => {
      // Decoration works for set_size/set_position/show but throws on contains
      const decoration = createLiveDecoration();
      decoration.contains = jest.fn(() => {
        throw new Error("Object St.BoxLayout has been already disposed");
      });
      const node = { decoration };
      const child = { tab: { label: "test" } };

      expect(() => {
        applyDecorationOps(node, 100, 30, 0, 0, true, child);
      }).not.toThrow();

      // Tab error is caught by inner try-catch, child.tab nullified
      expect(child.tab).toBeNull();
    });
  });

  describe("isDisposed() function", () => {
    function isDisposed(obj) {
      if (!obj) return true;
      try {
        void obj.visible;
        return false;
      } catch (e) {
        return true;
      }
    }

    test("returns true for null", () => {
      expect(isDisposed(null)).toBe(true);
    });

    test("returns true for undefined", () => {
      expect(isDisposed(undefined)).toBe(true);
    });

    test("returns false for live object", () => {
      expect(isDisposed({ visible: true })).toBe(false);
    });

    test("returns true for disposed object that throws", () => {
      expect(isDisposed(createDisposedDecoration())).toBe(true);
    });
  });
});
