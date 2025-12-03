# Development

> Build, test, and debug workflows

## Setup

### Requirements

- Node.js 16+
- gettext
- GNOME Shell development environment
- Git

### Initial Setup

```bash
git clone https://github.com/forge-ext/forge.git
cd forge
npm install
```

---

## Build System

### Makefile Targets

| Target | Description |
|--------|-------------|
| `make all` | Build, install, enable, restart |
| `make build` | Compile to temp/ |
| `make install` | Install to ~/.local/share/gnome-shell/extensions/ |
| `make enable` | Enable extension |
| `make disable` | Disable extension |
| `make clean` | Remove build artifacts |
| `make dist` | Create distributable .zip |
| `make dev` | Build debug mode and install |
| `make test-x` | Full X11 test cycle |
| `make test-wayland` | Nested Wayland session |
| `make log` | Follow GNOME Shell logs |
| `make format` | Format code with Prettier |

### Build Process

```bash
make build
```

1. Cleans previous builds (`rm -rf temp`)
2. Generates `metadata.js` from git contributors
3. Compiles GSettings schemas
4. Compiles translations (`.po` → `.mo`)
5. Copies files to `temp/`

### Debug Mode

```bash
make dev
```

Sets `production = false` in `lib/shared/settings.js`, enabling verbose logging.

---

## Testing

### X11 Testing

```bash
make test-x
```

Runs: disable → uninstall → build → debug → install → enable → restart → log

### Wayland Testing

```bash
make test-wayland
```

Starts nested GNOME Shell session:
- Display: 1500x1000
- Scale: 1
- Slowdown: 2x

Open apps in nested session:
```bash
make test-shell-open CMD=nautilus
make test-shell-open CMD=gnome-terminal
```

### Unit Tests

```bash
npm test
```

Test files:
- `test/tree-formatter.test.js` - Tree formatting
- `test/tree-condensing.test.js` - Tree cleanup
- `test/decoration-cleanup.test.js` - Decoration management
- `test/workspace-config-separation.test.js` - Workspace rules
- `test/window-workspace-placement.test.js` - Window placement

---

## Debugging

### Enable Logging

```bash
gsettings set org.gnome.shell.extensions.forge logging-enabled true
gsettings set org.gnome.shell.extensions.forge log-level 5
```

Log levels:
- 0 = OFF
- 1 = FATAL
- 2 = ERROR
- 3 = WARN
- 4 = INFO
- 5 = DEBUG
- 6 = TRACE
- 7 = ALL

### View Logs

```bash
# Real-time
journalctl -f /usr/bin/gnome-shell

# Filter for Forge
journalctl -f /usr/bin/gnome-shell | grep -i forge

# Recent logs
journalctl -n 100 /usr/bin/gnome-shell
```

### Looking Glass (X11)

1. Press `Alt+F2`
2. Type `lg`
3. Navigate tabs:
   - **Evaluator**: Run JavaScript
   - **Windows**: Inspect windows
   - **Extensions**: Check errors

### CLI Tools

```bash
# Dump tree structure
./forge-tree-dump -v

# Debug float status
./forge-float-debug list
```

---

## Code Style

### Formatting

```bash
# Check formatting
npm test

# Auto-format
npm run format
```

Uses Prettier with project configuration.

### Git Hooks

Husky + lint-staged auto-formats on commit:

```json
// package.json
{
  "lint-staged": {
    "*.js": "prettier --write"
  }
}
```

---

## Adding Features

### New Keybinding

1. Add to schema (`schemas/*.gschema.xml`)
2. Compile schema: `glib-compile-schemas schemas/`
3. Add binding in `keybindings.js`
4. Implement command in `window.js`

See [keybindings.md](keybindings.md) for details.

### New Setting

1. Add to schema
2. Compile schema
3. Access via `this.settings.get_*()` / `set_*()`
4. Add to preferences UI if needed

### New CSS Class

1. Add to `stylesheet.css`
2. Use in code: `new St.Bin({ style_class: 'my-class' })`

---

## Translations

### Extract Strings

```bash
make potfile
```

Updates `po/forge.pot` with translatable strings.

### Compile Translations

```bash
make compilemsgs
```

Compiles `.po` → `.mo` files.

### Add New Language

```bash
cd po/
msginit -i forge.pot -o de.po -l de_DE
# Edit de.po
make compilemsgs
```

### Mark Strings

```javascript
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

let text = _("Translatable string");
```

---

## Release Process

### Version Bump

1. Update `metadata.json` version
2. Update `package.json` version
3. Commit changes

### Create Distribution

```bash
make dist
```

Creates `forge@jmmaranan.com.zip` for upload to extensions.gnome.org.

### Git Tags

```bash
git tag -a v22.51.0 -m "Release 22.51.0"
git push origin v22.51.0
```

---

## Project Structure

```
forge/
├── extension.js          # Entry point
├── prefs.js              # Preferences entry
├── lib/
│   ├── extension/        # Runtime code
│   ├── prefs/            # Preferences UI
│   ├── shared/           # Shared utilities
│   └── cli/              # CLI modules
├── config/               # Default configs
├── schemas/              # GSettings schemas
├── test/                 # Test suite
├── po/                   # Translations
├── resources/            # Icons
├── docs/                 # Documentation
├── Makefile              # Build system
└── package.json          # Node.js config
```

---

## Common Issues

### Extension Not Loading

```bash
# Check status
gnome-extensions info forge@jmmaranan.com

# Check logs
journalctl -f /usr/bin/gnome-shell
```

### Schema Errors

```bash
# Recompile schemas
glib-compile-schemas schemas/

# Check for errors
glib-compile-schemas --strict schemas/
```

### Import Errors

GJS uses different import syntax than Node.js:

```javascript
// Correct
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

// Wrong
const GLib = require("gi://GLib");
```

### Signal Disconnection

Always disconnect signals in `disable()`:

```javascript
enable() {
  this._signalId = global.display.connect("window-created", ...);
}

disable() {
  if (this._signalId) {
    global.display.disconnect(this._signalId);
    this._signalId = null;
  }
}
```

---

## Resources

### Documentation

- [GNOME Shell Extensions Guide](https://gjs.guide/extensions/)
- [GJS Documentation](https://gjs-docs.gnome.org/)
- [GNOME Shell Source](https://gitlab.gnome.org/GNOME/gnome-shell)

### Tools

- [Looking Glass](https://wiki.gnome.org/Projects/GnomeShell/LookingGlass) - Built-in debugger
- [GJS Console](https://gitlab.gnome.org/GNOME/gjs) - JavaScript runtime
- [D-Spy](https://flathub.org/apps/org.gnome.dspy) - D-Bus inspector

### Community

- [GitHub Issues](https://github.com/forge-ext/forge/issues)
- [GNOME Extensions](https://extensions.gnome.org/extension/4481/forge/)
