import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";
import process from "node:process";

export interface CommandOptions_ModInstall {
    modules?: string[];
    dir: string;
}

export async function commandModInstall(args: CommandOptions_ModInstall) {
    const installer = new ModInstaller(args.dir);
    await installer.install(args.modules);
}

class ModInstaller {
    private modulesToInstall: string[] = [];
    private modulesAlreadyInstalled: string[] = [];
    private pkgJson: any = {};

    constructor(private rootDir: string) {
    }

    async install(askedModules?: string[]) {
        let baseName = jk_fs.basename(this.rootDir);

        // Is inside a module dir?
        if (baseName.startsWith("mod_")) {
            console.log("You are inside a module directory. This command should be run from the root of your project.");
            process.exit(1);
        }

        await this.loadPackageJson();

        if (!askedModules || !askedModules.length) {
            await this.loadModulesListFromPkgJson();

            if (!this.modulesToInstall.length) {
                console.log("Nothing to do.");
                process.exit(0);
            }
        } else {
            this.addModulesToInstall(askedModules);
        }


        await this.installAllModules();
        await this.updateWorkspaces();
    }

    private async updateWorkspaces() {
        //region Get all existing modules

        let dirItems = await jk_fs.listDir(jk_fs.join(this.rootDir, "src"));
        let allModNames: string[] = [];

        dirItems.forEach(dir => {
            if (!dir.isDirectory) return;
            if (dir.name.startsWith("mod_")) {
                allModNames.push(dir.name);
            }
        });

        //endregion

        //region Get workspace items

        let wsItems: string[];

        if (!this.pkgJson.workspaces) {
            this.pkgJson.workspaces = [];
            wsItems = [];
        } else {
            wsItems = this.pkgJson.workspaces;
        }

        //endregion

        //region Add modules into the workspace

        let newWsItems: string[] = [];
        let foundModules: Record<string, boolean> = {};
        let needSavePkgJson = false;
        let hasAddedWkItems = false;

        for (let item of wsItems) {
            let modName: string;
            let idx = item.lastIndexOf("/");
            if (idx===-1) modName = item;
            else modName = item.substring(idx+1);

            if (modName.startsWith("mod_")) {
                if (!allModNames.includes(modName)) {
                    // Is a module but doesn't exist anymore?
                    needSavePkgJson = true;
                    continue;
                }

                // Avoid double.
                if (foundModules[modName]) {
                    needSavePkgJson = true;
                    continue;
                }

                foundModules[modName] = true;
            }

            newWsItems.push("src/" + modName);
        }

        for (let modName of allModNames) {
            // Already found into the workspace?
            if (foundModules[modName]) continue;

            needSavePkgJson = true;
            hasAddedWkItems = true;

            foundModules[modName] = true;
            newWsItems.push("src/" + modName);
        }

        //endregion

        if (needSavePkgJson) {
            this.pkgJson.workspaces = newWsItems;
            await jk_fs.writeTextToFile(jk_fs.join(this.rootDir, "package.json"), JSON.stringify(this.pkgJson, null, 4));

            if (hasAddedWkItems) {
                console.log(`${jk_term.textBgRed("\n!!!!!! Warning - Dependencies has been added !!!!!!")}\n!!!!!! You must run ${jk_term.textBlue("npm install")} to install them.`);
            }
        }
    }

    private addModulesToInstall(modList: string[]) {
        modList.forEach(modName => {
            if (this.modulesAlreadyInstalled.includes(modName)) {
                return;
            }

            if (!this.modulesToInstall.includes(modName)) {
                this.modulesToInstall.push(modName);
            }
        });
    }

    private async installAllModules() {
        while (true) {
            const modName = this.modulesToInstall.pop();
            if (modName===undefined) break;
            this.modulesAlreadyInstalled.push(modName);

            await this.installThisModule(modName);
        }
    }

    private invalidModuleName(modName: string) {
        console.log(`⚠️  ${jk_term.textRed("Invalid module name " + modName)}. Must start with ${jk_term.textGreen("jopimod_")}. Will ignore this module.`);
    }

    private async installThisModule(modName: string) {
        //region Check the module name

        if (!modName.startsWith("jopimod_")) {
            if (modName[0]==="@") {
                let idx = modName.indexOf("/");

                if (!idx) {
                    this.invalidModuleName(modName);
                    return;
                } else {
                    let name = modName.substring(idx+1);

                    if (!name.startsWith("jopimod_")) {
                        this.invalidModuleName(modName);
                        return;
                    }
                }
            } else {
                this.invalidModuleName(modName);
                return;
            }
        }

        //endregion

        //region Check the target dir

        let finalModName = this.calcFinalModName(modName);
        let installDir = jk_fs.resolve(this.rootDir, "src", finalModName);

        let stat = await jk_fs.getFileStat(installDir);

        if (stat) {
            console.log(`${jk_term.textBlue("✓")} Module ${jk_term.textBlue(finalModName)} was already installed.`);
            return;
        }

        //endregion

        //region Search the module sources

        let sourceDir = await jk_app.findNodePackageDir(modName, this.rootDir);

        if (!sourceDir) {
            console.log(`⚠️  ${jk_term.textRed("Module not found")} ${jk_term.textBlue(modName)}. Will ignore this module.`);
            return;
        }

        //endregion

        //region Install the module

        // Copy the module content
        await jk_fs.copyDirectory(sourceDir, installDir);

        // Add his dependencies
        //
        let pkgJson = await jk_fs.readJsonFromFile(jk_fs.join(installDir, "package.json"));
        //
        if (pkgJson && pkgJson.jopi && pkgJson.jopi.modDependencies) {
            this.addModulesToInstall(pkgJson.jopi.modDependencies);
        }

        //endregion

        console.log(`${jk_term.textGreen("✓")} Module ${jk_term.textGreen(finalModName)} installed.`);
    }

    private calcFinalModName(modName: string) {
        if (modName[0]==="@") {
            let idx = modName.indexOf("/");
            let orgName = modName.substring(idx);
            modName = modName.substring(idx+1);
            return "mod_" + orgName + '@' + modName;
        }

        return "mod_" + modName.substring("jopimod_".length);
    }

    async loadPackageJson() {
        let pkgJson = await jk_fs.readJsonFromFile(jk_fs.join(this.rootDir, "package.json"));

        if (!pkgJson) {
            console.log(`\n${jk_term.textRed("package.json")} file expected.\nExit.\n\n`);
            process.exit(1);
        }

        this.pkgJson = pkgJson;
    }

    async loadModulesListFromPkgJson(): Promise<string[]|undefined> {
        let modDependencies = this.pkgJson.jopi?.modDependencies;
        if (!modDependencies) return undefined;

        if (!(modDependencies instanceof Array)) {
            console.log(`\n${jk_term.textRed("package.json")}: ${jk_term.textBlue("jopi.modDependencies")} must be a string array.\nExit.\n\n`);
            process.exit(1);
        }

        this.addModulesToInstall(modDependencies);
    }
}
