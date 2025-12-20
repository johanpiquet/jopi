import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";
import {updateWorkspaces} from "jopijs/modules";
import process from "node:process";

export interface CommandOptions_ModInstall {
    modules?: string[];
    dir: string;
}

export async function commandModInstall(args: CommandOptions_ModInstall, showEndMessage = true) {
    const installer = new ModInstaller(args.dir);
    await installer.install(args.modules, showEndMessage);
}

class ModInstaller {
    private modulesToInstall: string[] = [];
    private modulesAlreadyInstalled: string[] = [];

    constructor(private rootDir: string) {
    }

    async install(askedModules?: string[], showEndMessage = true) {
        let baseName = jk_fs.basename(this.rootDir);

        // Is inside a module dir?
        if (baseName.startsWith("mod_")) {
            console.log("🛑 You are inside a module directory. This command should be run from the root of your project.");
            process.exit(1);
        }

        if (!askedModules || !askedModules.length) {
            await this.installFromPackageJson(jk_fs.join(this.rootDir, "package.json"))

            if (!this.modulesToInstall.length) {
                if (showEndMessage) {
                    console.log("✔ Nothing to do.");
                }
            }
        } else {
            askedModules = this.cleanUpNames(askedModules);
            this.addNpmModulesToInstall(askedModules);
        }

        await this.installAllModules();
        await updateWorkspaces();
    }

    private addNpmModulesToInstall(npmModList: string[]) {
        npmModList.forEach(modName => {
            if (this.modulesAlreadyInstalled.includes(modName)) return;

            if (!this.modulesToInstall.includes(modName)) {
                this.modulesToInstall.push(modName);
            }
        });
    }

    protected async installAllModules() {
        while (true) {
            const modName = this.modulesToInstall.pop();
            if (modName===undefined) break;
            this.modulesAlreadyInstalled.push(modName);

            await this.installThisNpmModule(modName);
        }
    }

    private onInvalidNpmModuleName(modName: string) {
        console.log(`⚠️  ${jk_term.textRed("Invalid module name " + modName)}. Must start with ${jk_term.textGreen("jopimod_")}. Will ignore this module.`);
    }

    private async installThisNpmModule(modName: string) {
        //region Check the module name

        if (!modName.startsWith("jopimod_")) {
            if (modName[0]==="@") {
                let idx = modName.indexOf("/");

                if (!idx) {
                    this.onInvalidNpmModuleName(modName);
                    return;
                } else {
                    let name = modName.substring(idx+1);

                    if (!name.startsWith("jopimod_")) {
                        this.onInvalidNpmModuleName(modName);
                        return;
                    }
                }
            } else {
                this.onInvalidNpmModuleName(modName);
                return;
            }
        }

        //endregion

        //region Check the target dir

        let finalModName = this.calcModNameFromNpmName(modName);
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
        await this.installFromPackageJson(jk_fs.join(installDir, "package.json"));

        //endregion

        console.log(`${jk_term.textGreen("✓")} Module ${jk_term.textGreen(finalModName)} installed.`);
    }

    protected async installFromPackageJson(pkgJsonFilePath: string) {
        // Add his dependencies
        //
        let pkgJson = await jk_fs.readJsonFromFile(pkgJsonFilePath);
        //
        if (pkgJson) {
            if (pkgJson.jopi && pkgJson.jopi.modDependencies) {
                let modDependencies = this.cleanUpNames(pkgJson.jopi.modDependencies);
                this.addNpmModulesToInstall(modDependencies);
            }

            if (pkgJson.dependencies) {
                this.addFromNpmDependencies(pkgJson.dependencies);
            }

            if (pkgJson.devDependencies) {
                this.addFromNpmDependencies(pkgJson.devDependencies);
            }
        }
    }

    private cleanUpNames(modDependencies: string[]): string[] {
        // Here name can be directory the module name or of type mod_modName.
        // But we need the npm package name.
        //
        return modDependencies.map(name => {
            if (name.startsWith("jopimod_")) return name;
            if (name[0]==="@") return name;
            if (name.startsWith("mod_")) name = name.substring("mod_".length);

            return "jopimod_" + name;
        });
    }

    private calcModNameFromNpmName(modName: string) {
        if (modName[0]==="@") {
            let idx = modName.indexOf("/");
            let orgName = modName.substring(idx);
            modName = modName.substring(idx+1);
            return "mod_" + orgName + '@' + modName;
        }

        return "mod_" + modName.substring("jopimod_".length);
    }

    private addFromNpmDependencies(npmDeps: Record<string, string>) {
        let toAdd: string[] = [];

        for (let depName in npmDeps) {
            let modName = depName;
            let orgName: string|undefined = undefined;

            if (depName[0]==="@") {
                let idx = depName.indexOf("/");
                orgName = depName.substring(idx);
                modName = depName.substring(idx+1);
            }

            if (!modName.startsWith("jopimod_")) continue;

            toAdd.push(depName);
        }

        this.addNpmModulesToInstall(toAdd);
    }
}
