# Window Management

> Deep dive into `lib/extension/window.js` (~94KB)

## Overview

The `WindowManager` class is the central orchestrator for all window operations. It manages:
- Window lifecycle (creation, focus, destruction)
- Tree rendering coordination
- Event batching via queue system
- Border and decoration management
- Drag-and-drop tiling
- Float/tile mode switching

---

## Window Modes

```javascript
WINDOW_MODES = {
  FLOAT,      // Window floats above tiling layout
  TILE,       // Window participates in tiling
  GRAB_TILE,  // Temporary mode during drag-and-drop
  DEFAULT     // Initial/unset mode
}
```

### Mode Transitions

```
DEFAULT ──→ TILE (normal window)
    │
    └──→ FLOAT (via override or toggle)

TILE ←──→ FLOAT (Super+c toggle)
    │
    └──→ GRAB_TILE (during drag) ──→ TILE (on drop)
```

---

## WindowManager Lifecycle

### Constructor

```javascript
constructor(ext) {
  this.ext = ext;
  this.reloadWindowOverrides();    // Load config/windows.json
  this.reloadWorkspaceRules();     // Load config/workspaces.json
  this._tree = new Tree(this);
  this.eventQueue = new Queue();
  
  if (this.shouldFocusOnHover) {
    this.pointerLoopInit();        // Start pointer tracking
  }
}
```

### enable()

```javascript
enable() {
  this._bindSignals();      // Connect to GNOME Shell signals
  this.reloadTree("enable"); // Build initial window tree
}
```

### disable()

```javascript
disable() {
  Utils._disableDecorations(); // Restore window decorations
  this._removeSignals();       // Disconnect all signals
  this.disabled = true;
}
```

---

## Signal Binding

### Display Signals (`global.display`)

| Signal | Handler | Purpose |
|--------|---------|---------|
| `window-created` | `trackWindow()` | Add new windows to tree |
| `grab-op-begin` | `_grabOpBegin()` | Start drag/resize handling |
| `grab-op-end` | `_grabOpEnd()` | Complete drag/resize |
| `window-entered-monitor` | `updateMetaWorkspaceMonitor()` | Track monitor changes |
| `showing-desktop-changed` | Hide borders | Desktop mode |
| `workareas-changed` | `reloadTree()` | Monitor add/remove |

### Workspace Manager Signals

| Signal | Handler | Purpose |
|--------|---------|---------|
| `workspace-added` | `tree.addWorkspace()` | Add workspace node |
| `workspace-removed` | `tree.removeWorkspace()` | Remove workspace node |
| `active-workspace-changed` | Update borders | Workspace switch |

### Per-Window Signals

| Signal | Handler | Purpose |
|--------|---------|---------|
| `position-changed` | Update state | Window moved |
| `size-changed` | Update state | Window resized |
| `unmanaged` | `_windowUnmanaged()` | Window closed |
| `focus` | `_windowFocused()` | Window focused |

---

## Window Tracking

### trackWindow(metaWindow)

Called when `window-created` signal fires:

```javascript
trackWindow(metaWindow) {
  // 1. Validate window
  if (!this._validWindow(metaWindow)) return;
  
  // 2. Auto-split logic (if enabled)
  if (this.autoSplitEnabled) {
    let focusNode = this.findNodeWindow(this.focusMetaWindow);
    if (focusNode?.parentNode?.layout in [HSPLIT, VSPLIT]) {
      // Determine split orientation from window dimensions
      let orientation = rect.width > rect.height ? "horizontal" : "vertical";
      this.tree.split(focusNode, orientation);
    }
  }
  
  // 3. Find attachment point
  let attachNode = this.tree.attachNode || this._findMonitorNode();
  
  // 4. Create window node
  this.tree.createNode(attachNode, NODE_TYPES.WINDOW, metaWindow, WINDOW_MODES.FLOAT);
  
  // 5. Bind per-window signals
  this._bindWindowSignals(metaWindow);
  
  // 6. Trigger render
  this.renderTree("trackWindow");
}
```

### Window Validation (_validWindow)

Returns `false` for:
- Null or invalid windows
- Skip-taskbar windows
- Transient windows (dialogs with parent)
- Windows matching float overrides
- Certain window types (DESKTOP, DOCK, etc.)

```javascript
_validWindow(metaWindow) {
  if (!metaWindow) return false;
  if (metaWindow.is_skip_taskbar()) return false;
  if (metaWindow.get_transient_for() !== null) return false;
  if (this.isFloatingExempt(metaWindow)) return false;
  // ... more checks
  return true;
}
```

---

## Rendering System

### renderTree(from, force)

Main rendering entry point:

```javascript
renderTree(from, force = false) {
  if (this._freezeRender && !force) {
    // Only update decorations when frozen
    this.updateDecorationLayout();
    this.updateBorderLayout();
    return;
  }
  
  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
    this.processFloats();           // Determine FLOAT vs TILE
    this.tree.render(from);         // Calculate positions
    this.updateDecorationLayout();  // Update tab decorations
    this.updateBorderLayout();      // Update focus borders
    return GLib.SOURCE_REMOVE;
  });
}
```

### processFloats()

Determines which windows should float:

```javascript
processFloats() {
  let allWindows = this.tree.getNodeByType(NODE_TYPES.WINDOW);
  
  for (let nodeWindow of allWindows) {
    let metaWindow = nodeWindow.nodeValue;
    
    if (this.isFloatingExempt(metaWindow)) {
      nodeWindow.mode = WINDOW_MODES.FLOAT;
    } else if (!this.isActiveWindowWorkspaceTiled(metaWindow)) {
      nodeWindow.mode = WINDOW_MODES.FLOAT;
    } else {
      nodeWindow.mode = WINDOW_MODES.TILE;
    }
  }
}
```

### Float Exemption Checks

```javascript
isFloatingExempt(metaWindow) {
  // Check window overrides
  for (let override of this.windowOverrides) {
    if (this._matchesOverride(metaWindow, override)) {
      return override.mode === "float";
    }
  }
  
  // Check window type
  let windowType = metaWindow.get_window_type();
  if (windowType === Meta.WindowType.DIALOG) return true;
  if (windowType === Meta.WindowType.MODAL_DIALOG) return true;
  
  // Check if window allows resize
  if (!metaWindow.allows_resize()) return true;
  
  return false;
}
```

---

## Event Queue System

Batches operations to prevent excessive rendering:

```javascript
queueEvent(event) {
  this.eventQueue.enqueue(event);
  
  if (!this._eventQueueTimeout) {
    this._eventQueueTimeout = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      220,  // 220ms batch interval
      () => {
        this._processEventQueue();
        this._eventQueueTimeout = null;
        return GLib.SOURCE_REMOVE;
      }
    );
  }
}

_processEventQueue() {
  while (!this.eventQueue.isEmpty()) {
    let event = this.eventQueue.dequeue();
    event.callback();
  }
}
```

---

## Grab Operations (Drag/Resize)

### grab-op-begin

```javascript
_grabOpBegin(display, metaWindow, grabOp) {
  this._grabOp = grabOp;
  
  if (this._isMoving(grabOp)) {
    let nodeWindow = this.findNodeWindow(metaWindow);
    if (nodeWindow?.mode === WINDOW_MODES.TILE) {
      // Switch to GRAB_TILE mode
      nodeWindow.mode = WINDOW_MODES.GRAB_TILE;
      this._freezeRender = true;
      this._grabStartRect = metaWindow.get_frame_rect();
    }
  }
}
```

### grab-op-end

```javascript
_grabOpEnd(display, metaWindow, grabOp) {
  let nodeWindow = this.findNodeWindow(metaWindow);
  
  if (nodeWindow?.mode === WINDOW_MODES.GRAB_TILE) {
    // Determine drop position
    let dropTarget = this._findDropTarget(metaWindow);
    
    if (dropTarget) {
      // Move window to new position in tree
      this.tree.move(nodeWindow, dropTarget);
    }
    
    nodeWindow.mode = WINDOW_MODES.TILE;
    this._freezeRender = false;
    this.renderTree("grab-op-end");
  }
  
  this._grabOp = null;
}
```

---

## Command Processing

### command(action)

Processes keybinding actions:

```javascript
command(action) {
  let focusWindow = this.focusMetaWindow;
  let focusNode = this.findNodeWindow(focusWindow);
  
  switch (action.name) {
    case "Focus":
      this._handleFocus(action.direction);
      break;
      
    case "Swap":
      this.tree.swap(focusNode, action.direction);
      this.renderTree("Swap");
      break;
      
    case "Move":
      this.tree.move(focusNode, action.direction);
      this.renderTree("Move");
      break;
      
    case "Split":
      this.tree.split(focusNode, action.orientation);
      this.renderTree("Split");
      break;
      
    case "FloatToggle":
    case "FloatClassToggle":
      this.toggleFloatingMode(action, focusWindow);
      break;
      
    case "LayoutToggle":
      this._toggleLayout(focusNode);
      break;
      
    case "GapIncrease":
    case "GapDecrease":
      this._adjustGaps(action.name);
      break;
      
    case "ReorganizeWorkspaces":
      this.reorganizeWindowsByWorkspaceRules();
      break;
  }
}
```

---

## Border Management

### updateBorderLayout()

Updates focus border around active window:

```javascript
updateBorderLayout() {
  // Remove old borders
  this._cleanupBorders();
  
  if (!this.settings.get_boolean("focus-border-toggle")) return;
  
  let focusNode = this.findNodeWindow(this.focusMetaWindow);
  if (!focusNode || focusNode.mode !== WINDOW_MODES.TILE) return;
  
  // Create border actor
  let border = new St.Bin({
    style_class: "window-tiled-border",
    x: focusNode.rect.x,
    y: focusNode.rect.y,
    width: focusNode.rect.width,
    height: focusNode.rect.height,
  });
  
  global.window_group.add_child(border);
  focusNode.border = border;
}
```

---

## Decoration Management

### updateDecorationLayout()

Manages tab decorations for stacked/tabbed layouts:

```javascript
updateDecorationLayout() {
  let containers = this.tree.getNodeByType(NODE_TYPES.CON);
  
  for (let con of containers) {
    if (con.layout === LAYOUT_TYPES.STACKED || 
        con.layout === LAYOUT_TYPES.TABBED) {
      this._updateContainerDecoration(con);
    }
  }
}

_updateContainerDecoration(con) {
  let tiledChildren = con.childNodes.filter(n => n.mode === WINDOW_MODES.TILE);
  
  if (tiledChildren.length > 0 && this.showTabDecoration) {
    con.decoration?.show();
    // Update tab labels, positions, etc.
  } else {
    con.decoration?.hide();
  }
}
```

---

## Focus Management

### Focus on Hover

```javascript
pointerLoopInit() {
  this._pointerFocusTimeoutId = GLib.timeout_add(
    GLib.PRIORITY_DEFAULT,
    16,  // ~60fps
    this._focusWindowUnderPointer.bind(this)
  );
}

_focusWindowUnderPointer() {
  let [x, y] = global.get_pointer();
  let windowUnderPointer = this._findWindowAtPoint(x, y);
  
  if (windowUnderPointer && windowUnderPointer !== this.focusMetaWindow) {
    windowUnderPointer.activate(global.get_current_time());
  }
  
  return GLib.SOURCE_CONTINUE;
}
```

### Move Pointer with Focus

```javascript
movePointerWith(nodeWindow) {
  if (!this.settings.get_boolean("move-pointer-focus-enabled")) return;
  
  let rect = nodeWindow.rect;
  let centerX = rect.x + rect.width / 2;
  let centerY = rect.y + rect.height / 2;
  
  // Warp pointer to window center
  let seat = Clutter.get_default_backend().get_default_seat();
  seat.warp_pointer(centerX, centerY);
}
```

---

## Key Methods Reference

| Method | Purpose |
|--------|---------|
| `enable()` | Initialize and bind signals |
| `disable()` | Cleanup and unbind signals |
| `trackWindow()` | Add window to tree |
| `renderTree()` | Trigger layout recalculation |
| `command()` | Process keybinding action |
| `move()` | Apply position to Meta.Window |
| `processFloats()` | Determine float/tile modes |
| `queueEvent()` | Batch event processing |
| `updateBorderLayout()` | Update focus borders |
| `updateDecorationLayout()` | Update tab decorations |
| `toggleFloatingMode()` | Toggle window float status |
| `reloadTree()` | Rebuild entire tree |
| `reloadWindowOverrides()` | Reload config/windows.json |
| `reloadWorkspaceRules()` | Reload config/workspaces.json |
