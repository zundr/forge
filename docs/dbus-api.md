# D-Bus API

> Deep dive into `lib/extension/dbus-interface.js` and CLI tools

## Overview

Forge exposes a D-Bus interface for external tools to query and manipulate window state.

---

## D-Bus Interface

### Connection Details

```
Bus Name:   org.gnome.Shell
Object Path: /org/gnome/Shell/Extensions/Forge
Interface:   org.gnome.Shell.Extensions.Forge
```

### Interface Definition

```xml
<interface name="org.gnome.Shell.Extensions.Forge">
  <method name="GetTree">
    <arg type="s" direction="out" name="tree"/>
  </method>
  <method name="GetFloatOverrides">
    <arg type="s" direction="out" name="overrides"/>
  </method>
  <method name="SetWindowMode">
    <arg type="u" direction="in" name="windowId"/>
    <arg type="s" direction="in" name="mode"/>
    <arg type="s" direction="out" name="result"/>
  </method>
  <method name="ToggleWindowFloat">
    <arg type="u" direction="in" name="windowId"/>
    <arg type="s" direction="out" name="result"/>
  </method>
</interface>
```

---

## Methods

### GetTree()

Returns the complete window tree as JSON.

**Response Structure**:
```json
{
  "nodeType": "ROOT",
  "childNodes": [
    {
      "nodeType": "WORKSPACE",
      "nodeValue": { "id": "ws0", "name": "", "index": 0 },
      "childNodes": [
        {
          "nodeType": "MONITOR",
          "nodeValue": "mo0ws0",
          "layout": "HSPLIT",
          "rect": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
          "childNodes": [
            {
              "nodeType": "WINDOW",
              "nodeValue": {
                "wmClass": "firefox",
                "title": "Mozilla Firefox",
                "id": 12345,
                "windowType": 0,
                "allowsResize": true,
                "transientFor": false
              },
              "mode": "TILE",
              "rect": { "x": 0, "y": 0, "width": 960, "height": 1080 }
            }
          ]
        }
      ]
    }
  ]
}
```

### GetFloatOverrides()

Returns float override configuration.

**Response**:
```json
{
  "overrides": [
    { "wmClass": "org.gnome.Calculator", "mode": "float" },
    { "wmClass": "firefox", "wmId": 12345, "mode": "float" }
  ]
}
```

### SetWindowMode(windowId, mode)

Set window mode directly.

**Parameters**:
- `windowId` (uint): Window ID from GetTree
- `mode` (string): One of `FLOAT`, `TILE`, `GRAB_TILE`, `DEFAULT`

**Response**:
```json
{
  "success": true,
  "windowId": 12345,
  "oldMode": "TILE",
  "newMode": "FLOAT",
  "wmClass": "firefox",
  "title": "Mozilla Firefox"
}
```

### ToggleWindowFloat(windowId)

Toggle float status and update overrides.

**Response**:
```json
{
  "success": true,
  "windowId": 12345,
  "newMode": "FLOAT",
  "isFloatingExempt": true,
  "wmClass": "firefox",
  "title": "Mozilla Firefox"
}
```

---

## CLI Tools

### forge-tree-dump

Dumps window tree with Unicode visualization.

```bash
./forge-tree-dump [OPTIONS]
```

**Options**:
| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show all attributes |
| `-r, --rect` | Show rectangle dimensions |
| `-h, --help` | Show help |

**Example Output**:
```
ROOT
├── WORKSPACE 1
│   └── MONITOR mo0ws0 [HSPLIT]
│       ├── WINDOW class:firefox title:"Mozilla Firefox" id:12345 🔲 TILE
│       └── CON [VSPLIT]
│           ├── WINDOW class:gnome-terminal title:"Terminal" id:12346 🔲 TILE
│           └── WINDOW class:code title:"VS Code" id:12347 🎈 FLOAT
```

**Float Indicators**:
- 🔲 TILE - Window is tiled
- 🎈 FLOAT - Window is floating

### forge-float-debug

Debug and manipulate float status.

```bash
./forge-float-debug <command> [options]
```

**Commands**:
| Command | Description |
|---------|-------------|
| `list` | List all windows with float status |
| `overrides` | Show float overrides configuration |
| `toggle <id>` | Toggle float status for window |
| `set <id> <mode>` | Set window mode |
| `watch` | Watch mode changes in real-time |

**Examples**:
```bash
# List windows
./forge-float-debug list

# Toggle float
./forge-float-debug toggle 12345

# Force to TILE
./forge-float-debug set 12345 TILE

# Watch changes
./forge-float-debug watch
```

---

## Implementation

### ForgeDBus Class

```javascript
export class ForgeDBus {
  constructor(extension) {
    this._extension = extension;
    this._dbus = Gio.DBusExportedObject.wrapJSObject(
      ForgeDBusInterface, 
      this
    );
    this._dbus.export(
      Gio.DBus.session, 
      "/org/gnome/Shell/Extensions/Forge"
    );
  }

  GetTree() {
    const tree = this._extension.extWm?.tree;
    if (!tree) {
      return JSON.stringify({ error: "Tree not available" });
    }
    return JSON.stringify(this._serializeNode(tree));
  }

  _serializeNode(node) {
    return {
      nodeType: node.nodeType,
      nodeValue: this._serializeNodeValue(node),
      mode: node.mode,
      layout: node.layout,
      rect: node.rect,
      childNodes: node.childNodes.map(c => this._serializeNode(c))
    };
  }

  destroy() {
    this._dbus.unexport();
  }
}
```

---

## Using D-Bus Directly

### gdbus Command Line

```bash
# Get tree
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Forge \
  --method org.gnome.Shell.Extensions.Forge.GetTree

# Get float overrides
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Forge \
  --method org.gnome.Shell.Extensions.Forge.GetFloatOverrides

# Set window mode
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Forge \
  --method org.gnome.Shell.Extensions.Forge.SetWindowMode \
  12345 "FLOAT"

# Toggle float
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Forge \
  --method org.gnome.Shell.Extensions.Forge.ToggleWindowFloat \
  12345
```

### Python Example

```python
import dbus

bus = dbus.SessionBus()
forge = bus.get_object(
    'org.gnome.Shell',
    '/org/gnome/Shell/Extensions/Forge'
)
interface = dbus.Interface(
    forge, 
    'org.gnome.Shell.Extensions.Forge'
)

# Get tree
import json
tree = json.loads(interface.GetTree())
print(tree)

# Toggle float
result = json.loads(interface.ToggleWindowFloat(12345))
print(result)
```

### GJS Example

```javascript
const Gio = imports.gi.Gio;

let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
let result = bus.call_sync(
  'org.gnome.Shell',
  '/org/gnome/Shell/Extensions/Forge',
  'org.gnome.Shell.Extensions.Forge',
  'GetTree',
  null,
  new GLib.VariantType('(s)'),
  Gio.DBusCallFlags.NONE,
  -1,
  null
);

let tree = JSON.parse(result.get_child_value(0).get_string()[0]);
```

---

## Troubleshooting

### D-Bus Not Available

If methods return errors:

1. Check extension is running:
```bash
gnome-extensions info forge@jmmaranan.com
```

2. Check D-Bus export:
```bash
gdbus introspect --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Forge
```

### Window ID Not Found

Window IDs change when windows are recreated. Always fetch fresh tree before operations:

```bash
# Get current tree
TREE=$(./forge-tree-dump)

# Find window ID
ID=$(echo "$TREE" | grep "firefox" | grep -oP 'id:\d+' | cut -d: -f2)

# Use ID
./forge-float-debug toggle $ID
```

### Permission Errors

D-Bus calls must come from same session. If running from SSH:

```bash
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
```
