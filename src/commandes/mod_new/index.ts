import {setProjectRootDir, updateWorkspaces} from "jopijs/modules";
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
    if (modName.startsWith("mod_")) modName = modName.substring("mod_".length);
    else if (modName.startsWith("jopimod_")) modName = modName.substring("jopimod_".length);

    let modDir = jk_fs.join(rootDir, "src", "mod_" + modName);

    let stats = await jk_fs.getFileStat(modDir);
    if (stats) {
        console.log(`⚠️ Module ${jk_term.textRed(modName)} already exists. Exiting.`);
        return;
    }

    await tryAddDir(jk_fs.join(modDir, "@routes"));
    await tryAddDir(jk_fs.join(modDir, "@alias"));

    await tryAddFile(jk_fs.join(modDir, "package.json"), `{
  "name": "${modName}",
  "version": "0.0.1",
  "description": "",
  "dependencies": {},
  "devDependencies": {},
  "jopi": { "modDependencies": [] }
}`);

    await tryAddFile(jk_fs.join(modDir, "uiInit.tsx"), `import {UiKitModule} from "jopijs/uikit";

export default function(myModule: UiKitModule) {
}`);

    await tryAddFile(jk_fs.join(modDir, "serverInit.ts"), `import {JopiEasyWebSite} from "jopijs";

export default async function(webSite: JopiEasyWebSite) {
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
