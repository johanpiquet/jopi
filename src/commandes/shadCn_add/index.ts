import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";

import process from "node:process";
import {confirm, } from '@inquirer/prompts';

//region Interfaces

type ShadCnType = "registry:lib" |
                "registry:block" |
                "registry:component" |
                "registry:ui" |
                "registry:hook" |
                "registry:theme" |
                "registry:page" |
                "registry:file" |
                "registry:style" |
                "registry:base"|
                "registry:item";

export interface CommandOptions_ShadCnAdd {
    components: string[],
    dir: string;
    mod: string;
    registry?: string;
    yes?: boolean;
    no?: boolean;
}

interface ShadCn_FileInfos {
    /**
     * The path to the file relative to the registry root
     * Exemple: 'ui/chart.tsx'
     */
    path: string;

    /**
     * The file content.
     */
    content: string;

    type: ShadCnType,

    /**
     * The target path of the file. This is the path to the file in the project.
     */
    target: string;
}

/**
 * See: https://ui.shadcn.com/schema/registry-item.json
 */
interface ShadCn_ComponentJson {
    name: string;
    type: ShadCnType;
    author: string;

    /**
     * Exemple: [ 'recharts@2.15.4', 'lucide-react' ]
     */
    dependencies: string[]

    /**
     * Exemple: [ 'recharts@2.15.4', 'lucide-react' ]
     */
    devDependencies: string[];

    /**
     * Exemple: [ 'card' ]
     */
    registryDependencies: string[];

    files: ShadCn_FileInfos[]
}

interface PackageJson {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
}

//endregion

//region File Installers

interface FileInstallerParams {
    cliArgs: CommandOptions_ShadCnAdd,
    itemName: string,
    itemType: ShadCnType,
    fileInfos: ShadCn_FileInfos
}

class FileInstaller {
    constructor(private params: FileInstallerParams) {
    }

    async install() {
        let filePath = this.patchFilePath(this.params.fileInfos.path);
        this.params.fileInfos.content = "[jopi-done]";

        this.installLocalPath = jk_fs.join("src", this.params.cliArgs.mod, filePath);
        this.installFinalPath = jk_fs.join(this.params.cliArgs.dir, this.installLocalPath);

        if (!await this.confirmReplaceFile()) {
            this.params.fileInfos.content = "[jopi-done]";
            return;
        }

        await this.onBeforeInstall(this.params.fileInfos)
        await jk_fs.writeTextToFile(this.installFinalPath, this.params.fileInfos.content);
        this.printAddedMessage();

        this.params.fileInfos.content = "[jopi-done]";
    }

    protected patchFilePath(filePath: string): string {
        return filePath;
    }

    protected async onBeforeInstall(fileInfos: ShadCn_FileInfos) {
        function patchAliasImports(content: string): string {
            let lines = content.split("\n");

            let isFirst = true;
            content = "";

            for (let line of lines) {
                let trimmed = line.trim();

                if (trimmed.startsWith("import ")) {
                    trimmed = trimmed.replace("@/ui/", "@/shadLib/");
                    trimmed = trimmed.replace("@/lib/", "@/shadLib/");
                    trimmed = trimmed.replace("@/components/", "@/shadComponents/");
                    trimmed = trimmed.replace("@/utils/", "@/shadUtils/");
                    trimmed = trimmed.replace("@/hooks/", "@/shadHooks/");

                    line = trimmed;
                }

                if (isFirst) {
                    content += line;
                    isFirst = false;
                } else {
                    content += "\n" + line;
                }
            }

            return content;
        }

        let fileContent = fileInfos.content;
        fileInfos.content = patchAliasImports(fileContent);
    }

    // ***************

    private installLocalPath: string = "";
    private installFinalPath: string = "";

    protected convertPath(toReplace: string, replaceBy: string, filePath: string): string {
        filePath = replaceBy + filePath.substring(toReplace.length);
        let parts = filePath.split("/");
        return jk_fs.join(...parts);
    }

    protected patchShadCnPath(filePath: string): string {
        if (filePath.startsWith("ui/")) return this.convertPath("ui/", "@alias/shadUI/", filePath);
        if (filePath.startsWith("lib/")) return this.convertPath("lib/", "@alias/shadLib/", filePath);
        if (filePath.startsWith("hooks/")) return this.convertPath("hooks/", "@alias/shadHooks/", filePath);
        if (filePath.startsWith("utils/")) return this.convertPath("utils/", "@alias/shadUtils/", filePath);
        if (filePath.startsWith("components/")) return this.convertPath("utils/", "@alias/shadComponents/", filePath);

        return filePath;
    }

    private printAddedMessage() {
        console.log(`    ${jk_term.textRed(">")} Added file ${jk_term.textBlue(this.installLocalPath)}`);
    }

    private async confirmReplaceFile(): Promise<boolean> {
        if (await jk_fs.isFile(this.installFinalPath)) {
            if (this.params.cliArgs.no===true) return false;

            if (this.params.cliArgs.yes!==true) {
                let res = await confirm({message: `Override file ${jk_term.textBlue(this.installFinalPath)}`, default: false});
                if (!res) return false;
            }
        }

        return true;
    }
}

class FileInstaller_UI extends FileInstaller {
    async onBeforeInstall(fileInfos: ShadCn_FileInfos) {
        await super.onBeforeInstall(fileInfos);
    }

    protected patchFilePath(filePath: string): string {
        return this.patchShadCnPath(filePath);
    }
}

//endregion

//region Item installer

interface ItemInstallerParams {
    cliArgs: CommandOptions_ShadCnAdd,
    itemName: string,
    itemType: ShadCnType,
    item: ShadCn_ComponentJson
}

class ItemInstaller {
    constructor(private params: ItemInstallerParams) {
    }

    async install() {
        if (!this.acceptItem(this.params.item)) {
            console.log(`Ignored item ${jk_term.textBlue(this.params.itemName)} of type ${jk_term.textGrey(this.params.itemType)}`);
            return;
        }

        this.printStarting();
        this.queueShadCnDependencies();
        await this.installPackageJsonDependencies();
        await this.installAllFiles();
    }

    protected printStarting() {
        console.log(`>>> Component ${jk_term.textBlue(this.params.itemName)} - ${jk_term.textGrey(this.params.itemType)}`)
    }

    protected acceptItem(item: ShadCn_ComponentJson) {
        switch (item.type) {
            case "registry:ui":
                return true;
            case "registry:component":
                return true;
            default:
                return false;
        }
    }

    protected queueShadCnDependencies() {
        // Queue ShadCN items this item depends on.
        //
        if (this.params.item.registryDependencies) {
            for (let dep of this.params.item.registryDependencies) {
                if (!this.params.cliArgs.components.includes(dep)) {
                    this.params.cliArgs.components.push(dep);
                }
            }
        }
    }

    protected async installPackageJsonDependencies() {
        const item = this.params.item;
        if (!item.dependencies && !item.devDependencies) return;

        let pkgJsonFilePath = jk_app.findPackageJson(this.params.cliArgs.dir);
        if (!pkgJsonFilePath) stopError("No 'package.json' file found in " + this.params.cliArgs.dir);

        let json = await jk_fs.readJsonFromFile<PackageJson>(pkgJsonFilePath);
        if (!json) stopError("Can't read 'package.json' file at" + pkgJsonFilePath);

        let mustSave = false;

        if (item.dependencies) {
            if (!json.dependencies) json.dependencies = {};

            for (let dep of item.dependencies) {
                let idx = dep.indexOf("@");
                if (idx===-1) continue;

                let depName = dep.substring(0, idx);
                let depVersion = "^" + dep.substring(idx+1);

                if (!json.dependencies[depName]) {
                    mustSave = true;
                    gHasDependenciesAdded = true;
                    json.dependencies[depName] = depVersion;
                    console.log(`    ${jk_term.textRed(">")} Added dependency ${dep}`);
                }
            }
        }

        if (item.devDependencies) {
            for (let dep of item.devDependencies) {
                let idx = dep.indexOf("@");
                if (idx===-1) continue;

                let depName = dep.substring(0, idx);
                let depVersion = dep.substring(idx+1);

                if (!json.devDependencies[depName]) {
                    mustSave = true;
                    gHasDependenciesAdded = true;
                    json.devDependencies[depName] = depVersion;
                    console.log(`    ${jk_term.textRed(">")} Added dev-dependency ${dep}`);
                }
            }
        }

        if (mustSave) {
            await jk_fs.writeTextToFile(pkgJsonFilePath, JSON.stringify(json, null, 4));
        }
    }

    protected async installAllFiles() {
        if (this.params.item.files) {
            for (let fileInfos of this.params.item.files) {
                await this.installThisFile(fileInfos);
            }
        }
    }

    protected async installThisFile(fileInfos: ShadCn_FileInfos) {
        const params = {
            cliArgs: this.params.cliArgs,
            itemName: this.params.itemName,
            itemType: this.params.item.type,
            fileInfos
        };

        switch (params.fileInfos.type) {
            case "registry:ui":
                return (new FileInstaller_UI(params)).install();
            case "registry:component":
                return (new FileInstaller_UI(params)).install();
            case "registry:block":
                console.log("Block ...")
                return;
            case "registry:page":
                return (new FileInstaller(params)).install();
            default:
                console.log("Ignored type", params.fileInfos.type)
                //return (new FileInstaller(params)).install();
                return;
        }
    }
}

//endregion

function stopError(msg: string) {
    console.log(msg);
    process.exit(1);
}

export default async function(args: CommandOptions_ShadCnAdd) {
    args.dir = jk_fs.resolve(args.dir);
    if (!args.mod.startsWith("mod_")) args.mod = "mod_" + args.mod;

    let componentsJson = await jk_fs.readJsonFromFile(args.dir + "/components.json");
    if (!componentsJson) stopError("No 'components.json' file found in " + args.dir);

    // "new-york" or "default"
    let baseStyleName = componentsJson.style;
    
    while (true) {
        let component = args.components.pop();
        if (!component) break;

        await installItem(args, component, baseStyleName);
    }

    console.log(`\n${jk_term.textGreen("✔")} Installed`);

    if (gHasDependenciesAdded) {
        console.log(`${jk_term.textRed("Warning - Dependencies has been added")} - You must run ${jk_term.textBlue("npm install")} to install them.`);
    }
}

async function installItem(cliArgs: CommandOptions_ShadCnAdd, itemName: string, style: any) {
    let url = `https://ui.shadcn.com/r/styles/${style}/${itemName}.json`;
    if (cliArgs.registry) url = cliArgs.registry + "/" + itemName + ".json";

    let content = await fetch(url);
    if (!content.ok) stopError(`Error fetching ${url}`);

    let json = await content.json() as ShadCn_ComponentJson;

    await new ItemInstaller({
        cliArgs,
        itemName: itemName,
        itemType: json.type,
        item: json
    }).install();

    //console.log(json);
}

let gHasDependenciesAdded = false;

