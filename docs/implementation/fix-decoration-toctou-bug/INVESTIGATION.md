# Forge Debugging Investigation Report

**Date:** 2026-02-14  
**Investigator:** joseaps  
**Status:** Comprehensive fix plan created  
**Last Updated:** 2026-03-10 14:50 — Full TOCTOU audit complete, 7-phase fix plan

---

## Executive Summary

Four issues were investigated:

1. **Alacritty floating on login** — Persisted float override in `~/.config/forge/config/windows.json` (user config) containing `{wmClass: "Alacritty", mode: "float"}` from a previous session
2. **Toggle-float flicker bug** — After removing the Alacritty override via toggle, re-toggling to FLOAT flickers then snaps back to TILE. Needs investigation.
3. **Microsoft Edge floating** — Edge reports `allows_resize()=false` to the window manager, triggering automatic float
4. **Forge crash at 09:24:51** — TOCTOU race condition in `tree.js` decoration handling where `St.BoxLayout` objects are disposed between safety checks and method calls

Additionally: **dual installation conflict** — Forge installed in both `~/.local/share/gnome-shell/extensions/` and `~/.nix-profile/share/gnome-shell/extensions/`.

---

## Investigation Methodology

### Tools Used
- `./forge-float-debug list` — window float status
- `./forge-float-debug overrides` — runtime float overrides
- `./forge-tree-dump -v` — full tree structure with attributes
- `gdbus call ... GetTree` — D-Bus query for window properties
- `journalctl /usr/bin/gnome-shell --since '09:20' --until '09:30'` — crash logs
- `dconf read /org/gnome/shell/extensions/forge/workspace-skip-tile` — workspace tiling config
- `cat ~/.config/forge/config/windows.json` — user's persisted config (NOT repo config)
- `git diff` — existing in-progress fixes

### Approach
Systematic elimination using scientific method. Three hypothesis iterations were needed for Alacritty.

### Key Lesson Learned
**Always check the USER config (`~/.config/forge/`) not just the repo config (`config/`).** The repo's `config/windows.json` is a default template. The runtime config is at `~/.config/forge/config/windows.json` and may contain additional overrides from previous sessions.

---

## Issue 1: Alacritty Floating on Login

### Investigation Timeline (3 iterations)

**Iteration 1 — Wrong hypothesis (REFUTED):**
Initial analysis checked repo's `config/windows.json` — no Alacritty entry. All automatic float conditions were false (windowType=0, allowsResize=true, transientFor=false, valid wmClass/title). Concluded `userFloatIntent=true` from `Super+c` toggle.
→ **User corrected:** Never pressed `Super+c`.

**Iteration 2 — Wrong hypothesis (REFUTED):**
Hypothesized login race condition: `trackWindow()` creates windows as FLOAT, `processFloats()` runs async and may see null properties. Re-queried D-Bus and found Alacritty was now TILE. Concluded it self-corrected.
→ **User corrected:** Did NOT self-correct. User pressed `Super+Shift+f` (toggle float keybinding) to fix it.

**Iteration 3 — Correct root cause (CONFIRMED):**
Checked `~/.config/forge/config/windows.json` (user config, not repo config). Found persisted override:
```json
{ "wmClass": "Alacritty", "mode": "float" }
```
This was set in a previous session and persists across logins.

### Root Cause

`~/.config/forge/config/windows.json` contains a class-wide float override for Alacritty. On login, `isFloatingExempt()` reads this config and returns `true` → window is set to FLOAT.

The override was likely created by a previous `Super+Shift+c` (FloatClassToggle) or `Super+c` (FloatToggle) keypress in an earlier session.

### Fix

Remove the Alacritty entry from `~/.config/forge/config/windows.json`, or use `forge-float-debug` to manage overrides.

### Note on Race Condition (Theoretical)

The code DOES have a theoretical race condition vulnerability:
- `trackWindow()` hardcodes `WINDOW_MODES.FLOAT` for all new windows (line 1567)
- `processFloats()` runs async via `GLib.idle_add`
- `isFloatingExempt()` returns `true` for null `wmClass` or null/empty `title`

However, there is **no evidence** this race actually fires in practice. The persisted config override fully explains the Alacritty behavior.

---

## Issue 2: Toggle-Float Flicker Bug

### Observed Behavior

After removing the Alacritty float override (first toggle → TILE), pressing toggle again:
1. Window briefly flickers (moves to center, 65%×75% size)
2. Immediately snaps back to tiled position
3. Window stays TILE despite toggle requesting FLOAT

### Root Cause: `removeFloatOverride` Cannot Remove Class-Wide Overrides

The bug is a logic error in the interaction between `FloatToggle` (per-window, `withWmId=true`) and class-wide overrides (no `wmId` field).

**The filter in `removeFloatOverride` (line 127):**
```javascript
overrides = overrides.filter(
  (override) =>
    !(
      override.wmClass === wmClass &&
      !override.wmTitle &&
      (!withWmId || override.wmId === wmId)  // ← THE BUG
    )
);
```

When `withWmId=true` (FloatToggle), condition 3 becomes `override.wmId === wmId`. But the persisted class-wide override has **no `wmId` field** (`undefined`). So `undefined === 2612612152` → `false` → the override is **never removed**.

**Full trace of the stuck toggle:**

```
FIRST TOGGLE (FLOAT → TILE):
  isFloatingExempt() → true (persisted override {wmClass:"Alacritty"} matches)
  → IF branch:
    removeFloatOverride(withWmId=true) → FAILS (can't match wmId on class-wide override)
    userFloatIntent = false
    mode = TILE ← works because processFloats respects userFloatIntent=false

SECOND TOGGLE (trying TILE → FLOAT):
  isFloatingExempt() → true AGAIN (override still exists!)
  → IF branch AGAIN (never reaches ELSE):
    removeFloatOverride(withWmId=true) → FAILS again
    userFloatIntent = false (again)
    mode = TILE (again)
  → command() calls move(focusWindow, {center, 65%×75%}) ← THE FLICKER
  → renderTree → processFloats → TILE → tree positions window back ← FLICKER ENDS
```

The toggle is **permanently stuck in the IF branch** because `isFloatingExempt` always returns `true` (the class-wide override is never removed). The flicker comes from `command()` line 510 always calling `this.move(focusWindow, moveRect)` with the float positioning, regardless of whether the toggle actually set FLOAT or TILE.

### Two Bugs

1. **`removeFloatOverride` logic bug:** When `withWmId=true`, it cannot remove class-wide overrides that have no `wmId`. The condition `(!withWmId || override.wmId === wmId)` should also match overrides with `undefined` wmId when the class matches.

2. **`command()` unconditional move:** Line 510 applies float positioning (`this.move(focusWindow, moveRect)`) even when the toggle resulted in TILE mode, causing the visual flicker.

### Suggested Fix

**Bug 1 — Fix `removeFloatOverride` to handle class-wide overrides:**
```javascript
// Current (broken):
(!withWmId || override.wmId === wmId)

// Fixed: also remove class-wide overrides (no wmId) when class matches
(!withWmId || !override.wmId || override.wmId === wmId)
```

**Bug 2 — Only apply float rect when actually floating:**
```javascript
// In command(), after toggleFloatingMode:
const nodeAfterToggle = this.findNodeWindow(focusWindow);
if (nodeAfterToggle && nodeAfterToggle.mode === WINDOW_MODES.FLOAT) {
  this.move(focusWindow, moveRect);
}
```

### Status: Root cause confirmed, fix ready to implement

---

## Issue 3: Microsoft Edge Floating

### Root Cause

D-Bus `GetTree` query reveals Edge reports `allowsResize: false`:
```json
{
  "wmClass": "microsoft-edge",
  "windowType": 0,
  "allowsResize": false,
  "transientFor": false
}
```

`isFloatingExempt()` condition: `!metaWindow.allows_resize()` → `true` → automatic float.

This is likely a Chromium/Electron Wayland issue where window hints are set incorrectly.

### Fix Options

1. Toggle manually: `./forge-float-debug toggle <id>`
2. After toggling to tile, `userFloatIntent=false` overrides the automatic detection for the session
3. Code fix: add a "force tile" config override that takes precedence over automatic detection

---

## Issue 4: Crash at 09:24:51

### Error
```
Object St.BoxLayout has been already disposed — impossible to get any property from it
```

### Stack Trace Locations
- `tree.js`: lines 63, 1369, 1495, 1496, 1501, 1502, 1568, 1575, 1577, 1777
- `window.js`: line 1260

### Root Cause: TOCTOU Race Condition

1. Code calls `isDisposed(decoration)` → returns `false`
2. Between check and next method call, GNOME Shell disposes the `St.BoxLayout`
3. Subsequent call (`decoration.set_size()`, `.show()`, etc.) crashes
4. Even `isDisposed()` itself (line 63: `void obj.visible`) can crash on severely corrupted objects

### Current Fixes in Git Diff

`tree.js` diff adds defensive `isDisposed()` checks:
```javascript
if (isDisposed(decoration)) {
  Logger.warn("Decoration disposed before [operation]");
  node.decoration = null;
  return;
}
```

**Problem:** Still uses check-then-use pattern — vulnerable to same TOCTOU race.

### Recommended Fix

Replace check-then-use with try-catch at point of use:
```javascript
// ✅ Eliminates race window entirely
try {
  decoration.show();
} catch (e) {
  Logger.warn(`Decoration disposed during show: ${e.message}`);
  node.decoration = null;
}
```

### Affected Locations
1. `processNode()` — decoration sizing/positioning (~line 1495-1580)
2. Decoration show/hide (~line 1777)
3. Tab child management (~line 1568)
4. Container removal/cleanup (~line 1369)

---

## Issue 5: Dual Installation Conflict

Forge installed in both:
- `~/.local/share/gnome-shell/extensions/forge@jmmaranan.com` (local dev)
- `~/.nix-profile/share/gnome-shell/extensions/forge@jmmaranan.com` (nix)

GNOME Shell logs show load warnings. Risk of loading wrong version or double signal registration.

**Fix:** Remove one installation.

---

## Summary

| Issue | Root Cause | Status | Priority |
|-------|-----------|--------|----------|
| Alacritty float | Persisted override in ~/.config/forge/ | Confirmed | Low (user config) |
| Toggle-float flicker | `removeFloatOverride` can't remove class-wide overrides + unconditional `move()` | Confirmed | Medium |
| Edge float | `allows_resize()=false` | Confirmed | Medium |
| Crash at 09:25 | TOCTOU in decoration handling | Confirmed, fix in progress | High |
| Dual install | Two extension copies | Confirmed | Medium |

### Next Steps

1. **Implement:** Toggle-float flicker fix — fix `removeFloatOverride` filter + conditional `move()`
2. **Implement:** Try-catch pattern for TOCTOU crash fix in tree.js
3. **Clean up:** Remove dual installation
4. **Consider:** "Force tile" config override for windows like Edge

---

## Files Referenced

| File | Lines | Purpose |
|------|-------|---------|
| `lib/extension/window.js:1275-1295` | `processFloats()` | Float mode determination |
| `lib/extension/window.js:2839-2891` | `isFloatingExempt()` | Automatic float conditions |
| `lib/extension/window.js:141-163` | `toggleFloatingMode()` | Super+c / toggle handler |
| `lib/extension/window.js:483-520` | `command()` FloatToggle case | Toggle + render flow |
| `lib/extension/window.js:100-138` | `addFloatOverride/removeFloatOverride` | Config persistence |
| `lib/extension/window.js:1507-1570` | `trackWindow()` | Window creation (FLOAT default) |
| `lib/extension/window.js:1305-1320` | `reloadTree()` | Login initialization |
| `lib/extension/window.js:1722-1740` | `isActiveWindowWorkspaceTiled()` | Workspace tiling check |
| `lib/extension/tree.js:59-67` | `isDisposed()` | GObject disposal check |
| `lib/extension/tree.js:1490-1580` | `processNode()` | Decoration rendering |
| `lib/extension/tree.js:1770-1790` | Decoration positioning | show/hide/set_size |
| `lib/extension/dbus-interface.js:147-162` | `_serializeNodeValue()` | D-Bus window properties |
| `~/.config/forge/config/windows.json` | User config | Persisted float overrides |
| `config/windows.json` | Repo default | Default float overrides template |

---

## Comprehensive TOCTOU Fix Plan (2026-03-10)

### Second Crash — 2026-03-10 14:13:48

Same bug as Feb 14. Monitor manager assertion failures at 14:13:37 (display config change) → decoration widgets disposed → tree render at 14:13:48 hit disposed `St.BoxLayout` at tree.js:1708 (`.contains()` on disposed object) → Wayland socket broke same second → Xwayland crash → system reboot.

### Full Audit Results

**~35 TOCTOU-vulnerable locations** found across 3 files:

| File | Vulnerable Locations | Critical | High | Medium |
|------|---------------------|----------|------|--------|
| tree.js | 10 | 2 (lines 1688, 1700-1714) | 3 | 5 |
| window.js | 24 | 1 (showWindowBorders) | 6 | 17 |
| utils.js | 1 | 0 | 0 | 1 |

### Root Pattern

All share the same anti-pattern: calling native GObject methods on St.Widget objects that may have been disposed by GNOME Shell's GC. Three defense layers all fail:

1. **`isDisposed()` check-then-use** — TOCTOU race: GC can dispose between check and use
2. **JS truthiness checks** (`if (obj)`) — disposed GObjects are truthy, not null
3. **try-catch** — catches JS exceptions but NOT native segfaults from `contains()`, `add_child()`, `remove_child()` on disposed objects

### Fix Strategy: Layered Defense

**Layer 1 — Safe wrapper utilities** (`lib/extension/safe-widget.js`):
- `isDisposed(obj)` — shared utility (moved from tree.js)
- `safeCall(obj, method, ...args)` — isDisposed guard + try-catch. Returns `{ok, value}` or `{ok: false}`
- `safeDestroy(obj, parent)` — safe hide + remove_child + destroy_all_children + destroy

**Layer 2 — JS-side parent tracking** (avoid native `.contains()` entirely):
- Track which decoration owns which tab via a JS `WeakMap` or flag on the node
- Replace `decoration.contains(tab)` with `tab._parentDecoration === decoration`
- Eliminates the most dangerous native call pattern

**Layer 3 — try-catch at point of use** for all remaining native calls:
- Wrap every native method call site in try-catch
- On catch: null the reference, log warning, continue gracefully

**Layer 4 — Dangling reference cleanup**:
- Fix `windowDestroy()` to null `actor.border` and `actor.splitBorder` (currently only nulls local vars)
- Prevents subsequent code from operating on removed/disposed widgets

### 7-Phase Implementation Plan

| Phase | Scope | Files | Locations | Priority |
|-------|-------|-------|-----------|----------|
| 1 | Safe utility module | safe-widget.js (new) | N/A | Foundation |
| 2 | processTabbed() crash site | tree.js | 4 locations | Critical |
| 3 | Remaining tree.js | tree.js | 6 locations | High |
| 4 | showWindowBorders | window.js | 5 locations | High |
| 5 | Cleanup/destroy paths | window.js | 4 locations | High |
| 6 | Decoration layout + misc | window.js | 6 locations | Medium |
| 7 | utils.js + integration test | utils.js | 1 location | Medium |

Each phase: write TDD tests first → implement fix → run tests → verify no regressions.
