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

  describe("native segfault prevention: isDisposed guard before contains/add_child", () => {
    /**
     * Simulates the REAL crash scenario: decoration is valid for set_size/show
     * but becomes disposed before contains/add_child. In production, contains()
     * on a disposed St.BoxLayout triggers a native segfault that try-catch
     * CANNOT catch. The fix must use isDisposed() to prevent the call entirely.
     */
    function createDecorationDisposedAfterShow() {
      let disposed = false;
      return {
        set_size: jest.fn(),
        set_position: jest.fn(),
        show: jest.fn(() => {
          disposed = true;
        }), // disposal happens during show
        hide: jest.fn(() => {
          disposed = true;
        }),
        // These simulate native calls that would segfault if disposed
        contains: jest.fn(() => {
          throw new Error("NATIVE SEGFAULT");
        }),
        add_child: jest.fn(() => {
          throw new Error("NATIVE SEGFAULT");
        }),
        get visible() {
          if (disposed) throw new Error("Object St.BoxLayout has been already disposed");
          return true;
        },
      };
    }

    /**
     * Fixed version that guards contains/add_child with isDisposed() check.
     * This prevents the native segfault by never calling contains/add_child
     * on a disposed object.
     */
    function applyDecorationOpsFixed(
      node,
      adjustWidth,
      stackedHeight,
      adjustX,
      adjustY,
      showDecoration,
      child
    ) {
      if (!node.decoration) return;

      function isDisposed(obj) {
        if (!obj) return true;
        try {
          void obj.visible;
          return false;
        } catch (e) {
          return true;
        }
      }

      try {
        node.decoration.set_size(adjustWidth, stackedHeight);
        node.decoration.set_position(adjustX, adjustY);

        if (showDecoration) {
          node.decoration.show();
        } else {
          node.decoration.hide();
        }

        if (child?.tab) {
          // Guard against native segfault: check isDisposed before contains/add_child
          if (isDisposed(node.decoration)) {
            node.decoration = null;
          } else {
            try {
              if (!node.decoration.contains(child.tab)) {
                node.decoration.add_child(child.tab);
              }
            } catch (tabError) {
              child.tab = null;
            }
          }
        }
      } catch (e) {
        node.decoration = null;
      }
    }

    test("decoration disposed after show: contains/add_child never called", () => {
      const decoration = createDecorationDisposedAfterShow();
      const node = { decoration };
      const child = { tab: { label: "test" } };

      expect(() => {
        applyDecorationOpsFixed(node, 100, 30, 0, 0, true, child);
      }).not.toThrow();

      // contains/add_child must NOT be called — they would segfault
      expect(decoration.contains).not.toHaveBeenCalled();
      expect(decoration.add_child).not.toHaveBeenCalled();
      // decoration reference cleared
      expect(node.decoration).toBeNull();
    });

    test("decoration disposed after hide: contains/add_child never called", () => {
      const decoration = createDecorationDisposedAfterShow();
      const node = { decoration };
      const child = { tab: { label: "test" } };

      expect(() => {
        applyDecorationOpsFixed(node, 100, 30, 0, 0, false, child);
      }).not.toThrow();

      expect(decoration.contains).not.toHaveBeenCalled();
      expect(decoration.add_child).not.toHaveBeenCalled();
      expect(node.decoration).toBeNull();
    });

    test("live decoration: contains/add_child still work normally", () => {
      const decoration = createLiveDecoration();
      const node = { decoration };
      const child = { tab: { label: "test" } };

      applyDecorationOpsFixed(node, 100, 30, 0, 0, true, child);

      expect(decoration.contains).toHaveBeenCalledWith(child.tab);
      expect(decoration.add_child).toHaveBeenCalledWith(child.tab);
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

/**
 * Phase 2 Tests: processTabbed fix using JS-side parent tracking
 * to eliminate native .contains() calls entirely.
 */
const { isDisposed, safeCall, trackParent, isChildOf } = require("../lib/extension/safe-widget");

describe("processTabbed TOCTOU fix — JS-side parent tracking", () => {
  function createLiveDecoration() {
    const children = [];
    return {
      visible: true,
      set_size: jest.fn(),
      set_position: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      contains: jest.fn((c) => children.includes(c)),
      add_child: jest.fn((c) => children.push(c)),
      remove_child: jest.fn(),
      destroy: jest.fn(),
    };
  }

  /**
   * Simulates the FIXED processTabbed decoration block.
   * Uses trackParent/isChildOf instead of native .contains().
   */
  function processTabDecoration(node, child, showDecoration) {
    if (!node.decoration) return;

    try {
      node.decoration.set_size(100, 30);
      node.decoration.set_position(0, 0);

      if (showDecoration) {
        node.decoration.show();
      } else {
        node.decoration.hide();
      }

      if (child.tab) {
        // JS-side check — no native .contains() call
        if (!isChildOf(child.tab, node.decoration)) {
          try {
            node.decoration.add_child(child.tab);
            trackParent(child.tab, node.decoration);
          } catch (e) {
            child.tab = null;
          }
        }
      }
    } catch (e) {
      node.decoration = null;
    }
  }

  test("tab added and tracked on first render", () => {
    const decoration = createLiveDecoration();
    const node = { decoration };
    const tab = { label: "test" };
    const child = { tab };

    processTabDecoration(node, child, true);

    expect(decoration.add_child).toHaveBeenCalledWith(tab);
    expect(decoration.contains).not.toHaveBeenCalled(); // no native .contains()!
    expect(isChildOf(tab, decoration)).toBe(true);
  });

  test("tab NOT re-added on subsequent renders (tracked)", () => {
    const decoration = createLiveDecoration();
    const node = { decoration };
    const tab = { label: "test" };
    const child = { tab };

    processTabDecoration(node, child, true); // first render
    decoration.add_child.mockClear();
    processTabDecoration(node, child, true); // second render

    expect(decoration.add_child).not.toHaveBeenCalled();
    expect(decoration.contains).not.toHaveBeenCalled();
  });

  test("disposed decoration during set_size: no crash, ref nulled", () => {
    const disposed = new Proxy(
      {},
      {
        get() {
          throw new Error("Object St.BoxLayout has been already disposed");
        },
      }
    );
    const node = { decoration: disposed };
    const child = { tab: { label: "test" } };

    expect(() => processTabDecoration(node, child, true)).not.toThrow();
    expect(node.decoration).toBeNull();
  });

  test("disposed decoration during add_child: tab nulled, no crash", () => {
    const decoration = createLiveDecoration();
    decoration.add_child = jest.fn(() => {
      throw new Error("Object St.BoxLayout has been already disposed");
    });
    const node = { decoration };
    const child = { tab: { label: "test" } };

    expect(() => processTabDecoration(node, child, true)).not.toThrow();
    expect(child.tab).toBeNull();
  });

  test("no tab: decoration ops still work", () => {
    const decoration = createLiveDecoration();
    const node = { decoration };
    const child = { tab: null };

    processTabDecoration(node, child, true);

    expect(decoration.show).toHaveBeenCalled();
    expect(decoration.add_child).not.toHaveBeenCalled();
  });
});
