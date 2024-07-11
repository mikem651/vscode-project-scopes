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
        if (e.affectsConfiguration("scopes-lite")) {
          scope.refresh();
        }
      }),
      vscode.commands.registerCommand("scopes-lite.add", async (args) => {
        const userResponse = await vscode.window.showInputBox({
          placeHolder: "Name the new scope to create",
        });
        if (!userResponse) {
          return;
        }
        scope.activateScope(userResponse);
      }),
      vscode.commands.registerCommand("scopes-lite.addInclusionGlob", async (args) => {
        let selectedScope = args?.scopeName || scope.singleActiveScope;
        if (!selectedScope) {
          selectedScope = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select scope to add to",
          });
        }
        if (!selectedScope) {
          return;
        }
        const glob = await vscode.window.showInputBox({
          placeHolder: "Glob to include"
        });
        if (!glob) {
          return;
        }
        scope.includePath(selectedScope, glob);
      }),
      vscode.commands.registerCommand("scopes-lite.addExclusionGlob", async (args) => {
        let selectedScope = args?.scopeName || scope.singleActiveScope;
        if (!selectedScope) {
          selectedScope = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select scope to add to",
          });
        }
        if (!selectedScope) {
          return;
        }
        const glob = await vscode.window.showInputBox({
          placeHolder: "Glob to exclude"
        });
        if (!glob) {
          return;
        }
        scope.excludeGlob(selectedScope, glob);
      }),
      vscode.commands.registerCommand("scopes-lite.delete", async (args) => {
        let selectedScope = args?.label;
        if (!selectedScope) {
          selectedScope = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select scope to delete",
          });
        }
        if (!selectedScope) {
          return;
        }
        const confirm = await vscode.window.showInformationMessage("Are you sure you want to delete this scope?", "Delete", "Cancel");
        if (confirm === "Delete") {
          scope.deleteScope(selectedScope);
        }
      }),
      vscode.commands.registerCommand(
        "scopes-lite.switcher",
        async (args) => {
          const userResponse = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select scope to toggle"
          });
          if (!userResponse) {
            return;
          }
          scope.toggleActivateScope(userResponse);
        }
      ),
      vscode.commands.registerCommand("scopes-lite.toggleActivateScope", (args) =>
        scope.toggleActivateScope(args)
      ),
      vscode.commands.registerCommand("scopes-lite.activateAllScopes", (args) =>
        scope.activateScope(...scope.scopes)
      ),
      vscode.commands.registerCommand("scopes-lite.deactivateAllScopes", (args) =>
        scope.deactivateScope(...scope.scopes)
      ),
      vscode.commands.registerCommand("scopes-lite.refresh", (args) =>
        scope.refresh()
      ),
      vscode.commands.registerCommand("scopes-lite.toggle", (args) =>
        scope.toggleEnabled()
      ),
      vscode.commands.registerCommand(
        "scopes-lite.addInclusionPath",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          let selectedScope = args.scopeName || scope.singleActiveScope;
          if (!selectedScope) {
            selectedScope = await vscode.window.showQuickPick(scope.scopes, {
              title: "Select scope to add to",
            });
          }
          if (!selectedScope) {
            return;
          }
          scope.includePath(selectedScope, path);
        }
      ),
      vscode.commands.registerCommand(
        "scopes-lite.addExclusionPath",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          let selectedScope = args.scopeName || scope.singleActiveScope;
          if (!selectedScope) {
            selectedScope = await vscode.window.showQuickPick(scope.scopes, {
              title: "Select scope to add to",
            });
          }
          if (!selectedScope) {
            return;
          }
          scope.excludeGlob(selectedScope, path);
        }
      ),
      vscode.commands.registerCommand(
        "scopes-lite.removeInclusion",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          let selectedScope = args.scopeName || scope.singleActiveScope;
          if (!selectedScope) {
            selectedScope = await vscode.window.showQuickPick(scope.scopes, {
              title: "Select scope to remove from",
            });
          }
          if (!selectedScope) {
            return;
          }
          scope.removeInclusion(selectedScope, path);
        }
      ),
      vscode.commands.registerCommand(
        "scopes-lite.removeExclusion",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          let selectedScope = args.scopeName || scope.singleActiveScope;
          if (!selectedScope) {
            selectedScope = await vscode.window.showQuickPick(scope.scopes, {
              title: "Select scope to remove from",
            });
          }
          if (!selectedScope) {
            return;
          }
          scope.removeExclusion(selectedScope, path);
        }
      ),
      vscode.commands.registerCommand(
        "scopes-lite.editInclusion",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          const newPath = await vscode.window.showInputBox({
            value: path, prompt: "Edit glob"
          });
          if (!args.scopeName) {
            return;
          }
          if (newPath) {
            scope.editInclusion(args.scopeName, path, newPath);
          }
        }
      ),
      vscode.commands.registerCommand(
        "scopes-lite.editExclusion",
        async (args) => {
          const path =
            args.path ||
            args.label ||
            vscode.window.activeTextEditor?.document.uri.path;
          const newPath = await vscode.window.showInputBox({
            value: path, prompt: "Edit glob"
          });
          if (!args.scopeName) {
            return;
          }
          if (newPath) {
            scope.editExclusion(args.scopeName, path, newPath);
          }
        }
      ),
    ]
  );
}

export function deactivate() {}
