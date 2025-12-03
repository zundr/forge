# Theming

> Deep dive into CSS system and dynamic updates

## Overview

Forge uses CSS for visual styling with dynamic updates via the ReworkCSS parser.

---

## Stylesheet Locations

| Location | Purpose |
|----------|---------|
| `stylesheet.css` | Default extension styles |
| `~/.config/forge/stylesheet/forge/stylesheet.css` | User overrides |

User stylesheet takes precedence if it exists.

---

## CSS Classes

### Border Classes

| Class | Purpose |
|-------|---------|
| `.window-tiled-border` | Focused tiled window |
| `.window-split-border` | Split direction indicator |
| `.window-stacked-border` | Stacked layout border |
| `.window-tabbed-border` | Tabbed layout border |
| `.window-floated-border` | Floating window border |

### Split Direction Classes

| Class | Purpose |
|-------|---------|
| `.window-split-horizontal` | Horizontal split (right border) |
| `.window-split-vertical` | Vertical split (bottom border) |

### Tab Classes

| Class | Purpose |
|-------|---------|
| `.window-tabbed-bg` | Tab container background |
| `.window-tabbed-tab` | Individual tab |
| `.window-tabbed-tab-active` | Active tab |
| `.window-tabbed-tab-close` | Close button |
| `.window-tabbed-tab-icon` | Tab icon |

### Preview Classes

| Class | Purpose |
|-------|---------|
| `.window-tilepreview-tiled` | Tiled drop preview |
| `.window-tilepreview-stacked` | Stacked drop preview |
| `.window-tilepreview-tabbed` | Tabbed drop preview |
| `.window-tilepreview-swap` | Swap preview |

---

## Default Styles

```css
/* Focus border */
.window-tiled-border {
  border-width: 3px;
  border-color: rgba(236, 94, 94, 1);
  border-style: solid;
  border-radius: 14px;
}

/* Split indicator */
.window-split-border {
  border-width: 3px;
  border-color: rgba(255, 246, 108, 1);
  border-style: solid;
  border-radius: 14px;
}

/* Tab styling */
.window-tabbed-tab {
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 8px;
  margin: 2px;
  padding: 4px 8px;
}

.window-tabbed-tab-active {
  background-color: rgba(236, 94, 94, 0.8);
}

/* Preview hint */
.window-tilepreview-tiled {
  border-width: 2px;
  border-color: rgba(236, 94, 94, 0.5);
  background-color: rgba(236, 94, 94, 0.1);
  border-radius: 14px;
}
```

---

## Customization Examples

### Blue Theme

```css
.window-tiled-border {
  border-width: 4px;
  border-color: rgba(66, 133, 244, 1);
  border-radius: 12px;
}

.window-split-border {
  border-color: rgba(52, 168, 83, 1);
}

.window-tabbed-tab-active {
  background-color: rgba(66, 133, 244, 0.8);
}
```

### Minimal Monochrome

```css
.window-tiled-border {
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.8);
  border-radius: 0;
}

.window-split-border {
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.4);
}

.window-tabbed-tab {
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 0;
}
```

### Solarized Dark

```css
.window-tiled-border {
  border-color: rgba(38, 139, 210, 1);  /* blue */
}

.window-split-border {
  border-color: rgba(133, 153, 0, 1);   /* green */
}

.window-stacked-border {
  border-color: rgba(181, 137, 0, 1);   /* yellow */
}

.window-tabbed-border {
  border-color: rgba(203, 75, 22, 1);   /* orange */
}
```

### Glow Effect

```css
.window-tiled-border {
  border-width: 3px;
  border-color: rgba(66, 133, 244, 1);
  box-shadow: 0 0 20px rgba(66, 133, 244, 0.5);
}
```

### No Border Radius

```css
.window-tiled-border,
.window-split-border,
.window-stacked-border,
.window-tabbed-border {
  border-radius: 0;
}
```

---

## Dynamic Theme Updates

### Theme Manager

```javascript
// lib/extension/extension-theme-manager.js
class ExtensionThemeManager extends ThemeManager {
  patchCss() {
    // Read settings
    let borderColor = this.settings.get_string('focus-border-color');
    let borderSize = this.settings.get_uint('focus-border-size');
    
    // Modify CSS
    this.modifyCssProperty(
      '.window-tiled-border', 
      'border-color', 
      borderColor
    );
    this.modifyCssProperty(
      '.window-tiled-border', 
      'border-width', 
      borderSize + 'px'
    );
  }
  
  reloadStylesheet() {
    Main.loadTheme();
  }
}
```

### Settings That Trigger Updates

| Setting | CSS Property |
|---------|--------------|
| `focus-border-color` | `.window-tiled-border { border-color }` |
| `focus-border-size` | `.window-tiled-border { border-width }` |
| `split-border-color` | `.window-split-border { border-color }` |

### ReworkCSS Parser

Forge uses a vendored ReworkCSS library (`lib/css/`) for CSS manipulation:

```javascript
// lib/shared/theme.js
import { parse, stringify } from '../css/index.js';

class ThemeManager {
  modifyCssProperty(selector, property, value) {
    let ast = parse(this.cssContent);
    
    for (let rule of ast.stylesheet.rules) {
      if (rule.selectors?.includes(selector)) {
        for (let decl of rule.declarations) {
          if (decl.property === property) {
            decl.value = value;
          }
        }
      }
    }
    
    this.cssContent = stringify(ast);
  }
}
```

---

## Setup Custom Stylesheet

### Create Directory

```bash
mkdir -p ~/.config/forge/stylesheet/forge
```

### Copy Default

```bash
cp /path/to/forge/stylesheet.css ~/.config/forge/stylesheet/forge/
```

### Edit

```bash
nano ~/.config/forge/stylesheet/forge/stylesheet.css
```

### Apply

Changes require extension reload:

```bash
# X11: Alt+F2, type 'r'
# Wayland: logout/login

# Or disable/enable
gnome-extensions disable forge@jmmaranan.com
gnome-extensions enable forge@jmmaranan.com
```

---

## CSS Properties Reference

### Supported Properties

| Property | Example |
|----------|---------|
| `border-width` | `3px` |
| `border-color` | `rgba(236, 94, 94, 1)` |
| `border-style` | `solid`, `dashed` |
| `border-radius` | `14px` |
| `background-color` | `rgba(30, 30, 30, 0.8)` |
| `color` | `white` |
| `opacity` | `0.8` |
| `margin` | `2px` |
| `padding` | `4px 8px` |
| `box-shadow` | `0 0 20px rgba(0,0,0,0.5)` |

### Color Formats

```css
/* RGBA (recommended) */
border-color: rgba(236, 94, 94, 1);
border-color: rgba(236, 94, 94, 0.5);  /* 50% opacity */

/* Hex */
border-color: #ec5e5e;

/* Named */
border-color: red;
```

---

## Troubleshooting

### Styles Not Applying

1. Check file location:
```bash
ls -la ~/.config/forge/stylesheet/forge/stylesheet.css
```

2. Check CSS syntax:
```bash
# Look for parse errors in logs
journalctl -f /usr/bin/gnome-shell | grep -i css
```

3. Reload extension:
```bash
gnome-extensions disable forge@jmmaranan.com
gnome-extensions enable forge@jmmaranan.com
```

### Border Not Visible

1. Check `focus-border-toggle` setting:
```bash
gsettings get org.gnome.shell.extensions.forge focus-border-toggle
```

2. Check border size:
```bash
gsettings get org.gnome.shell.extensions.forge focus-border-size
```

3. Check if window is tiled (not floating)

### Colors Look Wrong

GNOME Shell uses RGBA format. Ensure alpha channel is included:

```css
/* Wrong */
border-color: rgb(236, 94, 94);

/* Correct */
border-color: rgba(236, 94, 94, 1);
```
