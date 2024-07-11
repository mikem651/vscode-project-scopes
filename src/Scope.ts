import * as vscode from "vscode";
import * as path from "path";
import { glob } from "glob";

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

const CONFIG = "scopes-lite";

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
        this.scopeSettings[scope] = { included: new Set(), excluded: new Set() };
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
    if (this.activeScopes.delete(scope)) {
      this.setConfig("activeScopes", Array.from(this.activeScopes));
    }

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
        included: new Set(scopes[key].included),
        excluded: new Set(scopes[key].excluded),
      };
    });
  }

  private generateExclusionGlobs(): Record<string, true> | null {
    let result: Record<string, true> = { ...this.globalExclude };

    if (!this.enabled) {
      return result;
    }

    for (const activeScope of this.activeScopes) {
      for (const exclude of this.scopeByName(activeScope).excluded) {
        // result[exclude] = true;
      }
    }

    const allIncluded: string[] = [];

    for (const activeScope of this.activeScopes) {
      // const excluded = Array.from(this.scopeByName(activeScope).excluded);
      // const inclusions = this.generateInclusionGlobs(excluded);
      // console.log("inclusions globs for " + excluded.join(', ') + " : " + Array.from(inclusions).join(', '));

      const excluded = this.scopeByName(activeScope).excluded;
      allIncluded.push(...excluded);
    }
    const inclusions = this.generateInclusionGlobs(allIncluded);
    console.log("inclusions globs for " + allIncluded.join(', ') + " : " + Array.from(inclusions).join(', '));
    for (const inclusion of inclusions) {
      result[inclusion] = true;
    }

    return result;
  }

  private updateFilesExclude() {
    const globs = this.generateExclusionGlobs();
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

  generateInclusionGlobs(included: string[]): Set<string> {
    const sets = this.generateInclusionGlobsPerIncluded(included);
    if (!sets || sets.length === 0) {
      return new Set();
    }
    return this.intersectPaths(...sets);
  }

  generateInclusionGlobsPerIncluded(included: string[]): Set<string>[] | undefined  {
    if (!vscode.workspace.workspaceFolders) {
        return;
    }
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const rel = vscode.workspace.asRelativePath;

    // all sets of files and folders to exclude, one per included
    // if there are multiple 'included', some sets will contain a glob to exclude another included folder
    let sets: Set<string>[] = [];
    for (const folderPath of included) {
      // set of files and folders to exclude in the included folder's path of the tree
      const set = new Set<string>();
      let folder = rel(folderPath);
      let parent = path.dirname(folder);

      // iterate through the folder and then its ancestors
      while (folder !== path.dirname(parent)) {
        // get the list of siblings (folders and files) of the current folder, excluding the current folder
        const siblings = glob.sync(path.join(rootPath, parent, "*"), {
          ignore: path.join(rootPath, folder),
          dot: true,
        });

        // add each sibling to the set of globs
        siblings.forEach((p) => set.add(rel(p)));

        // move up one folder level
        folder = parent;
        parent = path.dirname(parent);
      }

      // remove . for current directory
      set.delete(".");
      sets.push(set);
    }
  
    // console.log("scopes inclusion globs: " + sets.join('\n'));
    return sets;
  }

  intersectPaths(...sets: Set<string>[]): Set<string> {
    // merge the sets using reduce
    return sets.reduce((acc, set) => this.intersetPathsPair(acc, set));
  }

  // merge two sets of exclusions
  intersetPathsPair(setA: Set<string>, setB: Set<string>): Set<string> {
    const res = new Set<string>();

    // iterate through each exclusion in the first set
    for (let val of setA) {
      let v = val;

      // check if setB contains any sub-fragment of val
      // val = foo/bar/tux
      // check foo/bar/tux, foo/bar, foo
      while (v !== "." && v !== path.sep) {
        if (setB.has(v)) {
          // setB contains an exclusion of part of val
          // add val to the result set
          // setA: foo/bar/tux
          // setB: foo
          // in A-B loop add to res: foo/bar/tux
          // in B-A loop foo is not added
          res.add(val);
          break;
        }

        // strip off the last directory
        v = path.dirname(v);
      }
    }

    // do the same thing in the other direction
    for (let val of setB) {
      let v = val;
      while (v !== "." && v !== path.sep) {
        if (setA.has(v)) {
          res.add(val);
          break;
        }
        v = path.dirname(v);
      }
    }
    return res;
  }

}