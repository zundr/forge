/**
 * TDD Tests for force-tile config override
 *
 * BUG: Windows that report allows_resize()=false (e.g., Microsoft Edge on Wayland)
 * are automatically floated by isFloatingExempt(). There's no way to override this
 * via config to force them to tile.
 *
 * FIX: Support mode:"tile" overrides in windows.json that take precedence over
 * automatic float detection in isFloatingExempt().
 */

describe("Force-tile config override", () => {
  /**
   * Simulates isFloatingExempt logic.
   * Current (buggy): only checks for "float" overrides, no way to force tile.
   * Fixed: checks for "tile" overrides first, which override floatByType.
   */
  function isFloatingExemptBuggy(metaWindow, overrides) {
    let floatByType = !metaWindow.allows_resize();

    const knownFloats = overrides.filter((o) => o.mode === "float");
    let floatOverride =
      knownFloats.filter((kf) => kf.wmClass && kf.wmClass.includes(metaWindow.get_wm_class()))
        .length > 0;

    return floatByType || floatOverride;
  }

  function isFloatingExemptFixed(metaWindow, overrides) {
    let wmClass = metaWindow.get_wm_class();

    // Check for "tile" overrides first — they take precedence over auto-float
    const tileOverride =
      overrides.filter((o) => o.mode === "tile" && o.wmClass && o.wmClass.includes(wmClass))
        .length > 0;
    if (tileOverride) return false;

    let floatByType = !metaWindow.allows_resize();

    const knownFloats = overrides.filter((o) => o.mode === "float");
    let floatOverride =
      knownFloats.filter((kf) => kf.wmClass && kf.wmClass.includes(wmClass)).length > 0;

    return floatByType || floatOverride;
  }

  const edgeWindow = {
    allows_resize: () => false,
    get_wm_class: () => "microsoft-edge",
    get_title: () => "Microsoft Edge",
    get_window_type: () => 0,
    get_transient_for: () => null,
    get_id: () => 1,
  };

  const normalWindow = {
    allows_resize: () => true,
    get_wm_class: () => "gnome-terminal",
    get_title: () => "Terminal",
    get_window_type: () => 0,
    get_transient_for: () => null,
    get_id: () => 2,
  };

  test("BUG: Edge floats because allows_resize()=false, no way to override", () => {
    const overrides = [];
    expect(isFloatingExemptBuggy(edgeWindow, overrides)).toBe(true);
  });

  test("BUG: Even with tile override, buggy version still floats Edge", () => {
    const overrides = [{ wmClass: "microsoft-edge", mode: "tile" }];
    // Buggy version ignores tile overrides
    expect(isFloatingExemptBuggy(edgeWindow, overrides)).toBe(true);
  });

  test("FIXED: tile override forces Edge to tile despite allows_resize()=false", () => {
    const overrides = [{ wmClass: "microsoft-edge", mode: "tile" }];
    expect(isFloatingExemptFixed(edgeWindow, overrides)).toBe(false);
  });

  test("FIXED: without tile override, Edge still floats (allows_resize=false)", () => {
    const overrides = [];
    expect(isFloatingExemptFixed(edgeWindow, overrides)).toBe(true);
  });

  test("FIXED: normal window tiles normally without overrides", () => {
    const overrides = [];
    expect(isFloatingExemptFixed(normalWindow, overrides)).toBe(false);
  });

  test("FIXED: float override still works for normal windows", () => {
    const overrides = [{ wmClass: "gnome-terminal", mode: "float" }];
    expect(isFloatingExemptFixed(normalWindow, overrides)).toBe(true);
  });

  test("FIXED: tile override takes precedence over float override for same class", () => {
    const overrides = [
      { wmClass: "microsoft-edge", mode: "float" },
      { wmClass: "microsoft-edge", mode: "tile" },
    ];
    expect(isFloatingExemptFixed(edgeWindow, overrides)).toBe(false);
  });
});
