// Gtk imports
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

// Gnome imports
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// Extension imports
import { PreferencesPage, ResetButton } from "./widgets.js";
import { ConfigManager } from "../shared/settings.js";

class RuleRow extends Adw.ActionRow {
  static {
    GObject.registerClass(this);
  }

  constructor({ rule, onEdit, onRemove, onMoveUp, onMoveDown }) {
    let title = rule.wmClass;
    if (rule.wmTitle) {
      title += ` (${rule.wmTitle})`;
    }
    super({
      title: title,
      subtitle: _("Workspace %d").format(rule.workspace),
      activatable: true,
    });

    this._rule = rule;
    this._onEdit = onEdit;
    this._onRemove = onRemove;
    this._onMoveUp = onMoveUp;
    this._onMoveDown = onMoveDown;

    // Click row to edit
    this.connect("activated", () => this._onEdit(this));

    // Button box for actions
    const buttonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 4,
      valign: Gtk.Align.CENTER,
    });

    // Move up button
    this._upButton = new Gtk.Button({
      icon_name: "go-up-symbolic",
      css_classes: ["flat"],
      tooltip_text: _("Move up"),
    });
    this._upButton.connect("clicked", () => this._onMoveUp(this));
    buttonBox.append(this._upButton);

    // Move down button
    this._downButton = new Gtk.Button({
      icon_name: "go-down-symbolic",
      css_classes: ["flat"],
      tooltip_text: _("Move down"),
    });
    this._downButton.connect("clicked", () => this._onMoveDown(this));
    buttonBox.append(this._downButton);

    // Remove button
    const removeButton = new Gtk.Button({
      icon_name: "user-trash-symbolic",
      css_classes: ["flat", "error"],
      tooltip_text: _("Remove"),
    });
    removeButton.connect("clicked", () => this._onRemove(this));
    buttonBox.append(removeButton);

    this.add_suffix(buttonBox);
  }

  updateButtons(isFirst, isLast) {
    this._upButton.sensitive = !isFirst;
    this._downButton.sensitive = !isLast;
  }
}

export class WorkspacePage extends PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor({ settings, dir }) {
    super({ title: _("Workspace"), icon_name: "preferences-desktop-wallpaper-symbolic" });

    this.settings = settings;
    this.configMgr = new ConfigManager({ dir });

    let rules = this.configMgr.workspaceProps.rules || [];
    this.rows = [];

    this.workspaceGroup = this.add_group({
      title: _("Workspace Placement"),
      description: _(
        "Rules match windows by Class (required) and Title (optional). " +
          "Use 'xprop WM_CLASS' (X11) or Looking Glass (Wayland) to find window class."
      ),
      header_suffix: new ResetButton({ onReset: () => this.onResetHandler() }),
      children: [],
    });

    this.loadItemsFromConfig(rules);

    // Button box for Add Rule and Reorganize
    const buttonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 12,
      halign: Gtk.Align.CENTER,
      margin_top: 6,
    });

    this.addButton = new Gtk.Button({
      label: _("Add Rule"),
      css_classes: ["suggested-action"],
    });
    this.addButton.connect("clicked", () => this.showRuleDialog(null));
    buttonBox.append(this.addButton);

    this.reorganizeButton = new Gtk.Button({
      label: _("Reorganize Windows"),
      tooltip_text: _("Move all windows to their configured workspaces"),
    });
    this.reorganizeButton.connect("clicked", () => this.onReorganizeHandler());
    buttonBox.append(this.reorganizeButton);

    this.workspaceGroup.add(buttonBox);
  }

  loadItemsFromConfig(rules) {
    for (let rule of rules) {
      this.addRuleRow(rule);
    }
    this.updateRowButtons();
  }

  addRuleRow(rule) {
    const row = new RuleRow({
      rule: rule,
      onEdit: (r) => this.showRuleDialog(r),
      onRemove: (r) => this.onRemoveHandler(r),
      onMoveUp: (r) => this.onMoveHandler(r, -1),
      onMoveDown: (r) => this.onMoveHandler(r, 1),
    });
    this.rows.push(row);
    // Insert before button box
    const buttonBox = this.workspaceGroup.get_last_child();
    this.workspaceGroup.remove(buttonBox);
    this.workspaceGroup.add(row);
    this.workspaceGroup.add(buttonBox);
    return row;
  }

  updateRowButtons() {
    const len = this.rows.length;
    this.rows.forEach((row, i) => row.updateButtons(i === 0, i === len - 1));
  }

  showRuleDialog(existingRow) {
    const isEdit = existingRow !== null;
    const existingRule = isEdit ? existingRow._rule : null;

    const dialog = new Gtk.Dialog({
      title: isEdit ? _("Edit Workspace Rule") : _("Add Workspace Rule"),
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
      text: existingRule?.wmClass || "",
    });
    contentArea.append(classEntry);

    const titleEntry = new Gtk.Entry({
      placeholder_text: _("Window Title (optional)"),
      hexpand: true,
      text: existingRule?.wmTitle || "",
    });
    contentArea.append(titleEntry);

    // 1-indexed workspace (1 to 99)
    const workspaceEntry = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 99,
        step_increment: 1,
      }),
      value: existingRule?.workspace || 1,
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
    dialog.add_button(isEdit ? _("Save") : _("Add"), Gtk.ResponseType.OK);

    dialog.connect("response", (dlg, response) => {
      if (response === Gtk.ResponseType.OK) {
        const wmClass = classEntry.get_text().trim();
        const wmTitle = titleEntry.get_text().trim();
        const workspace = workspaceEntry.get_value();

        if (wmClass) {
          const newRule = { wmClass, workspace };
          if (wmTitle) {
            newRule.wmTitle = wmTitle;
          }

          if (isEdit) {
            // Update existing rule
            const idx = this.rows.indexOf(existingRow);
            const rules = this.configMgr.workspaceProps.rules || [];
            rules[idx] = newRule;
            this.saveRules(rules);

            // Update row display
            existingRow._rule = newRule;
            let title = wmClass;
            if (wmTitle) title += ` (${wmTitle})`;
            existingRow.set_title(title);
            existingRow.set_subtitle(_("Workspace %d").format(workspace));
          } else {
            // Add new rule
            const rules = this.configMgr.workspaceProps.rules || [];
            rules.push(newRule);
            this.saveRules(rules);
            this.addRuleRow(newRule);
            this.updateRowButtons();
          }
        }
      }
      dlg.close();
    });

    dialog.show();
  }

  onRemoveHandler(row) {
    const idx = this.rows.indexOf(row);
    if (idx === -1) return;

    this.workspaceGroup.remove(row);
    this.rows.splice(idx, 1);

    const rules = this.configMgr.workspaceProps.rules || [];
    rules.splice(idx, 1);
    this.saveRules(rules);
    this.updateRowButtons();
  }

  onMoveHandler(row, direction) {
    const idx = this.rows.indexOf(row);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.rows.length) return;

    // Swap in rules array
    const rules = this.configMgr.workspaceProps.rules || [];
    [rules[idx], rules[newIdx]] = [rules[newIdx], rules[idx]];
    this.saveRules(rules);

    // Swap in rows array
    [this.rows[idx], this.rows[newIdx]] = [this.rows[newIdx], this.rows[idx]];

    // Rebuild UI
    this.rebuildRowsUI();
  }

  rebuildRowsUI() {
    const buttonBox = this.workspaceGroup.get_last_child();
    // Remove all rows
    for (const row of this.rows) {
      this.workspaceGroup.remove(row);
    }
    this.workspaceGroup.remove(buttonBox);
    // Re-add in order
    for (const row of this.rows) {
      this.workspaceGroup.add(row);
    }
    this.workspaceGroup.add(buttonBox);
    this.updateRowButtons();
  }

  saveRules(rules) {
    this.configMgr.workspaceProps = { rules };
    const changed = Math.floor(Date.now() / 1000);
    this.settings.set_uint("workspace-rules-reload-trigger", changed);
  }

  onReorganizeHandler() {
    const trigger = Math.floor(Date.now() / 1000);
    this.settings.set_uint("workspace-reorganize-trigger", trigger);
  }

  onResetHandler() {
    const defaultProps = this.configMgr.loadDefaultWorkspaceConfigContents();
    const original = defaultProps.rules || [];
    this.saveRules(original);

    // Remove all rows
    for (const row of this.rows) {
      this.workspaceGroup.remove(row);
    }
    this.rows = [];

    // Reload
    this.loadItemsFromConfig(original);
  }
}
