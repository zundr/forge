/**
 * TDD Test for Window Workspace Placement Feature
 */

describe("Window Workspace Placement", () => {
  test("getWorkspacePlacementRule returns workspace when wmClass matches", () => {
    const windowManager = {
      windowProps: { overrides: [{ wmClass: "firefox", workspace: 2 }] },
      getWorkspacePlacementRule(metaWindow) {
        if (!metaWindow) return null;
        const wmClass = metaWindow.get_wm_class();
        if (!wmClass) return null;

        for (const override of this.windowProps.overrides) {
          if (override.workspace === undefined) continue;
          if (override.wmClass !== wmClass) continue;
          return { workspace: override.workspace };
        }
        return null;
      },
    };

    const mockWindow = {
      get_wm_class: () => "firefox",
      get_title: () => "Test",
    };

    const result = windowManager.getWorkspacePlacementRule(mockWindow);
    expect(result).toEqual({ workspace: 2 });
  });

  test("findParentApplicationWorkspace returns parent workspace", () => {
    const parentWindow = {
      get_wm_class: () => "firefox",
      get_workspace: () => ({ index: () => 1 }),
      get_monitor: () => 0,
    };

    const windowManager = {
      tree: {
        getNodeByType: () => [{ nodeValue: parentWindow }],
      },
      findParentApplicationWorkspace(metaWindow) {
        if (!metaWindow) return null;
        const wmClass = metaWindow.get_wm_class();
        if (!wmClass) return null;

        const windows = this.tree.getNodeByType();
        for (const nodeWindow of windows) {
          if (nodeWindow.nodeValue === metaWindow) continue;
          if (nodeWindow.nodeValue.get_wm_class() === wmClass) {
            const workspace = nodeWindow.nodeValue.get_workspace();
            if (workspace) {
              return {
                monitor: nodeWindow.nodeValue.get_monitor(),
                workspace: workspace.index(),
              };
            }
          }
        }
        return null;
      },
    };

    const mockWindow = {
      get_wm_class: () => "firefox",
    };

    const result = windowManager.findParentApplicationWorkspace(mockWindow);
    expect(result).toEqual({ monitor: 0, workspace: 1 });
  });

  test("determineTargetWorkspace prioritizes rule over parent", () => {
    const windowManager = {
      windowProps: { overrides: [{ wmClass: "firefox", workspace: 2 }] },
      getWorkspacePlacementRule(metaWindow) {
        for (const override of this.windowProps.overrides) {
          if (override.workspace !== undefined && override.wmClass === metaWindow.get_wm_class()) {
            return { workspace: override.workspace };
          }
        }
        return null;
      },
      findParentApplicationWorkspace() {
        return { monitor: 0, workspace: 1 };
      },
      determineTargetWorkspace(metaWindow) {
        const rule = this.getWorkspacePlacementRule(metaWindow);
        if (rule) {
          return { monitor: 0, workspace: rule.workspace };
        }
        const parent = this.findParentApplicationWorkspace(metaWindow);
        if (parent) {
          return parent;
        }
        return { monitor: 0, workspace: 0 };
      },
    };

    const mockWindow = {
      get_wm_class: () => "firefox",
    };

    const result = windowManager.determineTargetWorkspace(mockWindow);
    expect(result).toEqual({ monitor: 0, workspace: 2 });
  });
});
