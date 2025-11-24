import Gio from "gi://Gio";

const ForgeDBusInterface = `
<node>
  <interface name="org.gnome.Shell.Extensions.Forge">
    <method name="GetTree">
      <arg type="s" direction="out" name="tree"/>
    </method>
  </interface>
</node>`;

export class ForgeDBus {
  constructor(extension) {
    this._extension = extension;
    this._dbus = Gio.DBusExportedObject.wrapJSObject(ForgeDBusInterface, this);
    this._dbus.export(Gio.DBus.session, "/org/gnome/Shell/Extensions/Forge");
  }

  GetTree() {
    const tree = this._extension.extWm?.tree;
    if (!tree) {
      return JSON.stringify({ error: "Tree not available" });
    }

    return JSON.stringify(this._serializeNode(tree));
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
      };
    }
    return node.nodeValue;
  }

  destroy() {
    this._dbus.unexport();
  }
}
