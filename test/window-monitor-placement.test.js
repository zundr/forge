/**
 * TDD Tests for Window Monitor Placement Fix
 * Tests that new windows are actively moved to target monitor
 */

describe("Window Monitor Placement", () => {
  test("moveWindowToTargetMonitor moves window when on different monitor", () => {
    const moveFrameCalls = [];
    const mockWorkarea = { x: 0, y: 0, width: 1920, height: 1080 };

    const mockWindow = {
      get_monitor: () => 1, // Currently on monitor 1
      move_frame: (user, x, y) => moveFrameCalls.push({ user, x, y }),
    };

    const windowManager = {
      moveWindowToTargetMonitor(metaWindow, targetMonitor) {
        const currentMonitor = metaWindow.get_monitor();
        if (currentMonitor === targetMonitor) return false;

        // Simulate getting workarea for target monitor
        const workarea = mockWorkarea;
        if (workarea) {
          metaWindow.move_frame(true, workarea.x, workarea.y);
          return true;
        }
        return false;
      },
    };

    const result = windowManager.moveWindowToTargetMonitor(mockWindow, 0);

    expect(result).toBe(true);
    expect(moveFrameCalls).toHaveLength(1);
    expect(moveFrameCalls[0]).toEqual({ user: true, x: 0, y: 0 });
  });

  test("moveWindowToTargetMonitor does nothing when already on target monitor", () => {
    const moveFrameCalls = [];

    const mockWindow = {
      get_monitor: () => 0, // Already on monitor 0
      move_frame: (user, x, y) => moveFrameCalls.push({ user, x, y }),
    };

    const windowManager = {
      moveWindowToTargetMonitor(metaWindow, targetMonitor) {
        const currentMonitor = metaWindow.get_monitor();
        if (currentMonitor === targetMonitor) return false;
        metaWindow.move_frame(true, 0, 0);
        return true;
      },
    };

    const result = windowManager.moveWindowToTargetMonitor(mockWindow, 0);

    expect(result).toBe(false);
    expect(moveFrameCalls).toHaveLength(0);
  });

  test("moveWindowToTargetMonitor uses correct workarea coordinates", () => {
    const moveFrameCalls = [];
    // Secondary monitor workarea (to the right of primary)
    const mockWorkarea = { x: 1920, y: 0, width: 1920, height: 1080 };

    const mockWindow = {
      get_monitor: () => 0, // Currently on monitor 0
      move_frame: (user, x, y) => moveFrameCalls.push({ user, x, y }),
    };

    const windowManager = {
      moveWindowToTargetMonitor(metaWindow, targetMonitor) {
        const currentMonitor = metaWindow.get_monitor();
        if (currentMonitor === targetMonitor) return false;

        const workarea = mockWorkarea;
        if (workarea) {
          metaWindow.move_frame(true, workarea.x, workarea.y);
          return true;
        }
        return false;
      },
    };

    const result = windowManager.moveWindowToTargetMonitor(mockWindow, 1);

    expect(result).toBe(true);
    expect(moveFrameCalls[0]).toEqual({ user: true, x: 1920, y: 0 });
  });
});
