import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

const ForgeDBusInterface = `
<node>
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
</node>`;

export class ForgeDBus {
  constructor(extension) {
    this._extension = extension;
    this._dbus = Gio.DBusExportedObject.wrapJSObject(ForgeDBusInterface, this);
    this._dbus.export(Gio.DBus.session, "/org/gnome/Shell/Extensions/Forge");
    this._settings = new Gio.Settings({ schema: "org.gnome.desktop.wm.preferences" });
  }

  GetTree() {
    const tree = this._extension.extWm?.tree;
    if (!tree) {
      return JSON.stringify({ error: "Tree not available" });
    }

    return JSON.stringify(this._serializeNode(tree));
  }

  GetFloatOverrides() {
    const configMgr = this._extension.configMgr;
    if (!configMgr) {
      return JSON.stringify({ error: "ConfigManager not available" });
    }

    const overrides = configMgr.windowProps.overrides.filter((o) => o.mode === "float");
    return JSON.stringify({ overrides });
  }

  SetWindowMode(windowId, mode) {
    const extWm = this._extension.extWm;
    if (!extWm) {
      return JSON.stringify({ error: "WindowManager not available" });
    }

    // Validate mode
    const validModes = ["FLOAT", "TILE", "GRAB_TILE", "DEFAULT"];
    if (!validModes.includes(mode)) {
      return JSON.stringify({
        error: `Invalid mode: ${mode}. Must be one of: ${validModes.join(", ")}`,
      });
    }

    // Find window node
    const allWindows = extWm.tree.getNodeByType("WINDOW");
    const windowNode = allWindows.find((node) => {
      const metaWindow = node.nodeValue;
      return metaWindow && metaWindow.get_id() === windowId;
    });

    if (!windowNode) {
      return JSON.stringify({ error: `Window not found: ${windowId}` });
    }

    // Set mode
    const oldMode = windowNode.mode;
    windowNode.mode = mode;

    // Trigger render
    extWm.renderTree("SetWindowMode");

    return JSON.stringify({
      success: true,
      windowId,
      oldMode,
      newMode: mode,
      wmClass: windowNode.nodeValue.get_wm_class(),
      title: windowNode.nodeValue.get_title(),
    });
  }

  ToggleWindowFloat(windowId) {
    const extWm = this._extension.extWm;
    if (!extWm) {
      return JSON.stringify({ error: "WindowManager not available" });
    }

    // Find window
    const allWindows = extWm.tree.getNodeByType("WINDOW");
    const windowNode = allWindows.find((node) => {
      const metaWindow = node.nodeValue;
      return metaWindow && metaWindow.get_id() === windowId;
    });

    if (!windowNode) {
      return JSON.stringify({ error: `Window not found: ${windowId}` });
    }

    const metaWindow = windowNode.nodeValue;

    // Call the actual toggle method
    extWm.toggleFloatingMode({ name: "FloatToggle" }, metaWindow);

    // Get new state
    const newMode = windowNode.mode;
    const isFloating = extWm.isFloatingExempt(metaWindow);

    return JSON.stringify({
      success: true,
      windowId,
      newMode,
      isFloatingExempt: isFloating,
      wmClass: metaWindow.get_wm_class(),
      title: metaWindow.get_title(),
    });
  }

  _serializeNode(node) {
    const serialized = {
      nodeType: node.nodeType,
      nodeValue: this._serializeNodeValue(node),
      mode: node.mode,
      layout: node.layout,
      rect: node.rect,
      childNodes: [],
    };

    if (node.childNodes && node.childNodes.length > 0) {
      serialized.childNodes = node.childNodes.map((child) => this._serializeNode(child));
    }

    return serialized;
  }

  _serializeNodeValue(node) {
    if (node.nodeType === "WINDOW" && node.nodeValue) {
      const metaWindow = node.nodeValue;
      return {
        wmClass: metaWindow.get_wm_class(),
        title: metaWindow.get_title(),
        id: metaWindow.get_id(),
        windowType: metaWindow.get_window_type(),
        allowsResize: metaWindow.allows_resize(),
        transientFor: metaWindow.get_transient_for() !== null,
      };
    }

    if (node.nodeType === "WORKSPACE" && node.nodeValue) {
      const wsIndex = parseInt(node.nodeValue.toString().replace("ws", ""));
      const workspaceNames = this._settings.get_strv("workspace-names");
      const wsName = workspaceNames[wsIndex] || "";
      return {
        id: node.nodeValue,
        name: wsName,
        index: wsIndex,
      };
    }

    return node.nodeValue;
  }

  destroy() {
    this._dbus.unexport();
  }
}
