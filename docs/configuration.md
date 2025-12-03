# Configuration

> Deep dive into settings, overrides, and workspace rules

## Overview

Forge uses three configuration systems:

| System | Location | Purpose |
|--------|----------|---------|
| GSettings | `schemas/*.gschema.xml` | Runtime settings |
| Window Overrides | `config/windows.json` | Float rules |
| Workspace Rules | `config/workspaces.json` | Window placement |

---

## GSettings

### Schema Files

- **Main**: `org.gnome.shell.extensions.forge`
- **Keybindings**: `org.gnome.shell.extensions.forge.keybindings`

### Key Settings

#### Visual Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `focus-border-toggle` | bool | true | Show focus border |
| `focus-border-size` | uint | 3 | Border thickness (px) |
| `focus-border-color` | string | `rgba(236,94,94,1)` | Border color |
| `split-border-toggle` | bool | true | Show split indicator |
| `split-border-color` | string | `rgba(255,246,108,1)` | Split color |

#### Gap Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `window-gap-size` | uint | 4 | Gap between windows |
| `window-gap-size-increment` | uint | 1 | Gap adjustment step |
| `window-gap-hidden-on-single` | bool | false | Hide gaps with single window |

#### Layout Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tiling-mode-enabled` | bool | true | Master tiling toggle |
| `stacked-tiling-mode-enabled` | bool | true | Allow stacked layout |
| `tabbed-tiling-mode-enabled` | bool | true | Allow tabbed layout |
| `auto-split-enabled` | bool | true | Auto quarter-tiling |
| `dnd-center-layout` | string | `tabbed` | Center drop layout |

#### Behavior Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `workspace-skip-tile` | string | `` | Skip tiling on workspaces |
| `move-pointer-focus-enabled` | bool | false | Move pointer on focus |
| `focus-on-hover-enabled` | bool | false | Focus follows mouse |
| `float-always-on-top-enabled` | bool | true | Float windows on top |
| `auto-exit-tabbed` | bool | true | Exit tabbed with single tab |
| `preview-hint-enabled` | bool | true | Show DND preview |
| `showtab-decoration-enabled` | bool | true | Show tab decoration |
| `resize-amount` | uint | 15 | Resize increment (px) |

#### Development Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `logging-enabled` | bool | false | Enable logging |
| `log-level` | uint | 0 | Log level (0-7) |

### CLI Access

```bash
# List all settings
gsettings list-recursively org.gnome.shell.extensions.forge

# Get setting
gsettings get org.gnome.shell.extensions.forge window-gap-size

# Set setting
gsettings set org.gnome.shell.extensions.forge window-gap-size 8

# Reset setting
gsettings reset org.gnome.shell.extensions.forge window-gap-size

# Reset all
gsettings reset-recursively org.gnome.shell.extensions.forge
```

### Programmatic Access

```javascript
// In extension code
let gapSize = this.settings.get_uint("window-gap-size");
this.settings.set_uint("window-gap-size", 8);

// Listen for changes
this.settings.connect("changed::window-gap-size", () => {
  let newSize = this.settings.get_uint("window-gap-size");
  this.renderTree("gap-changed");
});
```

---

## Window Overrides

### File Location

- **User**: `~/.config/forge/config/windows.json`
- **Default**: `<extension>/config/windows.json`

User file takes precedence if it exists.

### Format

```json
{
  "overrides": [
    {
      "wmClass": "window-class-name",
      "wmTitle": "window-title-pattern",
      "wmId": 12345,
      "mode": "float"
    }
  ]
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `wmClass` | string | Window class (e.g., `firefox`) |
| `wmTitle` | string | Title pattern, prefix `!` for negation |
| `wmId` | number | Specific window instance ID |
| `mode` | string | `float` to always float |

### Matching Rules

1. Both `wmClass` and `wmTitle` can be combined (AND logic)
2. Either property can be used alone
3. `wmId` matches specific window instance
4. Title negation (`!`) excludes specific titles

### Examples

```json
{
  "overrides": [
    // Float all calculator windows
    { "wmClass": "org.gnome.Calculator", "mode": "float" },
    
    // Float Firefox dialogs (not main window)
    { "wmClass": "firefox", "wmTitle": "!Mozilla Firefox", "mode": "float" },
    
    // Float specific window instance
    { "wmClass": "code", "wmId": 12345, "mode": "float" },
    
    // Float JetBrains splash screens
    { "wmClass": "jetbrains-idea", "wmTitle": "splash", "mode": "float" }
  ]
}
```

### Override Types

| Type | Created By | Scope |
|------|------------|-------|
| `{wmClass, wmId}` | `Super+c` | Single window |
| `{wmClass}` | `Super+Shift+c` | All windows of class |
| `{wmClass, wmTitle}` | Config file | Matching windows |

### ConfigManager

```javascript
// lib/shared/settings.js
class ConfigManager {
  get windowProps() {
    let configFile = this.windowConfigFile;
    let [success, contents] = configFile.load_contents(null);
    return JSON.parse(contents);
  }
  
  set windowProps(props) {
    let configContents = JSON.stringify(props, null, 4);
    // Write to user config directory
  }
}
```

---

## Workspace Rules

### File Location

- **User**: `~/.config/forge/config/workspaces.json`
- **Default**: `<extension>/config/workspaces.json`

### Format

```json
{
  "rules": [
    {
      "wmClass": "window-class-name",
      "wmTitle": "window-title-pattern",
      "workspace": 1
    }
  ]
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `wmClass` | string | Window class to match |
| `wmTitle` | string | Title pattern (optional) |
| `workspace` | number | Target workspace (1-indexed) |

### Examples

```json
{
  "rules": [
    // Firefox on workspace 1
    { "wmClass": "firefox", "workspace": 1 },
    
    // Code editors on workspace 2
    { "wmClass": "code", "workspace": 2 },
    { "wmClass": "jetbrains-idea", "workspace": 2 },
    
    // Communication on workspace 3
    { "wmClass": "slack", "workspace": 3 },
    { "wmClass": "discord", "workspace": 3 },
    
    // Specific title match
    { "wmClass": "gnome-terminal", "wmTitle": "htop", "workspace": 4 }
  ]
}
```

### Applying Rules

Rules are applied:
1. Automatically when windows are created (if enabled)
2. Manually via `Super+Shift+r` keybinding
3. Via D-Bus `ReorganizeWorkspaces` command

### Implementation

```javascript
// lib/extension/window.js
reorganizeWindowsByWorkspaceRules() {
  let rules = this.workspaceRules;
  let windows = this.tree.getNodeByType(NODE_TYPES.WINDOW);
  
  for (let windowNode of windows) {
    let metaWindow = windowNode.nodeValue;
    let wmClass = metaWindow.get_wm_class();
    let title = metaWindow.get_title();
    
    for (let rule of rules) {
      if (this._matchesRule(wmClass, title, rule)) {
        let targetWs = global.workspace_manager
          .get_workspace_by_index(rule.workspace - 1);
        metaWindow.change_workspace(targetWs);
        break;
      }
    }
  }
  
  this.renderTree("reorganize");
}
```

---

## Preferences UI

### Pages

| Page | File | Settings |
|------|------|----------|
| Settings | `lib/prefs/settings.js` | General tiling options |
| Appearance | `lib/prefs/appearance.js` | Visual customization |
| Keyboard | `lib/prefs/keyboard.js` | Keybindings |
| Workspace | `lib/prefs/workspace.js` | Workspace rules |
| Floating | `lib/prefs/floating.js` | Float overrides |

### Opening Preferences

```bash
# Via keybinding
Super + .

# Via command line
gnome-extensions prefs forge@jmmaranan.com

# Via GNOME Extensions app
```

---

## Configuration Files Setup

### Create User Config Directory

```bash
mkdir -p ~/.config/forge/config
mkdir -p ~/.config/forge/stylesheet/forge
```

### Copy Default Configs

```bash
# Window overrides
cp /path/to/forge/config/windows.json ~/.config/forge/config/

# Workspace rules
cp /path/to/forge/config/workspaces.json ~/.config/forge/config/

# Stylesheet
cp /path/to/forge/stylesheet.css ~/.config/forge/stylesheet/forge/
```

### Reload After Changes

```bash
# Disable/enable extension
gnome-extensions disable forge@jmmaranan.com
gnome-extensions enable forge@jmmaranan.com

# Or restart GNOME Shell (X11)
# Alt+F2, type 'r', Enter
```

---

## Finding Window Class/Title

### Using xprop (X11)

```bash
xprop WM_CLASS WM_NAME
# Click on window
```

### Using forge-tree-dump

```bash
./forge-tree-dump -v | grep -i "class:"
```

### Using Looking Glass (X11)

1. Press `Alt+F2`
2. Type `lg`
3. Go to "Windows" tab
4. Click window to see properties
