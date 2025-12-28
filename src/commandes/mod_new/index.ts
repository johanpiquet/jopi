import {getModulesList, setProjectRootDir, toModDirName, toNpmModuleName, updateWorkspaces} from "jopijs/modules";
import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";

export interface CommandOptions_ModNew {
    dir: string;
    moduleName: string;
}

export async function commandModNew(args: CommandOptions_ModNew) {
    let rootDir = jk_fs.resolve(args.dir) || process.cwd();
    setProjectRootDir(rootDir);

    let modName = args.moduleName;
    if (!modName.startsWith("mod_") && !modName.includes("jopimod_")) modName = "mod_" + modName;
    modName = toModDirName(modName)!;

    if (!modName) {
        console.log(`⚠️ Invalid module name ${jk_term.textRed(args.moduleName)}. Exiting.`);
        return;
    }

    let allModules = await getModulesList();
    if (allModules[modName]) {
        console.log(`⚠️ Module ${jk_term.textRed(modName)} already exists. Exiting.`);
        return;
    }

    let modDir = jk_fs.join(rootDir, "src", modName);
    await tryAddDir(jk_fs.join(modDir, "@routes"));
    await tryAddDir(jk_fs.join(modDir, "@alias"));

    let npmName = toNpmModuleName(modName);

    await tryAddFile(jk_fs.join(modDir, "package.json"), `{
  "name": "${npmName}",
  "version": "0.0.1",
  "description": "",
  "dependencies": {},
  "devDependencies": {},
  "jopi": { "modDependencies": [] }
}`);

    await tryAddFile(jk_fs.join(modDir, "uiInit.tsx"), `import {JopiUiApplication} from "jopijs/ui";

export default function(uiApp: JopiUiApplication) {
}`);

    await tryAddFile(jk_fs.join(modDir, "serverInit.ts"), `import {JopiWebSiteBuilder} from "jopijs";

export default async function(webSite: JopiWebSiteBuilder) {
}`);

    console.log(`\n${jk_term.textGreen("✔")} Module ${jk_term.textGreen(modName)} created.`);

    await updateWorkspaces();
}

async function tryAddFile(filePath: string, fileContent: string) {
    if (!await jk_fs.isFile(filePath)) {
        await jk_fs.writeTextToFile(filePath, fileContent);
    }
}

async function tryAddDir(dirPath: string) {
    if (!await jk_fs.isDirectory(dirPath)) {
        await jk_fs.mkDir(dirPath);
    }
}
