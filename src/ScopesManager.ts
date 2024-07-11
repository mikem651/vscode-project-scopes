import * as vscode from "vscode";
import { Scope } from "./Scope";

type Items = vscode.TreeItem | ScopeScope | ScopeItem;

export class ScopesManager implements vscode.TreeDataProvider<Items> {

  private _onDidChangeTreeData: vscode.EventEmitter<Items | undefined | null | void>
    = new vscode.EventEmitter<Items | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<Items | undefined | null | void>
    = this._onDidChangeTreeData.event;

  private readonly extensionToggleEnabled = this.createStaticTreeItem(
    "Hiding Files", vscode.TreeItemCollapsibleState.None, "eye-closed", "scopes-lite.toggle");

  private readonly extensionToggleDisabled = this.createStaticTreeItem(
    "Showing Files", vscode.TreeItemCollapsibleState.None, "eye", "scopes-lite.toggle");

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
          new ScopeInclude(
            element.label,
            this.scope.scopeByName(element.label).included.size
          ),
          new ScopeExclude(
            element.label,
            this.scope.scopeByName(element.label).excluded.size
          ),
      ];
    }

    if (element instanceof ScopeInclude) {
      return [
        ...[...this.scope.scopeByName(element.scopeName).included].map(
          (path) => new ScopeItem(path, "inclusion", element.scopeName)
        )
      ];
    }

    if (element instanceof ScopeExclude) {
      return [
        ...[...this.scope.scopeByName(element.scopeName).excluded].map(
          (path) => new ScopeItem(path, "exclusion", element.scopeName)
        )
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
      command: "scopes-lite.toggleActivateScope",
      title: "Change scope",
      arguments: [label],
    };
    this.contextValue = "scope";
  }
}

class ScopeInclude extends vscode.TreeItem {
  constructor(public scopeName: string, count: number) {
    super(`Include (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'scopeInclude';
    this.iconPath = new vscode.ThemeIcon("check");
  }
}

class ScopeExclude extends vscode.TreeItem {
  constructor(public scopeName: string, count: number) {
    super(`Exclude (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'scopeExclude';
    this.iconPath = new vscode.ThemeIcon("circle-slash");
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
