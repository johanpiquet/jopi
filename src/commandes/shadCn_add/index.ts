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
        return "@routes/shadPages/" + this.params.parentItemName + "/" + filePath;
    }
}

class FileInstaller_PageFile extends FileInstaller {
    protected patchFilePath(filePath: string): string {
        let basePath = "@routes/shadPages/" + this.params.parentItemName;
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
        function appendAll() {
            for (let dep of list) {
                let dep2 = dep;
                if (dep[0]==="@") dep2 = dep.substring(1);

                let version = "latest";
                let name = dep;

                let idx = dep2.indexOf("@");

                if (idx!==-1) {
                    name = dep2.substring(0, idx);
                    version = dep2.substring(idx+1);

                    if (version!=="latest") {
                        let first = version[0];
                        if ((first!=="^") && (first!==">") && (first !== "~")) version = "^" + version;
                    }
                }

                let currentVersion = map[name];

                if (currentVersion) {
                    if (version==="latest") {
                        continue;
                    }
                }

                map[name] = version;
            }
        }

        const item = this.params.item;
        if (!item.dependencies && !item.devDependencies) return;

        let map = gDependenciesToAdd;
        let list = item.dependencies;
        if (list) appendAll();

        map = gDevDependenciesToAdd;
        list = item.devDependencies;
        if (list) {
            appendAll();
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

export default async function(cliArgs: CommandOptions_ShadCnAdd) {
    cliArgs.dir = jk_fs.resolve(cliArgs.dir);
    if (!cliArgs.mod.startsWith("mod_")) cliArgs.mod = "mod_" + cliArgs.mod;

    let componentsJson = await jk_fs.readJsonFromFile(cliArgs.dir + "/components.json");
    if (!componentsJson) stopError("No 'components.json' file found in " + cliArgs.dir);

    // "new-york" or "default"
    let baseStyleName = componentsJson.style;
    
    while (true) {
        let component = cliArgs.components.pop();
        if (!component) break;

        await installItem(cliArgs, component, baseStyleName);
    }

    await addDependenciesToPackageJson(cliArgs);

    console.log(`\n${jk_term.textGreen("✔")} Installed`);

    if (gHasDependenciesAdded) {
        console.log(`${jk_term.textRed("\n!!!!!! Warning - Dependencies has been added !!!!!!")}\nYou must run ${jk_term.textBlue("npm install")} to install them.`);
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

async function addDependenciesToPackageJson(cliArgs: CommandOptions_ShadCnAdd) {
    function appendAll(depMap: Record<string, string>, targetMap: Record<string, string>) {
        for (let depName in depMap) {
            let depVersion = depMap[depName];

            if (!targetMap[depName]) {
                mustSave = true;
                gHasDependenciesAdded = true;
                targetMap[depName] = depVersion;
                console.log(`    ${jk_term.textRed(">")} Added dependency ${depName}`);
            }
        }
    }

    if (
        !Object.values(gDependenciesToAdd).length &&
        !Object.values(gDevDependenciesToAdd).length
    ) return;

    let pkgJsonFilePath = jk_app.findPackageJson(cliArgs.dir);
    if (!pkgJsonFilePath) stopError("No 'package.json' file found in " + cliArgs.dir);

    let json = await jk_fs.readJsonFromFile<PackageJson>(pkgJsonFilePath);
    if (!json) stopError("Can't read 'package.json' file at" + pkgJsonFilePath);

    let mustSave = false;

    if (gDependenciesToAdd) {
        if (!json.dependencies) json.dependencies = {};
        appendAll(gDependenciesToAdd, json.dependencies);
    }

    if (gDevDependenciesToAdd) {
        if (!json.dependencies) json.devDependencies = {};
        appendAll(gDevDependenciesToAdd, json.devDependencies);
    }

    if (mustSave) {
        await jk_fs.writeTextToFile(pkgJsonFilePath, JSON.stringify(json, null, 4));
    }
}

let gHasDependenciesAdded = false;
let gDependenciesToAdd: Record<string, string> = {};
let gDevDependenciesToAdd: Record<string, string> = {};

