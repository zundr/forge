# How to List Windows on Wayland

## Important Context
- **wmctrl does NOT work on Wayland** - it only works on X11
- Wayland requires using D-Bus to query window information
- GNOME Shell provides window information through extensions

## Method 1: Using window-calls Extension

The window-calls extension (https://github.com/ickyicky/window-calls) provides D-Bus methods to list and manipulate windows on Wayland.

### Installation
```bash
# Install from GNOME Extensions: https://extensions.gnome.org/extension/4724/window-calls/
```

### List All Windows
```bash
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Windows \
  --method org.gnome.Shell.Extensions.Windows.List
```

### List Windows with jq (formatted)
```bash
gdbus call --session \
  --dest org.gnome.Shell \
  --print-reply=literal \
  --object-path /org/gnome/Shell/Extensions/Windows \
  --method org.gnome.Shell.Extensions.Windows.List | jq .
```

### Get Windows in Current Workspace
```bash
gdbus call --session \
  --dest org.gnome.Shell \
  --print-reply=literal \
  --object-path /org/gnome/Shell/Extensions/Windows \
  --method org.gnome.Shell.Extensions.Windows.List | \
  jq -c '.[] | select (.in_current_workspace == true) | {id: .id, wm_class: .wm_class, title: .title}'
```

### Window Properties Returned
- `wm_class`: Window class (e.g., "Alacritty", "firefox")
- `wm_class_instance`: Instance name
- `pid`: Process ID
- `id`: Window ID (unique identifier)
- `frame_type`: Frame type (0 = normal)
- `window_type`: Window type (0 = normal)
- `width`, `height`: Window dimensions
- `x`, `y`: Window position
- `in_current_workspace`: Boolean - is window in current workspace
- `monitor`: Monitor index

## Method 2: Using Forge's D-Bus Interface

Forge provides its own D-Bus interface for getting the window tree:

```bash
gdbus call --session \
  --dest org.gnome.Shell \
  --object-path /org/gnome/Shell/Extensions/Forge \
  --method org.gnome.Shell.Extensions.Forge.GetTree
```

This returns the complete Forge tree structure in JSON format.

## Method 3: Using GNOME Shell's Built-in Methods

GNOME Shell provides window information through its internal APIs:

```javascript
// In GNOME Shell context (e.g., Looking Glass or extension code)
global.get_window_actors().forEach(actor => {
  let window = actor.meta_window;
  log(`Window: ${window.get_title()} (${window.get_wm_class()})`);
});
```

## Common Use Cases

### List All Alacritty Windows
```bash
gdbus call --session \
  --dest org.gnome.Shell \
  --print-reply=literal \
  --object-path /org/gnome/Shell/Extensions/Windows \
  --method org.gnome.Shell.Extensions.Windows.List | \
  jq '.[] | select(.wm_class == "Alacritty")'
```

### Count Windows per Workspace
```bash
gdbus call --session \
  --dest org.gnome.Shell \
  --print-reply=literal \
  --object-path /org/gnome/Shell/Extensions/Windows \
  --method org.gnome.Shell.Extensions.Windows.List | \
  jq 'group_by(.in_current_workspace) | map({workspace: .[0].in_current_workspace, count: length})'
```

## Key Takeaways
1. **Never use wmctrl on Wayland** - it will fail with "Cannot open display"
2. **Use D-Bus methods** for window queries on Wayland
3. **window-calls extension** is the most convenient way to list windows
4. **Forge's D-Bus interface** provides tree structure information
5. **Always check if running Wayland** before attempting X11-specific commands
