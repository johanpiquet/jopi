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
    parentItemName: string,
    parentType: ShadCnType,
    fileInfos: ShadCn_FileInfos
}

class FileInstaller {
    constructor(protected params: FileInstallerParams) {
    }

    async install() {
        let filePath = this.patchFilePath(this.params.fileInfos.path);

        // Convert to platform-agnostic (win32 or linux)
        filePath = jk_fs.join(...filePath.split("/"));

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
        return this.patchShadCnPath(filePath);
    }

    protected async onBeforeInstall(fileInfos: ShadCn_FileInfos) {
        this.patchAliasImports(fileInfos);
    }

    // ***************

    private installLocalPath: string = "";
    private installFinalPath: string = "";

    protected patchShadCnPath(filePath: string): string {
        function replace(toReplace: string, replaceBy: string, filePath: string): string {
            return replaceBy + filePath.substring(toReplace.length);
        }

        if (this.params.parentType==="registry:block") {
            let prefix = "blocks/" + this.params.parentItemName + "/";
            if (filePath.startsWith(prefix)) {
                filePath = filePath.substring(prefix.length);
            }
        }

        if (filePath.startsWith("ui/")) return replace("ui/", "@alias/shadUI/", filePath);
        if (filePath.startsWith("lib/")) return replace("lib/", "@alias/shadLib/", filePath);
        if (filePath.startsWith("hooks/")) return replace("hooks/", "@alias/shadHooks/", filePath);
        if (filePath.startsWith("utils/")) return replace("utils/", "@alias/shadUtils/", filePath);
        if (filePath.startsWith("components/")) return replace("components/", "@alias/shadComponents/", filePath);

        return filePath;
    }

    protected patchAliasImports(fileInfos: ShadCn_FileInfos) {
        function doPatch(text: string): string {
            const content = text;

            let newContent: string[] = [];
            let lines = content.split("\n");
            let max = lines.length;

            for (let i=0;i<max;i++) {
                let line = lines[i];
                let lineImport = line;

                if (lineImport.trim().startsWith("import ")) {
                    let lineFrom = line;
                    let idxFrom = lineImport.indexOf("from");

                    while (idxFrom===-1) {
                        newContent.push(lineFrom);

                        i++;
                        if (i===max) return newContent.join("\n");

                        lineFrom = lines[i];
                        idxFrom = lineFrom.indexOf("from");
                    }

                    line = lineFrom;
                    let idxFromTargetBegin = lineFrom.indexOf("@/", idxFrom);

                    if (idxFromTargetBegin===-1) {
                        newContent.push(lineFrom);
                        continue;
                    }

                    let sep = line[idxFromTargetBegin-1];
                    let idxFromTargetEnd = lineFrom.indexOf(sep, idxFromTargetBegin);

                    let theImport = lineFrom.substring(idxFromTargetBegin, idxFromTargetEnd);
                    let parts = theImport.split("/");

                    if (parts.length >= 2) {
                        let item = parts.pop();
                        let group = parts.pop();

                        switch (group) {
                            case "ui":
                                group = "shadUI";
                                break;
                            case "lib":
                                group = "shadLib";
                                break;
                            case "components":
                                group = "shadComponents";
                                break;
                            case "utils":
                                group = "shadUtils";
                                break;
                            case "hooks":
                                group = "shadHooks";
                                break;
                            default:
                                newContent.push(line);
                                continue;
                        }

                        theImport = "@/" + group + "/" + item;
                        line = line.substring(0, idxFromTargetBegin) + theImport + line.substring(idxFromTargetEnd);
                    }
                }

                newContent.push(line);
            }

            return newContent.join("\n");
        }

        let fileContent = fileInfos.content;
        fileInfos.content = doPatch(fileContent);
    }

    private printAddedMessage() {
        console.log(`${jk_term.textRed(">")} Added file ${jk_term.textBlue(this.installLocalPath)}`);
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

class FileInstaller_Page extends FileInstaller {
    protected patchFilePath(filePath: string): string {
        filePath = super.patchFilePath(filePath);
        return "@routes/pages/shadPages/" + this.params.parentItemName + "/" + filePath;
    }
}

class FileInstaller_PageFile extends FileInstaller {
    protected patchFilePath(filePath: string): string {
        let basePath = "@routes/pages/shadPages/" + this.params.parentItemName;
        filePath = super.patchFilePath(filePath);
        return basePath + "/" + filePath;
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

        this.queueShadCnDependencies();
        await this.installPackageJsonDependencies();
        await this.installAllFiles();
    }

    protected acceptItem(item: ShadCn_ComponentJson) {
        switch (item.type) {
            case "registry:ui":
                return true;
            case "registry:component":
                return true;
            case "registry:block":
            case "registry:hook":
            case "registry:lib":
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
        const fileParams: FileInstallerParams = {
            fileInfos,
            cliArgs: this.params.cliArgs,
            parentItemName: this.params.itemName,
            parentType: this.params.item.type
        };

        switch (fileParams.fileInfos.type) {
            case "registry:ui":
            case "registry:component":
            case "registry:hook":
            case "registry:lib":
                return (new FileInstaller(fileParams)).install();

            case "registry:page":
                return (new FileInstaller_Page(fileParams)).install();

            case "registry:file":
                if (fileParams.parentType!=="registry:block") {
                    console.log("Ignoring invalid file", fileParams.fileInfos.path);
                    return undefined;
                }

                return (new FileInstaller_PageFile(fileParams)).install();

            default:
                console.log("Ignored file type", fileParams.parentType, fileParams.fileInfos)
                return undefined;
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

