/**
 * TDD Tests for safe-widget.js — Safe GObject wrapper utilities
 *
 * These utilities defend against TOCTOU races where GNOME Shell's GC
 * disposes St.Widget objects between safety checks and method calls.
 */

const { isDisposed, safeWidget, trackParent, isChildOf } = require("../lib/extension/safe-widget");

// --- Test Helpers ---

function createDisposedWidget() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        throw new Error("Object St.BoxLayout has been already disposed");
      },
    }
  );
}

function createLiveWidget() {
  const children = [];
  return {
    visible: true,
    set_size: jest.fn(),
    set_position: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    contains: jest.fn((child) => children.includes(child)),
    add_child: jest.fn((child) => children.push(child)),
    remove_child: jest.fn((child) => {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
    }),
    destroy_all_children: jest.fn(() => (children.length = 0)),
    destroy: jest.fn(),
  };
}

// --- Tests ---

describe("safe-widget", () => {
  describe("isDisposed", () => {
    test("null → true", () => expect(isDisposed(null)).toBe(true));
    test("undefined → true", () => expect(isDisposed(undefined)).toBe(true));
    test("live widget → false", () => expect(isDisposed({ visible: true })).toBe(false));
    test("disposed widget → true", () => expect(isDisposed(createDisposedWidget())).toBe(true));
  });

  describe("safeWidget proxy", () => {
    test("null input → null (falsy)", () => {
      expect(safeWidget(null)).toBeNull();
    });

    test("undefined input → null (falsy)", () => {
      expect(safeWidget(undefined)).toBeNull();
    });

    test("method calls delegate to real object", () => {
      const widget = createLiveWidget();
      const safe = safeWidget(widget);
      safe.set_size(100, 200);
      expect(widget.set_size).toHaveBeenCalledWith(100, 200);
    });

    test("property reads delegate to real object", () => {
      const widget = createLiveWidget();
      const safe = safeWidget(widget);
      expect(safe.visible).toBe(true);
    });

    test("method return values pass through", () => {
      const widget = { visible: true, getValue: () => 42 };
      const safe = safeWidget(widget);
      expect(safe.getValue()).toBe(42);
    });

    test("disposed widget: method call returns undefined (no crash)", () => {
      const safe = safeWidget(createDisposedWidget());
      expect(safe.set_size(100, 200)).toBeUndefined();
    });

    test("disposed widget: property read returns noop function (callable)", () => {
      const safe = safeWidget(createDisposedWidget());
      expect(typeof safe.visible).toBe("function");
      expect(safe.visible()).toBeUndefined();
    });

    test("method that throws mid-call returns undefined", () => {
      const widget = {
        visible: true,
        explode: () => {
          throw new Error("boom");
        },
      };
      const safe = safeWidget(widget);
      expect(safe.explode()).toBeUndefined();
    });

    test("widget disposed between proxy creation and method call", () => {
      let disposed = false;
      const widget = {
        get visible() {
          if (disposed) throw new Error("disposed");
          return true;
        },
        doWork: jest.fn(),
      };
      const safe = safeWidget(widget);
      disposed = true;
      safe.doWork();
      expect(widget.doWork).not.toHaveBeenCalled();
    });

    test("multiple calls, some after disposal", () => {
      let disposed = false;
      const widget = {
        get visible() {
          if (disposed) throw new Error("disposed");
          return true;
        },
        op1: jest.fn(),
        op2: jest.fn(),
      };
      const safe = safeWidget(widget);
      safe.op1();
      disposed = true;
      safe.op2();
      expect(widget.op1).toHaveBeenCalled();
      expect(widget.op2).not.toHaveBeenCalled();
    });
  });

  describe("trackParent / isChildOf", () => {
    test("isChildOf returns false before tracking", () => {
      expect(isChildOf({}, createLiveWidget())).toBe(false);
    });

    test("trackParent sets relationship", () => {
      const child = {},
        parent = createLiveWidget();
      trackParent(child, parent);
      expect(isChildOf(child, parent)).toBe(true);
    });

    test("isChildOf returns false for wrong parent", () => {
      const child = {},
        p1 = createLiveWidget(),
        p2 = createLiveWidget();
      trackParent(child, p1);
      expect(isChildOf(child, p2)).toBe(false);
    });

    test("trackParent with null clears relationship", () => {
      const child = {},
        parent = createLiveWidget();
      trackParent(child, parent);
      trackParent(child, null);
      expect(isChildOf(child, parent)).toBe(false);
    });

    test("re-parenting updates tracking", () => {
      const child = {},
        p1 = createLiveWidget(),
        p2 = createLiveWidget();
      trackParent(child, p1);
      trackParent(child, p2);
      expect(isChildOf(child, p1)).toBe(false);
      expect(isChildOf(child, p2)).toBe(true);
    });
  });
});
