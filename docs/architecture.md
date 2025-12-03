# Forge Architecture

> **Progressive Disclosure**: This document provides a system overview. Load subdocuments for deep dives into specific features.

## Document Index

| Document | Purpose | When to Load |
|----------|---------|--------------|
| [window-management.md](window-management.md) | Window lifecycle, modes, rendering | Debugging window behavior, understanding tiling |
| [tree-system.md](tree-system.md) | Node types, layouts, tree algorithms | Understanding layout calculations, tree manipulation |
| [keybindings.md](keybindings.md) | Command system, adding shortcuts | Adding/modifying keybindings |
| [dbus-api.md](dbus-api.md) | D-Bus interface, CLI tools | External tool integration, debugging |
| [configuration.md](configuration.md) | Settings, overrides, workspace rules | Customizing behavior |
| [theming.md](theming.md) | CSS system, dynamic updates | Visual customization |
| [development.md](development.md) | Build, test, debug workflows | Contributing, debugging |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        extension.js                              │
│  Entry point: enable() / disable()                              │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│ ConfigManager│    │  WindowManager   │    │  Keybindings │
│  (settings)  │    │   (window.js)    │    │              │
└──────────────┘    └──────────────────┘    └──────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   Tree   │   │  Theme   │   │   DBus   │
        │(tree.js) │   │ Manager  │   │ Interface│
        └──────────┘   └──────────┘   └──────────┘
```

## Core Components

### 1. Extension Entry Point (`extension.js`)

Manages extension lifecycle:

```javascript
enable() {
  this.settings = this.getSettings();
  this.kbdSettings = this.getSettings("...keybindings");
  this.configMgr = new ConfigManager(this);
  this.theme = new ExtensionThemeManager(this);
  this.extWm = new WindowManager(this);
  this.keybindings = new Keybindings(this);
  this.dbus = new ForgeDBus(this);
  // ...
}
```

**Session Mode Handling**:
- `user` mode: Full functionality, keybindings enabled
- `unlock-dialog` mode: Keybindings disabled, tree preserved in memory

### 2. WindowManager (`lib/extension/window.js`)

Central orchestrator (~94KB). Responsibilities:
- Window tracking and lifecycle
- Tree rendering coordination
- Event queue management
- Border/decoration management
- Drag-and-drop tiling

**Key Methods**:
| Method | Purpose |
|--------|---------|
| `enable()` | Bind signals, build initial tree |
| `trackWindow()` | Add new window to tree |
| `renderTree()` | Trigger layout recalculation |
| `command()` | Process keybinding actions |
| `move()` | Apply position to window |

→ See [window-management.md](window-management.md) for details

### 3. Tree (`lib/extension/tree.js`)

Hierarchical window layout structure (~45KB):

```
ROOT
├── WORKSPACE (ws0)
│   └── MONITOR (mo0ws0)
│       ├── CON [HSPLIT]
│       │   ├── WINDOW [TILE]
│       │   └── WINDOW [TILE]
│       └── WINDOW [FLOAT]
└── WORKSPACE (ws1)
```

**Node Types**: `ROOT`, `WORKSPACE`, `MONITOR`, `CON`, `WINDOW`  
**Layout Types**: `HSPLIT`, `VSPLIT`, `STACKED`, `TABBED`  
**Window Modes**: `TILE`, `FLOAT`, `GRAB_TILE`, `DEFAULT`

→ See [tree-system.md](tree-system.md) for details

### 4. Keybindings (`lib/extension/keybindings.js`)

Maps keyboard shortcuts to commands:

```javascript
this._bindings = {
  "window-focus-left": () => this.extWm.command({ name: "Focus", direction: "Left" }),
  "window-swap-left": () => this.extWm.command({ name: "Swap", direction: "Left" }),
  // ...
};
```

→ See [keybindings.md](keybindings.md) for details

### 5. D-Bus Interface (`lib/extension/dbus-interface.js`)

External API for CLI tools:

```
Bus: org.gnome.Shell
Path: /org/gnome/Shell/Extensions/Forge
Interface: org.gnome.Shell.Extensions.Forge

Methods:
- GetTree() → JSON tree structure
- GetFloatOverrides() → Float configuration
- SetWindowMode(windowId, mode) → Set window mode
- ToggleWindowFloat(windowId) → Toggle float status
```

→ See [dbus-api.md](dbus-api.md) for details

### 6. Configuration (`lib/shared/settings.js`)

Two configuration systems:

| System | File | Purpose |
|--------|------|---------|
| GSettings | `schemas/*.gschema.xml` | Runtime settings |
| JSON Config | `config/windows.json` | Window float overrides |
| JSON Config | `config/workspaces.json` | Workspace placement rules |

→ See [configuration.md](configuration.md) for details

### 7. Theme Manager (`lib/shared/theme.js`)

Dynamic CSS manipulation:
- Parses CSS using vendored ReworkCSS
- Injects settings (border color, size) into CSS
- Reloads stylesheet without restart

→ See [theming.md](theming.md) for details

---

## Data Flow

### Window Creation Flow

```
window-created signal
        │
        ▼
trackWindow(metaWindow)
        │
        ├─→ _validWindow() check
        ├─→ Auto-split logic (if enabled)
        ├─→ Find attachment point
        ├─→ tree.createNode()
        └─→ renderTree()
                │
                ▼
        ┌───────────────┐
        │ processFloats │ Determine FLOAT vs TILE
        └───────────────┘
                │
                ▼
        ┌───────────────┐
        │ tree.render() │ Calculate positions
        └───────────────┘
                │
                ▼
        ┌───────────────┐
        │    apply()    │ Move windows
        └───────────────┘
```

### Command Flow

```
Keybinding pressed
        │
        ▼
Keybindings._bindings[key]()
        │
        ▼
WindowManager.command(action)
        │
        ├─→ Focus: tree.findAdjacentWindow()
        ├─→ Swap: tree.swap()
        ├─→ Move: tree.move()
        ├─→ Split: tree.split()
        └─→ FloatToggle: toggleFloatingMode()
                │
                ▼
        queueEvent() (220ms batch)
                │
                ▼
        renderTree()
```

---

## Signal Connections

WindowManager connects to GNOME Shell signals:

**Display Signals** (`global.display`):
- `window-created` → Track new windows
- `grab-op-begin/end` → Handle drag/resize
- `window-entered-monitor` → Monitor changes
- `workareas-changed` → Re-render on monitor changes

**Workspace Manager** (`global.workspace_manager`):
- `workspace-added/removed` → Update tree
- `active-workspace-changed` → Update borders

**Per-Window Signals**:
- `position-changed`, `size-changed` → Update state
- `unmanaged` → Remove from tree
- `focus` → Update borders, decorations

---

## File Structure

```
forge/
├── extension.js              # Entry point
├── prefs.js                  # Preferences UI entry
├── lib/
│   ├── extension/
│   │   ├── window.js         # WindowManager (94KB)
│   │   ├── tree.js           # Tree structure (45KB)
│   │   ├── keybindings.js    # Keyboard shortcuts
│   │   ├── dbus-interface.js # D-Bus API
│   │   ├── indicator.js      # Panel indicator
│   │   └── utils.js          # Utilities
│   ├── prefs/
│   │   ├── settings.js       # Settings page
│   │   ├── appearance.js     # Appearance page
│   │   ├── keyboard.js       # Keyboard page
│   │   ├── workspace.js      # Workspace page
│   │   └── floating.js       # Floating rules
│   ├── shared/
│   │   ├── settings.js       # ConfigManager
│   │   ├── theme.js          # Theme parsing
│   │   └── logger.js         # Logging
│   └── cli/
│       └── tree-formatter.js # CLI tree formatting
├── config/
│   ├── windows.json          # Float overrides
│   └── workspaces.json       # Workspace rules
├── schemas/
│   └── *.gschema.xml         # GSettings schemas
├── test/                     # Test suite
└── docs/                     # This documentation
```

---

## Quick Reference

### Enums

```javascript
// Window modes
WINDOW_MODES = { FLOAT, TILE, GRAB_TILE, DEFAULT }

// Node types
NODE_TYPES = { ROOT, MONITOR, CON, WINDOW, WORKSPACE }

// Layout types
LAYOUT_TYPES = { STACKED, TABBED, ROOT, HSPLIT, VSPLIT, PRESET }

// Grab types
GRAB_TYPES = { RESIZING, MOVING, UNKNOWN }
```

### Key Classes

| Class | File | Purpose |
|-------|------|---------|
| `ForgeExtension` | extension.js | Entry point |
| `WindowManager` | window.js | Window orchestration |
| `Tree` | tree.js | Layout structure |
| `Node` | tree.js | Tree node |
| `Keybindings` | keybindings.js | Keyboard shortcuts |
| `ConfigManager` | settings.js | Configuration |
| `ForgeDBus` | dbus-interface.js | External API |

### Important Settings

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `tiling-mode-enabled` | bool | true | Master tiling toggle |
| `window-gap-size` | uint | 4 | Gap between windows |
| `focus-border-toggle` | bool | true | Show focus border |
| `focus-border-color` | string | rgba(236,94,94,1) | Border color |
| `auto-split-enabled` | bool | true | Auto quarter-tiling |
