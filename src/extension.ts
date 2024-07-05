import * as vscode from "vscode";
import { Scope } from "./Scope";
import { ScopesManager } from "./ScopesManager";

export function activate(context: vscode.ExtensionContext) {
  const scope = new Scope(context);
  vscode.window.createTreeView("scopesManager", {
    treeDataProvider: new ScopesManager(scope),
    canSelectMany: false,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    ...[
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("project-scopes")) {
          scope.refresh();
        }
      }),
      vscode.commands.registerCommand("project-scopes.add", async (args) => {
        const userResponse = await vscode.window.showInputBox({
          placeHolder: "Name the new project scope to create",
        });
        if (!userResponse) {
          return;
        }
        scope.setActiveScope(userResponse);
      }),
      vscode.commands.registerCommand("project-scopes.addExclusion", async (args) => {
        let selectedScope = args?.label;
        if (!selectedScope) {
          selectedScope = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select project scope to add to",
          });
        }
        if (!selectedScope) {
          return;
        }
        if (selectedScope) {
          const glob = await vscode.window.showInputBox({
            placeHolder: "Glob to exclude"
          });
          if (!glob) {
            return;
          }
          scope.excludeItem(glob);
        }
      }),
      vscode.commands.registerCommand("project-scopes.delete", async (args) => {
        let selectedScope = args?.label;
        if (!selectedScope) {
          selectedScope = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select project scope to DELETE",
          });
        }
        if (!selectedScope) {
          return;
        }
        if (selectedScope) {
          const confirm = await vscode.window.showInformationMessage("Are you sure you want to delete this scope?", "Delete", "Cancel");
          if (confirm === "Delete") {
            scope.deleteScope(selectedScope);
          }
        }
      }),
      vscode.commands.registerCommand(
        "project-scopes.switcher",
        async (args) => {
          const userResponse = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select project scope to switch to",
            placeHolder: scope.getActiveScope(),
          });
          if (!userResponse) {
            return;
          }
          scope.setActiveScope(userResponse);
        }
      ),
      vscode.commands.registerCommand("project-scopes.setActiveScope", (args) =>
        scope.setActiveScope(args)
      ),
      vscode.commands.registerCommand("project-scopes.refresh", (args) =>
        scope.refresh()
      ),
      vscode.commands.registerCommand("project-scopes.toggle", (args) =>
        scope.toggleEnabled()
      ),
      vscode.commands.registerCommand(
        "project-scopes.toggleExclusion",
        (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          scope.excludeItem(path);
        }
      ),
      vscode.commands.registerCommand(
        "project-scopes.removeExclusion",
        (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          scope.dontExcludeItem(path);
        }
      ),
      vscode.commands.registerCommand(
        "project-scopes.editExclusion",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          const newPath = await vscode.window.showInputBox({
            value: path, prompt: "Edit exclusion glob"
          });
          if (newPath) {
            scope.editExcludeItem(args.scopeName, path, newPath);
          }
        }
      ),
    ]
  );
}

export function deactivate() {}
