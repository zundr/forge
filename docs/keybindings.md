# Keybindings

> Deep dive into `lib/extension/keybindings.js`

## Overview

The keybindings system maps keyboard shortcuts to WindowManager commands using GNOME Shell's keybinding API.

---

## Architecture

```
GSettings Schema (keybindings)
        │
        ▼
┌──────────────────┐
│   Keybindings    │
│  _bindings map   │
└──────────────────┘
        │
        ▼
Main.wm.addKeybinding()
        │
        ▼
WindowManager.command(action)
```

---

## Keybindings Class

### Constructor

```javascript
class Keybindings {
  constructor(ext) {
    this._grabbers = new Map();
    this.ext = ext;
    this.extWm = ext.extWm;
    this.kbdSettings = ext.kbdSettings;  // Keybindings GSettings
    this.settings = ext.settings;         // Main GSettings
    this.buildBindingDefinitions();
  }
}
```

### enable() / disable()

```javascript
enable() {
  for (const key in this._bindings) {
    Main.wm.addKeybinding(
      key,
      this.kbdSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      this._bindings[key]
    );
  }
}

disable() {
  for (const key in this._bindings) {
    Main.wm.removeKeybinding(key);
  }
}
```

---

## Binding Definitions

### buildBindingDefinitions()

Maps keybinding names to callback functions:

```javascript
buildBindingDefinitions() {
  this._bindings = {
    // Focus navigation
    "window-focus-left": () => 
      this.extWm.command({ name: "Focus", direction: "Left" }),
    "window-focus-down": () => 
      this.extWm.command({ name: "Focus", direction: "Down" }),
    "window-focus-up": () => 
      this.extWm.command({ name: "Focus", direction: "Up" }),
    "window-focus-right": () => 
      this.extWm.command({ name: "Focus", direction: "Right" }),
    
    // Window swapping
    "window-swap-left": () => 
      this.extWm.command({ name: "Swap", direction: "Left" }),
    "window-swap-down": () => 
      this.extWm.command({ name: "Swap", direction: "Down" }),
    "window-swap-up": () => 
      this.extWm.command({ name: "Swap", direction: "Up" }),
    "window-swap-right": () => 
      this.extWm.command({ name: "Swap", direction: "Right" }),
    
    // Window moving
    "window-move-left": () => 
      this.extWm.command({ name: "Move", direction: "Left" }),
    "window-move-down": () => 
      this.extWm.command({ name: "Move", direction: "Down" }),
    "window-move-up": () => 
      this.extWm.command({ name: "Move", direction: "Up" }),
    "window-move-right": () => 
      this.extWm.command({ name: "Move", direction: "Right" }),
    
    // Container splitting
    "con-split-horizontal": () => 
      this.extWm.command({ name: "Split", orientation: "horizontal" }),
    "con-split-vertical": () => 
      this.extWm.command({ name: "Split", orientation: "vertical" }),
    "con-split-layout-toggle": () => 
      this.extWm.command({ name: "LayoutToggle" }),
    
    // Layout modes
    "con-stacked-layout-toggle": () => 
      this.extWm.command({ name: "LayoutToggle", layout: "stacked" }),
    "con-tabbed-layout-toggle": () => 
      this.extWm.command({ name: "LayoutToggle", layout: "tabbed" }),
    "con-tabbed-showtab-decoration-toggle": () => 
      this.extWm.command({ name: "TabDecorationToggle" }),
    
    // Floating
    "window-toggle-float": () => 
      this.extWm.command({ name: "FloatToggle" }),
    "window-toggle-always-float": () => 
      this.extWm.command({ name: "FloatClassToggle" }),
    
    // Gaps
    "window-gap-size-increase": () => 
      this.extWm.command({ name: "GapIncrease" }),
    "window-gap-size-decrease": () => 
      this.extWm.command({ name: "GapDecrease" }),
    
    // Tiling toggle
    "prefs-tiling-toggle": () => 
      this.extWm.command({ name: "TilingToggle" }),
    "prefs-tiling-toggle-focus": () => 
      this.extWm.command({ name: "FocusHintToggle" }),
    
    // Workspace
    "workspace-active-tile-toggle": () => 
      this.extWm.command({ name: "WorkspaceTilingToggle" }),
    "workspace-reorganize": () => 
      this.extWm.command({ name: "ReorganizeWorkspaces" }),
    
    // Window resizing
    "window-resize-left-increase": () => 
      this.extWm.command({ name: "Resize", direction: "Left", amount: 1 }),
    "window-resize-left-decrease": () => 
      this.extWm.command({ name: "Resize", direction: "Left", amount: -1 }),
    // ... more resize bindings
    
    // Swap with last
    "window-swap-last-active": () => 
      this.extWm.command({ name: "SwapLastActive" }),
    
    // Snap presets
    "window-snap-left-two-third": () => 
      this.extWm.command({ name: "Snap", preset: "left-two-third" }),
    "window-snap-right-two-third": () => 
      this.extWm.command({ name: "Snap", preset: "right-two-third" }),
    // ... more snap bindings
  };
}
```

---

## Default Keybindings

| Action | Default Shortcut | Command |
|--------|------------------|---------|
| Focus left | `Super+h` | `Focus Left` |
| Focus down | `Super+j` | `Focus Down` |
| Focus up | `Super+k` | `Focus Up` |
| Focus right | `Super+l` | `Focus Right` |
| Swap left | `Ctrl+Super+h` | `Swap Left` |
| Swap down | `Ctrl+Super+j` | `Swap Down` |
| Swap up | `Ctrl+Super+k` | `Swap Up` |
| Swap right | `Ctrl+Super+l` | `Swap Right` |
| Move left | `Shift+Super+h` | `Move Left` |
| Move down | `Shift+Super+j` | `Move Down` |
| Move up | `Shift+Super+k` | `Move Up` |
| Move right | `Shift+Super+l` | `Move Right` |
| Split horizontal | `Super+z` | `Split horizontal` |
| Split vertical | `Super+v` | `Split vertical` |
| Toggle split | `Super+g` | `LayoutToggle` |
| Toggle stacked | `Shift+Super+s` | `LayoutToggle stacked` |
| Toggle tabbed | `Shift+Super+t` | `LayoutToggle tabbed` |
| Toggle float | `Super+c` | `FloatToggle` |
| Toggle class float | `Shift+Super+c` | `FloatClassToggle` |
| Gap increase | `Ctrl+Super+Plus` | `GapIncrease` |
| Gap decrease | `Ctrl+Super+Minus` | `GapDecrease` |
| Toggle tiling | `Super+w` | `TilingToggle` |
| Toggle workspace tiling | `Shift+Super+w` | `WorkspaceTilingToggle` |
| Reorganize workspaces | `Shift+Super+r` | `ReorganizeWorkspaces` |
| Open preferences | `Super+.` | Open prefs |
| Swap last active | `Super+Return` | `SwapLastActive` |

---

## Adding a New Keybinding

### Step 1: Add to GSettings Schema

Edit `schemas/org.gnome.shell.extensions.forge.gschema.xml`:

```xml
<schema id="org.gnome.shell.extensions.forge.keybindings" 
        path="/org/gnome/shell/extensions/forge/keybindings/">
  
  <!-- Add new keybinding -->
  <key type="as" name="my-custom-action">
    <default>['&lt;Super&gt;&lt;Shift&gt;m']</default>
    <summary>My custom action</summary>
  </key>
  
</schema>
```

### Step 2: Compile Schema

```bash
glib-compile-schemas schemas/
```

### Step 3: Add Binding Definition

Edit `lib/extension/keybindings.js`:

```javascript
buildBindingDefinitions() {
  this._bindings = {
    // ... existing bindings ...
    
    "my-custom-action": () => {
      this.extWm.command({ 
        name: "MyCustomAction",
        param1: "value1"
      });
    }
  };
}
```

### Step 4: Implement Command Handler

Edit `lib/extension/window.js`:

```javascript
command(action) {
  switch (action.name) {
    // ... existing cases ...
    
    case "MyCustomAction":
      this._handleMyCustomAction(action.param1);
      break;
  }
}

_handleMyCustomAction(param1) {
  let focusedWindow = this.focusMetaWindow;
  // Implementation here
}
```

---

## Keybinding Format

### GSettings Format

```xml
<!-- Single binding -->
<default>['&lt;Super&gt;h']</default>

<!-- Multiple bindings -->
<default>['&lt;Super&gt;h', '&lt;Alt&gt;Left']</default>

<!-- No binding (disabled) -->
<default>[]</default>
```

### Modifier Keys

| Modifier | XML Escape | Display |
|----------|------------|---------|
| Super | `&lt;Super&gt;` | `<Super>` |
| Ctrl | `&lt;Ctrl&gt;` | `<Ctrl>` |
| Shift | `&lt;Shift&gt;` | `<Shift>` |
| Alt | `&lt;Alt&gt;` | `<Alt>` |

### Key Names

- Letters: `a`, `b`, `c`, ...
- Numbers: `1`, `2`, `3`, ...
- Function keys: `F1`, `F2`, ...
- Special: `Return`, `space`, `Tab`, `Escape`
- Arrows: `Left`, `Right`, `Up`, `Down`
- Symbols: `plus`, `minus`, `period`, `comma`

---

## Drag-and-Drop Modifier

### allowDragDropTile()

Checks if modifier key is pressed during drag:

```javascript
allowDragDropTile() {
  let [x, y, mods] = global.get_pointer();
  let modSetting = this.settings.get_string("dnd-center-layout");
  
  switch (modSetting) {
    case "Super":
      return (mods & Clutter.ModifierType.MOD4_MASK) !== 0;
    case "Alt":
      return (mods & Clutter.ModifierType.MOD1_MASK) !== 0;
    case "Ctrl":
      return (mods & Clutter.ModifierType.CONTROL_MASK) !== 0;
    case "None":
      return true;
    default:
      return false;
  }
}
```

---

## Command Actions Reference

| Command | Parameters | Description |
|---------|------------|-------------|
| `Focus` | `direction` | Focus adjacent window |
| `Swap` | `direction` | Swap with adjacent window |
| `Move` | `direction` | Move to adjacent container |
| `Split` | `orientation` | Split container |
| `LayoutToggle` | `layout?` | Toggle layout type |
| `FloatToggle` | - | Toggle window float |
| `FloatClassToggle` | - | Toggle class float |
| `GapIncrease` | - | Increase gaps |
| `GapDecrease` | - | Decrease gaps |
| `TilingToggle` | - | Toggle tiling mode |
| `WorkspaceTilingToggle` | - | Toggle workspace tiling |
| `ReorganizeWorkspaces` | - | Apply workspace rules |
| `Resize` | `direction`, `amount` | Resize window |
| `SwapLastActive` | - | Swap with last focused |
| `Snap` | `preset` | Snap to preset position |
| `TabDecorationToggle` | - | Toggle tab decoration |
| `FocusHintToggle` | - | Toggle focus border |

---

## Troubleshooting

### Keybinding Conflicts

Check for conflicts with GNOME settings:

```bash
# List all GNOME keybindings
gsettings list-recursively | grep -i keybind

# Check specific binding
gsettings get org.gnome.desktop.wm.keybindings switch-to-workspace-1
```

### Keybinding Not Working

1. Check if binding is set:
```bash
gsettings get org.gnome.shell.extensions.forge.keybindings window-focus-left
```

2. Check for conflicts in GNOME Control Center → Keyboard → Shortcuts

3. Enable logging and check for errors:
```bash
gsettings set org.gnome.shell.extensions.forge logging-enabled true
journalctl -f /usr/bin/gnome-shell | grep -i keybind
```

### Reset Keybindings

```bash
# Reset single keybinding
gsettings reset org.gnome.shell.extensions.forge.keybindings window-focus-left

# Reset all keybindings
gsettings reset-recursively org.gnome.shell.extensions.forge.keybindings
```
