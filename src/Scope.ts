import * as vscode from "vscode";

type ScopeSettings = {
  excluded: Set<string>;
};

type JSONScopes = Record<
  string,
  Record<"excluded", Array<string>>
>;

const defaultScopes: JSONScopes = {
  base: {
    excluded: [],
  },
};

const CONFIG = "project-scopes";

export class Scope {
  private scopeSettings: Record<string, ScopeSettings> = {};
  private activeScopes: Set<string> = new Set<string>();
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

  get scopes(): string[] {
    return Object.keys(this.scopeSettings).sort();
  }

  get scopesActive(): ReadonlySet<string> {
    return this.activeScopes;
  }

  get singleActiveScope(): string | null {
    if (this.activeScopes.size === 1) {
      return this.activeScopes.values().next().value;
    }
    return null;
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

  activateScope(...scopes: string[]) {
    this.xactivateScope(this.activeScopes.add.bind(this.activeScopes), ...scopes);
  }

  deactivateScope(...scopes: string[]) {
    this.xactivateScope(this.activeScopes.delete.bind(this.activeScopes), ...scopes);
  }

  private xactivateScope(fn: (param: string) => unknown, ...scopes: string[]) {
    let needToSave = false;
    for (const scope of scopes) {
      fn(scope);
      if (!this.scopeSettings[scope]) {
        this.scopeSettings[scope] = { excluded: new Set() };
        needToSave = true;
      }
    }
    if (needToSave) {
      this.saveScopes();
    }
    this.setConfig("activeScopes", Array.from(this.activeScopes));
  }

  toggleActivateScope(scope: string) {
    if (this.activeScopes.has(scope)) {
      this.deactivateScope(scope);
    } else {
      this.activateScope(scope);
    }
  }

  deleteScope(scope: string) {
    if (!this.scopeSettings[scope]) {
      return;
    }
    delete this.scopeSettings[scope];
    this.saveScopes();
  }

  scopeByName(name: string) {
    return this.scopeSettings[name];
  }

  excludeItem(scopeName: string, val: string) {
    const path = vscode.workspace.asRelativePath(val);
    this.scopeByName(scopeName).excluded.add(path);
    this.saveScopes();
  }

  dontExcludeItem(scopeName: string, val: string) {
    const path = vscode.workspace.asRelativePath(val);
    this.scopeByName(scopeName).excluded.delete(path);
    this.saveScopes();
  }

  editExcludeItem(scopeName: string, oldPath: string, newPath: string) {
    if (newPath) {
      this.scopeByName(scopeName).excluded.delete(vscode.workspace.asRelativePath(oldPath));
      this.scopeByName(scopeName).excluded.add(vscode.workspace.asRelativePath(newPath));
      this.saveScopes();
    }
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
    this.activeScopes = new Set<string>(this.getConfig("activeScopes", new Set()));
    this.globalExclude = this.getConfig("globalExclude", {});
    let scopes = this.getConfig("scopes", defaultScopes);

    this.scopeSettings = {};
    Object.keys(scopes).forEach((key) => {
      this.scopeSettings[key] = {
        excluded: new Set(scopes[key].excluded),
      };
    });
  }

  private async generateExclusionGlobs(): Promise<Record<string, true> | null> {
    let result: Record<string, true> = { ...this.globalExclude };
    if (!this.enabled) {
      return result;
    }

    for (const activeScope of this.activeScopes) {
      for (const exclude of this.scopeByName(activeScope).excluded) {
        result[exclude] = true;
      }
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
        excluded: [...scope.excluded.values()],
      };
    });
    this.setConfig("scopes", scopes);
  }
}
