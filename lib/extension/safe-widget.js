/**
 * Safe GObject wrapper utilities for GNOME Shell extensions.
 *
 * Defends against TOCTOU races where GC disposes St.Widget objects
 * between safety checks and native method calls.
 */

/**
 * Check if a GObject has been disposed by GNOME Shell's GC.
 * Disposed objects are truthy in JS but throw on any property access.
 */
function isDisposed(obj) {
  if (!obj) return true;
  try {
    void obj.visible;
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Wrap a GObject in a Proxy that makes all access safe against disposal.
 * Live widgets work normally. Disposed widgets silently no-op (return undefined).
 * Returns null for null/undefined input (preserves falsy semantics).
 */
function safeWidget(obj) {
  if (!obj) return null;
  const noop = () => undefined;
  return new Proxy(obj, {
    get(target, prop) {
      if (isDisposed(target)) return noop;
      try {
        const value = target[prop];
        if (typeof value === "function") {
          return (...args) => {
            if (isDisposed(target)) return undefined;
            try {
              return value.apply(target, args);
            } catch (e) {
              return undefined;
            }
          };
        }
        return value;
      } catch (e) {
        return noop;
      }
    },
  });
}

// WeakMap for JS-side parent tracking — avoids native .contains() calls
const _parentMap = new WeakMap();

/**
 * Track a child→parent relationship in JS to avoid native .contains().
 * Pass null parent to clear.
 */
function trackParent(child, parent) {
  if (parent) {
    _parentMap.set(child, parent);
  } else {
    _parentMap.delete(child);
  }
}

/**
 * Check if child is tracked as belonging to parent (JS-side, no native call).
 */
function isChildOf(child, parent) {
  return _parentMap.get(child) === parent;
}

// Support both ESM (GNOME Shell) and CJS (Jest)
try {
  module.exports = { isDisposed, safeWidget, trackParent, isChildOf };
} catch (e) {
  // ESM environment — exports handled by import statements
}
