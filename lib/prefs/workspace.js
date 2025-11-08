// Gtk imports
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

// Gnome imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Extension imports
import { PreferencesPage, RemoveItemRow, ResetButton } from "./widgets.js";
import { ConfigManager } from "../shared/settings.js";

export class WorkspacePage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings, dir }) {
    super({ title: _("Workspace"), icon_name: "preferences-desktop-wallpaper-symbolic" });

    this.settings = settings;
    this.configMgr = new ConfigManager({ dir });

    let overrides = this.configMgr.windowProps.overrides;
    this.rows = this.loadItemsFromConfig(overrides);

    this.workspaceGroup = this.add_group({
      title: _("Workspace Placement"),
      description: _("Windows that will be placed in specific workspaces"),
      header_suffix: new ResetButton({ onReset: () => this.onResetHandler() }),
      children: this.rows,
    });

    this.addButton = new Gtk.Button({
      label: _("Add Rule"),
      halign: Gtk.Align.CENTER,
      css_classes: ["suggested-action"],
    });
    this.addButton.connect("clicked", () => this.onAddHandler());
    this.workspaceGroup.add(this.addButton);
  }

  loadItemsFromConfig(overrides) {
    let children = [];
    for (let override of overrides) {
      if (override.workspace !== undefined) {
        let title = override.wmClass;
        if (override.wmTitle) {
          title += ` (${override.wmTitle})`;
        }
        let itemrow = new RemoveItemRow({
          title: title,
          subtitle: `Workspace ${override.workspace}`,
          onRemove: (item, parent) => this.onRemoveHandler(item, parent),
        });
        itemrow._override = override;
        children.push(itemrow);
      }
    }
    return children;
  }

  onAddHandler() {
    const dialog = new Gtk.Dialog({
      title: _("Add Workspace Rule"),
      transient_for: this.get_root(),
      modal: true,
      use_header_bar: true,
    });

    const contentArea = dialog.get_content_area();
    contentArea.set_spacing(12);
    contentArea.set_margin_top(12);
    contentArea.set_margin_bottom(12);
    contentArea.set_margin_start(12);
    contentArea.set_margin_end(12);

    const classEntry = new Gtk.Entry({
      placeholder_text: _("Window Class (e.g., firefox)"),
      hexpand: true,
    });
    contentArea.append(classEntry);

    const titleEntry = new Gtk.Entry({
      placeholder_text: _("Window Title (optional)"),
      hexpand: true,
    });
    contentArea.append(titleEntry);

    const workspaceEntry = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 99,
        step_increment: 1,
      }),
      value: 0,
      hexpand: true,
    });
    const workspaceLabel = new Gtk.Label({
      label: _("Workspace:"),
      halign: Gtk.Align.START,
    });
    const workspaceBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    workspaceBox.append(workspaceLabel);
    workspaceBox.append(workspaceEntry);
    contentArea.append(workspaceBox);

    dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
    dialog.add_button(_("Add"), Gtk.ResponseType.OK);

    dialog.connect("response", (dialog, response) => {
      if (response === Gtk.ResponseType.OK) {
        const wmClass = classEntry.get_text().trim();
        const wmTitle = titleEntry.get_text().trim();
        const workspace = workspaceEntry.get_value();

        if (wmClass) {
          const newOverride = { wmClass, workspace };
          if (wmTitle) {
            newOverride.wmTitle = wmTitle;
          }

          const existing = this.configMgr.windowProps.overrides;
          existing.push(newOverride);
          this.saveOverrides(existing);

          let title = wmClass;
          if (wmTitle) {
            title += ` (${wmTitle})`;
          }
          const itemrow = new RemoveItemRow({
            title: title,
            subtitle: `Workspace ${workspace}`,
            onRemove: (item, parent) => this.onRemoveHandler(item, parent),
          });
          itemrow._override = newOverride;
          this.rows.push(itemrow);
          this.workspaceGroup.remove(this.addButton);
          this.workspaceGroup.add(itemrow);
          this.workspaceGroup.add(this.addButton);
        }
      }
      dialog.close();
    });

    dialog.show();
  }

  onRemoveHandler(item, parent) {
    this.workspaceGroup.remove(parent);
    this.rows = this.rows.filter((row) => row != parent);
    const existing = this.configMgr.windowProps.overrides;
    const override = parent._override;
    const modified = existing.filter((o) => {
      if (o.wmClass !== override.wmClass) return true;
      if (o.workspace !== override.workspace) return true;
      if (o.wmTitle !== override.wmTitle) return true;
      return false;
    });
    this.saveOverrides(modified);
  }

  saveOverrides(modified) {
    if (modified) {
      this.configMgr.windowProps = {
        overrides: modified,
      };
      const changed = Math.floor(Date.now() / 1000);
      this.settings.set_uint("window-overrides-reload-trigger", changed);
    }
  }

  onResetHandler() {
    const defaultWindowProps = this.configMgr.loadDefaultWindowConfigContents();
    const original = defaultWindowProps.overrides;
    this.saveOverrides(original);

    for (const child of this.rows) {
      this.workspaceGroup.remove(child);
    }

    this.rows = this.loadItemsFromConfig(original);
    for (const item of this.rows) {
      this.workspaceGroup.add(item);
    }
    this.workspaceGroup.remove(this.addButton);
    this.workspaceGroup.add(this.addButton);
  }
}
