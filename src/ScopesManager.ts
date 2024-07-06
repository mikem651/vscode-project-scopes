import * as vscode from "vscode";
import { Scope } from "./Scope";

type Items = vscode.TreeItem | ScopeScope | ScopeItem;

export class ScopesManager implements vscode.TreeDataProvider<Items> {

  private _onDidChangeTreeData: vscode.EventEmitter<Items | undefined | null | void>
    = new vscode.EventEmitter<Items | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<Items | undefined | null | void>
    = this._onDidChangeTreeData.event;

  private readonly extensionToggleEnabled = this.createStaticTreeItem(
    "Hiding Files", vscode.TreeItemCollapsibleState.None, "eye-closed", "project-scopes.toggle");

  private readonly extensionToggleDisabled = this.createStaticTreeItem(
    "Showing Files", vscode.TreeItemCollapsibleState.None, "eye", "project-scopes.toggle");

  constructor(private scope: Scope) {
    scope.subscribe(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Items): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Items): Items[] {
    // top level
    if (!element) {
      return [
        this.scope.isEnabled ? this.extensionToggleEnabled : this.extensionToggleDisabled,

        ...this.scope.scopes.map(
          (scope) => new ScopeScope(scope, this.scope.scopesActive.has(scope))
        )
      ];
    }

    if (element instanceof ScopeScope) {
      return [
        ...[...this.scope.scopeByName(element.label).excluded].sort().map(
          (path) => new ScopeItem(path, "exclusion", element.label)
        ),
      ];
    }

    return [] as Items[];
  }

  private createStaticTreeItem(label: string, state: vscode.TreeItemCollapsibleState, icon: string, command: string) {
    const item = new vscode.TreeItem(label, state);
    item.iconPath = new vscode.ThemeIcon(icon);
    item.command = {
      command: command,
      title: "ignored",
    };
    return item;
  }
}

class ScopeScope extends vscode.TreeItem {
  constructor(public readonly label: string, active: boolean) {
    super(label, active ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon(
      active ? "layers-active" : "layers"
    );
    this.command = {
      command: "project-scopes.toggleActivateScope",
      title: "Change scope",
      arguments: [label],
    };
    this.contextValue = "scope";
  }
}

class ScopeItem extends vscode.TreeItem {
  private static readonly codeFileExtensions = [".yml", ".yaml", ".xml", ".java", ".py", ".sql"];
  private static readonly wildcards = ["*", "?", "[", "]"];

  constructor(
    public readonly label: string,
    context: string,
    public readonly scopeName: string,
    tooltip?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = vscode.Uri.parse(label);
    this.contextValue = context;
    if (tooltip) {
      this.tooltip = tooltip;
    }

    let icon;

    for (const fileExtension of ScopeItem.codeFileExtensions) {
        if (label.endsWith(fileExtension)) {
          icon = "file-code";
        }
    }
    
    if (!icon) {
      for (const wildcard of ScopeItem.wildcards) {
        if (label.includes(wildcard)) {
          icon = "files";
        }
      }
    }

    this.iconPath = new vscode.ThemeIcon(icon || "file-text");
  }
}
