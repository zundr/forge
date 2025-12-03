# Forge GNOME Shell Extension - Developer Documentation

Forge is a GNOME Shell extension providing tree-based tiling window management similar to i3-wm and sway-wm.

**Repository**: https://github.com/forge-ext/forge  
**Status**: Looking for new maintainer

---

## Documentation Structure

> **Progressive Disclosure**: Start here for quick reference. Load detailed docs as needed.

| Document | Purpose | When to Load |
|----------|---------|--------------|
| **This file** | Quick reference, overview | Always |
| [docs/architecture.md](docs/architecture.md) | System overview, component index | Understanding system design |
| [docs/window-management.md](docs/window-management.md) | Window lifecycle, modes, rendering | Debugging window behavior |
| [docs/tree-system.md](docs/tree-system.md) | Node types, layouts, algorithms | Understanding layout calculations |
| [docs/keybindings.md](docs/keybindings.md) | Command system, adding shortcuts | Adding/modifying keybindings |
| [docs/dbus-api.md](docs/dbus-api.md) | D-Bus interface, CLI tools | External tool integration |
| [docs/configuration.md](docs/configuration.md) | Settings, overrides, workspace rules | Customizing behavior |
| [docs/theming.md](docs/theming.md) | CSS system, dynamic updates | Visual customization |
| [docs/development.md](docs/development.md) | Build, test, debug workflows | Contributing, debugging |

---

## Quick Reference

### CLI Tools
```bash
./forge-tree-dump              # Dump window tree structure
./forge-tree-dump -v           # Verbose output with all attributes
./forge-float-debug list       # List windows with float status
./forge-float-debug toggle ID  # Toggle float for window
```

### Key Files
| File | Purpose |
|------|---------|
| `extension.js` | Main extension entry point |
| `prefs.js` | Preferences UI entry point |
| `lib/extension/window.js` | Window management (~94KB) |
| `lib/extension/tree.js` | Tree-based tiling (~45KB) |
| `lib/extension/keybindings.js` | Keyboard shortcuts |
| `lib/extension/dbus-interface.js` | D-Bus API for CLI tools |
| `config/windows.json` | Window float overrides |
| `config/workspaces.json` | Workspace rules |

### Build Commands
```bash
make dev          # Build debug mode and install
make test-x       # Full X11 test cycle
make test-wayland # Nested Wayland session
make log          # Follow GNOME Shell logs
```

---

## 1. Project Overview

### Key Features
- Tree-based tiling with vertical/horizontal splits
- Vim-like keybindings for navigation
- Drag-and-drop tiling support
- Floating windows support
- Smart gaps and focus hints
- Stacked and tabbed layouts
- Per-workspace tiling configuration
- Multi-display support
- D-Bus interface for external tools

### Target Platforms
- GNOME Shell 45, 46, 47, 48, 49
- X11 and Wayland support

### Known Limitations
- Does not support dynamic workspaces
- Does not support vertical monitor setup

---

## 2. Project Structure

```
forge/
├── extension.js          # Main extension entry point
├── prefs.js              # Preferences UI entry point
├── metadata.json         # Extension metadata
├── stylesheet.css        # Extension styles
├── Makefile              # Build system
├── lib/
│   ├── extension/        # Runtime extension code
│   │   ├── window.js     # Window management
│   │   ├── tree.js       # Tree structure
│   │   ├── keybindings.js # Keyboard shortcuts
│   │   ├── dbus-interface.js # D-Bus API
│   │   ├── indicator.js  # Panel indicator
│   │   └── utils.js      # Utilities
│   ├── prefs/            # Preferences UI
│   │   ├── settings.js   # Settings page
│   │   ├── appearance.js # Appearance page
│   │   ├── keyboard.js   # Keyboard page
│   │   ├── workspace.js  # Workspace page
│   │   └── floating.js   # Floating rules page
│   ├── shared/           # Shared utilities
│   │   ├── settings.js   # GSettings wrapper
│   │   ├── theme.js      # Theme management
│   │   └── logger.js     # Logging
│   └── cli/              # CLI tool modules
│       └── tree-formatter.js
├── config/
│   ├── windows.json      # Window float overrides
│   └── workspaces.json   # Workspace rules
├── schemas/              # GSettings schemas
├── test/                 # Test suite
├── po/                   # Translations
└── resources/            # Icons
```

---

## 3. Core Architecture

### Extension Lifecycle

```javascript
// extension.js
enable() {
  this.settings = this.getSettings();
  this.kbdSettings = this.getSettings("org.gnome.shell.extensions.forge.keybindings");
  Logger.init(this.settings);
  this.configMgr = new ConfigManager(this);
  this.theme = new ExtensionThemeManager(this);
  this.extWm = new WindowManager(this);
  this.keybindings = new Keybindings(this);
  this.dbus = new ForgeDBus(this);  // D-Bus interface
  this.theme.patchCss();
  this.extWm.enable();
}

disable() {
  this.extWm?.disable();
  this.keybindings?.disable();
  this.dbus?.destroy();
  // Nullify all references
}
```

### Tree Structure

```
ROOT
├── WORKSPACE (ws0)
│   ├── MONITOR (mo0ws0)
│   │   ├── CON (HSPLIT)
│   │   │   ├── WINDOW (Terminal) [TILE]
│   │   │   └── CON (VSPLIT)
│   │   │       ├── WINDOW (Browser) [TILE]
│   │   │       └── WINDOW (Editor) [TILE]
│   │   └── WINDOW (Calculator) [FLOAT]
│   └── MONITOR (mo1ws0)
└── WORKSPACE (ws1)
```

**Node Types**: ROOT, WORKSPACE, MONITOR, CON, WINDOW  
**Layout Types**: HSPLIT, VSPLIT, STACKED, TABBED  
**Window Modes**: TILE, FLOAT, GRAB_TILE, DEFAULT

### Rendering Pipeline

1. **processNode()** - Calculate window positions recursively
2. **apply()** - Apply positions to Meta.Windows
3. **cleanTree()** - Remove orphaned containers

---

## 4. CLI Tools

### forge-tree-dump

Dumps the Forge window tree structure with Unicode box-drawing visualization.

```bash
./forge-tree-dump [OPTIONS]
```

**Options:**
- `-v, --verbose` - Show all attributes (rect, layout, window type)
- `-r, --rect` - Show rectangle dimensions
- `-h, --help` - Show help

**Example Output:**
```
ROOT
├── WORKSPACE 1
│   └── MONITOR mo0ws0 [HSPLIT]
│       ├── WINDOW class:firefox title:"Mozilla Firefox" id:12345 🔲 TILE
│       └── CON [VSPLIT]
│           ├── WINDOW class:gnome-terminal-server title:"Terminal" id:12346 🔲 TILE
│           └── WINDOW class:code title:"VS Code" id:12347 🎈 FLOAT
```

### forge-float-debug

Debug and manipulate window float status.

```bash
./forge-float-debug <command> [options]
```

**Commands:**
| Command | Description |
|---------|-------------|
| `list` | List all windows with float status |
| `overrides` | Show float overrides configuration |
| `toggle <id>` | Toggle float status for window |
| `set <id> <mode>` | Set window mode (FLOAT, TILE, GRAB_TILE, DEFAULT) |
| `watch` | Watch window mode changes in real-time |

### D-Bus Interface

Both tools communicate with Forge via D-Bus:
- **Bus**: `org.gnome.Shell`
- **Path**: `/org/gnome/Shell/Extensions/Forge`
- **Interface**: `org.gnome.Shell.Extensions.Forge`

**Methods:**
- `GetTree()` - Returns JSON tree structure
- `GetFloatOverrides()` - Returns float override configuration
- `SetWindowMode(windowId, mode)` - Set window mode
- `ToggleWindowFloat(windowId)` - Toggle float status

---

## 5. Development Guide

### Setup
```bash
git clone https://github.com/forge-ext/forge.git
cd forge
npm install
make build && make install && make enable
```

### Build Commands
| Command | Description |
|---------|-------------|
| `make all` | Build, install, enable, restart |
| `make build` | Compile to temp/ |
| `make install` | Install to ~/.local/share/gnome-shell/extensions/ |
| `make dev` | Build debug mode and install |
| `make test-x` | Full X11 test cycle |
| `make test-wayland` | Nested Wayland session |
| `make log` | Follow GNOME Shell logs |
| `make format` | Format code with Prettier |

### Testing
```bash
# Run all tests
npm test

# Test files:
test/tree-formatter.test.js          # Tree formatting
test/tree-condensing.test.js         # Tree cleanup
test/decoration-cleanup.test.js      # Decoration management
test/workspace-config-separation.test.js  # Workspace rules
test/window-workspace-placement.test.js   # Window placement
```

### Debugging
```bash
# Enable logging
gsettings set org.gnome.shell.extensions.forge logging-enabled true
gsettings set org.gnome.shell.extensions.forge log-level 5

# Watch logs
journalctl -f /usr/bin/gnome-shell | grep -i forge
```

---

## 6. Customization

### Window Overrides

**Location**: `~/.config/forge/config/windows.json`

```json
{
  "overrides": [
    { "wmClass": "org.gnome.Calculator", "mode": "float" },
    { "wmClass": "firefox", "wmTitle": "!Mozilla Firefox", "mode": "float" }
  ]
}
```

**Properties:**
- `wmClass` - Window class name
- `wmTitle` - Window title (prefix with `!` for negation)
- `wmId` - Specific window instance ID
- `mode` - `"float"` to always float

### Workspace Rules

**Location**: `~/.config/forge/config/workspaces.json`

```json
{
  "rules": [
    { "wmClass": "firefox", "workspace": 1 },
    { "wmClass": "code", "workspace": 2 }
  ]
}
```

Windows matching rules are automatically moved to specified workspaces.

**Keybinding**: `<Super><Shift>r` - Reorganize windows by workspace rules

### Stylesheet Customization

**Location**: `~/.config/forge/stylesheet/forge/stylesheet.css`

```css
.window-tiled-border {
  border-width: 4px;
  border-color: rgba(66, 133, 244, 1);
  border-radius: 12px;
}
```

**CSS Classes:**
- `.window-tiled-border` - Focused window border
- `.window-split-border` - Split direction indicator
- `.window-tabbed-tab` - Tab styling
- `.window-tilepreview-tiled` - Drag preview

### GSettings

```bash
# List all settings
gsettings list-recursively org.gnome.shell.extensions.forge

# Common settings
gsettings set org.gnome.shell.extensions.forge window-gap-size 8
gsettings set org.gnome.shell.extensions.forge focus-border-size 3
gsettings set org.gnome.shell.extensions.forge focus-border-color 'rgba(66, 133, 244, 1)'
```

---

## 7. Debugging & Troubleshooting

### Window Stuck in FLOAT Mode

**Diagnosis:**
```bash
./forge-float-debug overrides | grep -i <window-class>
./forge-float-debug list -v | grep -A3 <window-class>
```

**Common causes:**
- Float override with wmId (from `Super+c`)
- Class-wide float rule (from `Super+Shift+c` or config)
- Window type: DIALOG or MODAL_DIALOG
- Transient window
- Window doesn't allow resize

**Fix:**
```bash
./forge-float-debug toggle <window-id>
# Or force to TILE mode
./forge-float-debug set <window-id> TILE
```

### Extension Not Loading
```bash
journalctl -f /usr/bin/gnome-shell
gnome-extensions info forge@jmmaranan.com
```

### Reloading Extension
```bash
# Disable/enable (resets state)
gnome-extensions disable forge@jmmaranan.com
gnome-extensions enable forge@jmmaranan.com

# Full reload (X11): Alt+F2, type 'r'
# Full reload (Wayland): logout/login or use nested session
make test-wayland
```

---

## 8. Architecture Diagrams

### Component Interaction
```
┌─────────────────────────────────────────────────────────────┐
│                      extension.js                           │
│  enable() → Settings, Logger, ConfigManager, Theme,        │
│             WindowManager, Keybindings, DBus                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    WindowManager                            │
│  • Tree (window hierarchy)                                  │
│  • Event Queue (batched operations)                         │
│  • Signal Handlers (GNOME Shell events)                     │
│  • Border/Decoration Management                             │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     Tree     │    │ Keybindings  │    │    DBus      │
│ • Nodes      │    │ • Commands   │    │ • GetTree    │
│ • Layouts    │    │ • Modifiers  │    │ • SetMode    │
│ • Rendering  │    │              │    │ • Toggle     │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Event Flow
```
User Action (Keybinding/Mouse)
         │
         ▼
┌──────────────────────────┐
│  WindowManager.command() │
│  Focus/Swap/Move/Split   │
└──────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│   Tree Manipulation      │
│  tree.move/swap/split    │
└──────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│   queueEvent() (220ms)   │
└──────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│   renderTree()           │
│  processFloats → render  │
│  → updateBorders         │
└──────────────────────────┘
```

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **Container (CON)** | Non-leaf node grouping windows with a layout type |
| **Split** | Dividing a container horizontally or vertically |
| **Tile** | Window participating in automatic tiling layout |
| **Float** | Window not participating in tiling, freely positioned |
| **Focus Hint** | Colored border on focused window |
| **Smart Gaps** | Gaps hidden when single window present |
| **Tree** | Hierarchical structure of windows/workspaces/monitors |
| **Node** | Single element in tree (ROOT, WORKSPACE, MONITOR, CON, WINDOW) |
| **Render** | Calculate and apply window positions from tree |

---

## 10. Default Keybindings

| Action | Shortcut |
|--------|----------|
| Focus left/down/up/right | `Super + h/j/k/l` |
| Swap window | `Ctrl + Super + h/j/k/l` |
| Move window | `Shift + Super + h/j/k/l` |
| Split horizontal | `Super + z` |
| Split vertical | `Super + v` |
| Toggle split | `Super + g` |
| Toggle float | `Super + c` |
| Toggle class float | `Super + Shift + c` |
| Toggle stacked | `Shift + Super + s` |
| Toggle tabbed | `Shift + Super + t` |
| Gap increase/decrease | `Ctrl + Super + Plus/Minus` |
| Toggle tiling | `Super + w` |
| Toggle workspace tiling | `Shift + Super + w` |
| Reorganize workspaces | `Shift + Super + r` |
| Open preferences | `Super + .` |
