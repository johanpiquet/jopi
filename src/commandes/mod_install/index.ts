import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";
import {JopiProjectInfo, toModDirName, toNpmModuleName, updateWorkspaces} from "jopijs/modules";
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
            await this.installFromPackageJson(this.rootDir)

            if (!this.modulesToInstall.length) {
                if (showEndMessage) {
                    console.log("✔ Nothing to do.");
                }
            }
        } else {
            askedModules = askedModules.map(name => toNpmModuleName(name)).filter(n => n !== undefined)
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

    private async installThisNpmModule(npmName: string) {
        //region Check the module name

        let modName = toModDirName(npmName);

        if (!modName) {
            this.onInvalidNpmModuleName(npmName);
            return;
        }

        //endregion

        //region Check the target dir

        let installDir = jk_fs.resolve(this.rootDir, "src", modName);

        let stat = await jk_fs.getFileStat(installDir);

        if (stat) {
            console.log(`${jk_term.textBlue("✓")} Module ${jk_term.textBlue(npmName)} was already installed.`);
            return;
        }

        //endregion

        //region Search the module sources

        let sourceDir = await jk_app.findNodePackageDir(npmName, this.rootDir);

        if (!sourceDir) {
            console.log(`⚠️  ${jk_term.textRed("Module not found")} ${jk_term.textBlue(npmName)}. Will ignore this module.`);
            return;
        }

        //endregion

        //region Install the module

        // Copy the module content
        await jk_fs.copyDirectory(sourceDir, installDir);

        // Add his dependencies
        await this.installFromPackageJson(installDir);

        //endregion

        console.log(`${jk_term.textGreen("✓")} Npm module ${jk_term.textGreen(npmName)} installed.`);
    }

    protected async installFromPackageJson(itemDir: string) {
        let projectInfos = new JopiProjectInfo(itemDir);
        let deps = await projectInfos.getModDependencies();
        this.addNpmModulesToInstall(deps);
    }
}
