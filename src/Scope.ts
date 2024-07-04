import * as path from "path";
import * as vscode from "vscode";

type ScopeSettings = {
  included: Set<string>;
  excluded: Set<string>;
};

type JSONScopes = Record<
  string,
  Record<"included" | "excluded", Array<string>>
>;

const defaultScopes: JSONScopes = {
  base: {
    included: [],
    excluded: [],
  },
};

const CONFIG = "project-scopes";

export class Scope {
  private scopeSettings: Record<string, ScopeSettings> = {};
  private activeScope: string = "base";
  private globalExclude: Record<string, true> = {};
  private enabled: boolean = false;
  private callbacks: (() => void)[] = [];

  constructor(private extensionContext: vscode.ExtensionContext) {
    const filesExclude = vscode.workspace
      .getConfiguration()
      .get("files.exclude", {}) as Record<string, true>;
    this.globalExclude = this.getConfig("globalExclude", filesExclude);
    if (!this.globalExclude) {
      this.globalExclude = filesExclude;
      this.setConfig("globalExclude", this.globalExclude);
    }
    this.getSettings();
  }

  subscribe(cb: () => void) {
    this.callbacks.push(cb);
  }

  get isEnabled() {
    return this.enabled;
  }

  get scopes() {
    return Object.keys(this.scopeSettings);
  }

  refresh() {
    this.getSettings();
    this.updateFilesExclude();
    this.callbacks.forEach((cb) => cb());
  }

  // enable/disable the extension
  toggleEnabled() {
    this.enabled = !this.enabled;
    this.setConfig("enabled", this.enabled);
  }

  getActiveScope() {
    return this.activeScope;
  }

  setActiveScope(scope: string) {
    this.activeScope = scope;
    if (!this.scopeSettings[scope]) {
      this.scopeSettings[scope] = { included: new Set(), excluded: new Set() };
      this.saveScopes();
    }
    this.setConfig("activeScope", scope);
  }

  deleteScope(scope: string) {
    if (!this.scopeSettings[scope]) {
      return;
    }
    delete this.scopeSettings[scope];
    this.saveScopes();
  }

  get scope() {
    return this.scopeSettings[this.activeScope];
  }

  scopeByName(name: string) {
    return this.scopeSettings[name];
  }

  toggleItem(list: "included" | "excluded", val: string) {
    const path = vscode.workspace.asRelativePath(val);
    const other = list === "included" ? "excluded" : "included";
    if (this.scope[list].has(path)) {
      this.scope[list].delete(path);
    } else {
      this.scope[other].delete(path);
      this.scope[list].add(path);
    }
    this.saveScopes();
  }

  private getConfig<T>(config: string, defaultValue: T): T {
    return vscode.workspace.getConfiguration(CONFIG).get(config, defaultValue);
  }

  private setConfig(config: string, value: unknown) {
    vscode.workspace
      .getConfiguration(CONFIG)
      .update(config, value, vscode.ConfigurationTarget.Workspace);
  }

  private getSettings() {
    this.enabled = this.getConfig("enabled", true);
    this.activeScope = this.getConfig("activeScope", "base");
    this.globalExclude = this.getConfig("globalExclude", {});
    let scopes = this.getConfig("scopes", defaultScopes);

    this.scopeSettings = {};
    Object.keys(scopes).forEach((key) => {
      this.scopeSettings[key] = {
        included: new Set(scopes[key].included),
        excluded: new Set(scopes[key].excluded),
      };
    });
  }

  private async generateExclusionGlobs(): Promise<Record<string, true> | null> {
    let result: Record<string, true> = { ...this.globalExclude };
    if (!this.enabled) {
      return result;
    }

    for (const exclude of this.scope.excluded) {
      result[exclude] = true;
    }
    return result;
  }

  private async updateFilesExclude() {
    const globs = await this.generateExclusionGlobs();
    if (globs) {
      vscode.workspace
        .getConfiguration()
        .update("files.exclude", globs, vscode.ConfigurationTarget.Workspace);
    }
  }

  private saveScopes() {
    let scopes: JSONScopes = {};
    Object.keys(this.scopeSettings).forEach((key) => {
      const scope = this.scopeSettings[key];
      scopes[key] = {
        included: [...scope.included.values()],
        excluded: [...scope.excluded.values()],
      };
    });
    this.setConfig("scopes", scopes);
  }
}
