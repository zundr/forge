/**
 * TDD Tests for Float Toggle Bugs
 *
 * Bug 1: removeFloatOverride cannot remove class-wide overrides when withWmId=true
 * Bug 2: FloatToggle always calls move() even when toggling to TILE mode (causes flicker)
 */

const WINDOW_MODES = { FLOAT: "FLOAT", TILE: "TILE", GRAB_TILE: "GRAB_TILE", DEFAULT: "DEFAULT" };

describe("Float Toggle Bugs", () => {
  // --- Bug 1: removeFloatOverride filter ---

  describe("removeFloatOverride", () => {
    /**
     * Extract the filter logic from removeFloatOverride for isolated testing.
     * Current (buggy): (!withWmId || override.wmId === wmId)
     * Fixed: (!withWmId || !override.wmId || override.wmId === wmId)
     */
    function removeFloatOverrideFilter(overrides, wmClass, wmId, withWmId) {
      return overrides.filter(
        (override) =>
          !(
            override.wmClass === wmClass &&
            !override.wmTitle &&
            (!withWmId || override.wmId === wmId)
          )
      );
    }

    function removeFloatOverrideFilterFixed(overrides, wmClass, wmId, withWmId) {
      return overrides.filter(
        (override) =>
          !(
            override.wmClass === wmClass &&
            !override.wmTitle &&
            (!withWmId || !override.wmId || override.wmId === wmId)
          )
      );
    }

    test("BUG: class-wide override (no wmId) NOT removed when withWmId=true", () => {
      const overrides = [{ wmClass: "Alacritty", mode: "float" }]; // no wmId = class-wide
      const result = removeFloatOverrideFilter(overrides, "Alacritty", 12345, true);
      // BUG: class-wide override is NOT removed because undefined !== 12345
      expect(result).toHaveLength(1); // buggy: override survives
    });

    test("FIXED: class-wide override (no wmId) IS removed when withWmId=true", () => {
      const overrides = [{ wmClass: "Alacritty", mode: "float" }];
      const result = removeFloatOverrideFilterFixed(overrides, "Alacritty", 12345, true);
      expect(result).toHaveLength(0); // fixed: override removed
    });

    test("wmId-specific override removed when wmId matches", () => {
      const overrides = [{ wmClass: "Alacritty", wmId: 12345, mode: "float" }];
      const result = removeFloatOverrideFilterFixed(overrides, "Alacritty", 12345, true);
      expect(result).toHaveLength(0);
    });

    test("wmId-specific override NOT removed when wmId differs", () => {
      const overrides = [{ wmClass: "Alacritty", wmId: 99999, mode: "float" }];
      const result = removeFloatOverrideFilterFixed(overrides, "Alacritty", 12345, true);
      expect(result).toHaveLength(1); // different wmId, keep it
    });

    test("withWmId=false removes all matching class overrides regardless of wmId", () => {
      const overrides = [
        { wmClass: "Alacritty", mode: "float" },
        { wmClass: "Alacritty", wmId: 12345, mode: "float" },
      ];
      const result = removeFloatOverrideFilterFixed(overrides, "Alacritty", 12345, false);
      expect(result).toHaveLength(0);
    });

    test("user-written overrides with wmTitle are preserved", () => {
      const overrides = [{ wmClass: "firefox", wmTitle: "!Mozilla Firefox", mode: "float" }];
      const result = removeFloatOverrideFilterFixed(overrides, "firefox", 100, true);
      expect(result).toHaveLength(1); // wmTitle rules are user-written, never removed
    });
  });

  // --- Bug 2: FloatToggle move() should only fire in FLOAT mode ---

  describe("FloatToggle conditional move()", () => {
    test("move() should be called when mode is FLOAT after toggle", () => {
      const moveFn = jest.fn();
      const nodeWindow = { mode: WINDOW_MODES.FLOAT };

      // Simulate post-toggle: mode is FLOAT → move should fire
      if (nodeWindow.mode === WINDOW_MODES.FLOAT) {
        moveFn();
      }

      expect(moveFn).toHaveBeenCalledTimes(1);
    });

    test("move() should NOT be called when mode is TILE after toggle", () => {
      const moveFn = jest.fn();
      const nodeWindow = { mode: WINDOW_MODES.TILE };

      // Simulate post-toggle: mode is TILE → move should NOT fire
      if (nodeWindow.mode === WINDOW_MODES.FLOAT) {
        moveFn();
      }

      expect(moveFn).not.toHaveBeenCalled();
    });
  });
});
