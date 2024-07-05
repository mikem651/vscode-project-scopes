import * as vscode from "vscode";
import { Scope } from "./Scope";

type Items = AddButton | ExtensionToggle | ScopeScope | ScopeItem;

export class ScopesManager implements vscode.TreeDataProvider<Items> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    Items | undefined | null | void
  > = new vscode.EventEmitter<Items | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Items | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private scope: Scope) {
    scope.subscribe(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Items): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Items): Promise<Items[]> {
    if (element) {
      if (element instanceof ScopeScope) {
        return Promise.all([
          ...[...this.scope.scopeByName(element.label).excluded].sort().map(
            async (path) => new ScopeItem(path, "exclusion", element.label)
          ),
        ]);
      }
      return [] as Items[];
    } else {
      return [
        new ExtensionToggle(this.scope.isEnabled),
        ...this.scope.scopes.sort().map(
          (scope) => new ScopeScope(scope, this.scope.activeScopesGet.has(scope))
        ),
        new AddButton(),
      ];
    }
  }
}

class AddButton extends vscode.TreeItem {
  constructor() {
    super("Add new scope", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("file-directory-create");
    this.command = {
      command: "project-scopes.add",
      title: "Add",
    };
  }
}

class ExtensionToggle extends vscode.TreeItem {
  constructor(enabled: boolean) {
    super(enabled ? "Hiding Files" : "Showing Files", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(
      enabled ? "eye-closed" : "eye"
    );
    this.command = {
      command: "project-scopes.toggle",
      title: "Toggle",
    };
  }
}

class ScopeScope extends vscode.TreeItem {
  constructor(public readonly label: string, active: boolean) {
    super(label, active ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon(
      active ? "folder-active" : "folder"
    );
    this.command = {
      command: "project-scopes.toggleActiveScope",
      title: "Change scope",
      arguments: [label],
    };
    this.contextValue = "scope";
  }
}

class ScopeItem extends vscode.TreeItem {
  scopeName: string;

  constructor(
    public readonly label: string,
    context: string,
    scopeName: string,
    tooltip?: string,
    iconPath?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = vscode.Uri.parse(label);
    this.contextValue = context;
    this.scopeName = scopeName;
    if (tooltip) {
      this.tooltip = tooltip;
    }
    this.iconPath = new vscode.ThemeIcon(iconPath || "file");
  }
}
