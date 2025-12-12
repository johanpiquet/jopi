import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";

import process from "node:process";
import {confirm, } from '@inquirer/prompts';

export interface CommandOptions_ShadCnAdd {
    components: string[],
    dir: string;
    mod: string;
    registry?: string;
    yes?: boolean;
    no?: boolean;
}

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

function stopError(msg: string) {
    console.log(msg);
    process.exit(1);
}

export default async function(args: CommandOptions_ShadCnAdd) {
    args.dir = jk_fs.resolve(args.dir);
    if (!args.mod.startsWith("mod_")) args.mod = "mod_" + args.mod;

    let componentJson = await jk_fs.readJsonFromFile(args.dir + "/components.json");
    if (!componentJson) stopError("No 'components.json' file found in " + args.dir);

    // "new-york" or "default"
    let style = componentJson.style;
    
    while (true) {
        let component = args.components.pop();
        if (!component) break;

        await installComponent(args, component, style, componentJson);
    }

    console.log(`\n${jk_term.textGreen("✔")} Installed`);

    if (gHadDependenciesAdded) {
        console.log(`${jk_term.textRed("Warning - Dependencies has been added")} - You must run ${jk_term.textBlue("npm install")} to install them.`);
    }
}

async function installComponent(args: CommandOptions_ShadCnAdd, component: string, style: any, componentJson: any) {
    let url = `https://ui.shadcn.com/r/styles/${style}/${component}.json`;
    if (args.registry) url = args.registry + "/" + component + ".json";

    let content = await fetch(url);
    if (!content.ok) stopError(`Error fetching ${url}`);

    let json = await content.json() as ShadCn_ComponentJson;

    console.log(`>>> Component ${jk_term.textBlue(component)} - ${jk_term.textGrey(json.type)}`)

    if (json.registryDependencies) {
        for (let dep of json.registryDependencies) {
            if (!args.components.includes(dep)) {
                args.components.push(dep);
            }
        }
    }

    if (json.files) {
        for (let file of json.files) {
            await installFile(args, component, file);
        }
    }

    await installDependencies(args, json.dependencies, json.devDependencies);

    //console.log(json);
}

async function installFile(args: CommandOptions_ShadCnAdd, component: string, file: ShadCn_FileInfos) {
    function pathAlias(content: string): string {
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

    function patchFilePath(filePath: string): string {
        function convert(toReplace: string, replaceBy: string, filePath: string): string {
            filePath = replaceBy + filePath.substring(toReplace.length);
            let parts = filePath.split("/");
            return jk_fs.join(...parts);
        }

        if (filePath.startsWith("ui/")) return convert("ui/", "@alias/shadUI/", filePath);
        if (filePath.startsWith("lib/")) return convert("lib/", "@alias/shadLib/", filePath);
        if (filePath.startsWith("hooks/")) return convert("hooks/", "@alias/shadHooks/", filePath);
        if (filePath.startsWith("utils/")) return convert("utils/", "@alias/shadUtils/", filePath);
        if (filePath.startsWith("components/")) return convert("utils/", "@alias/shadComponents/", filePath);

        return filePath;
    }

    let filePath = patchFilePath(file.path);
    let fileContent = file.content;
    file.content = "[jopi-done]";

    let localPath = jk_fs.join("src", args.mod, filePath);
    let finalPath = jk_fs.join(args.dir, localPath);

    if (await jk_fs.isFile(finalPath)) {
        if (args.no===true) return;

        if (args.yes!==true) {
            let res = await confirm({message: `Override file ${jk_term.textBlue(localPath)}`, default: false});
            if (!res) return;
        }
    }

    console.log(`    ${jk_term.textRed(">")} Added file ${jk_term.textBlue(localPath)}`);

    file.content = pathAlias(file.content);
    await jk_fs.writeTextToFile(finalPath, fileContent);
}

async function installDependencies(args: CommandOptions_ShadCnAdd, dependencies: string[], devDependencies: string[]) {
    if (!dependencies && !devDependencies) return;

    let pkgJsonFilePath = jk_app.findPackageJson(args.dir);
    if (!pkgJsonFilePath) stopError("No 'package.json' file found in " + args.dir);

    let json = await jk_fs.readJsonFromFile<PackageJson>(pkgJsonFilePath);
    if (!json) stopError("Can't read 'package.json' file at" + pkgJsonFilePath);

    let mustSave = false;

    if (dependencies) {
        if (!json.dependencies) json.dependencies = {};

        for (let dep of dependencies) {
            let idx = dep.indexOf("@");
            if (idx===-1) continue;

            let depName = dep.substring(0, idx);
            let depVersion = "^" + dep.substring(idx+1);

            if (!json.dependencies[depName]) {
                mustSave = true;
                gHadDependenciesAdded = true;
                json.dependencies[depName] = depVersion;
                console.log(`    ${jk_term.textRed(">")} Added dependency ${dep}`);
            }
        }
    }

    if (devDependencies) {
        for (let dep of devDependencies) {
            let idx = dep.indexOf("@");
            if (idx===-1) continue;

            let depName = dep.substring(0, idx);
            let depVersion = dep.substring(idx+1);

            if (!json.devDependencies[depName]) {
                mustSave = true;
                gHadDependenciesAdded = true;
                json.devDependencies[depName] = depVersion;
                console.log(`    ${jk_term.textRed(">")} Added dev-dependency ${dep}`);
            }
        }
    }

    if (mustSave) {
        await jk_fs.writeTextToFile(pkgJsonFilePath, JSON.stringify(json, null, 4));
    }
}

let gHadDependenciesAdded = false;