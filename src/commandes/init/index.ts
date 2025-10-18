import {term} from "../../common.ts";
import {showMenu_SelectTemplate} from "./menu.ts";
import {getProjectList, type ProjectItem} from "./github.ts";
import * as process from "node:process";
import * as ns_fs from "jopi-node-space/ns_fs";
import {downloadDir, downloadFile} from "./gitpick.js";
import {config} from "dotenv";

config();

export type SelectedTemplate = {
    template: string;
    installDir?: string;
    options?: Record<string, any>;
};

export interface CommandOptions_Init {
    template: string;
    engine: "bun"|"node";
    dir: string;

    [key: string]: any;
}

export default async function(argv: CommandOptions_Init) {
    let selection: SelectedTemplate | undefined;

    //region Gets the template name and his options

    if (!argv.template) {
        selection = await showMenu_SelectTemplate();
        if (!selection) process.exit(1);

        let optionList = "";

        if (selection.options) {
            for (let optionName in selection.options) {
                let optionValue = selection.options[optionName];

                if (typeof optionValue === "boolean") {
                    optionList += ` --${optionName}`;
                } else {
                    optionList += ` --${optionName} ${optionValue}`;
                }
            }

            optionList = optionList.trim();
        }

        let text = term.color.blue(`jopi init --template ${selection.template} ${optionList}`);
        process.stdout.write("You can directly invoke: " + text + "\n");
    } else {
        let options: any = {...argv};
        delete options.template;
        selection = {template: argv.template, options};
    }

    if (argv.dir) {
        selection.installDir = ns_fs.resolve(argv.dir);
    } else {
        selection.installDir = process.cwd();
    }

    //endregion

    //region Gets the template descriptor

    let projectList = await getProjectList();
    let project = projectList.projects.find(p => p.template===selection.template);

    if (!project) {
        process.stderr.write(term.color.red(`⚠️ Error: template '${selection.template}' not found !\n`));
        process.exit(1);
    }

    //endregion

    //region Downloads the project

    await installProjectSources(project, selection.installDir);

    //endregion

    //region Installs and executes the installer

    if (project.hasInstaller) {
        await executeProjectInstaller(project, selection);
    }

    //endregion
}

async function executeProjectInstaller(project: ProjectItem, selection: SelectedTemplate) {
    //region Downloads the script

    let installDir = ns_fs.join(import.meta.dirname, "temp");
    let filePath = ns_fs.join(installDir, "install.js");

    await ns_fs.mkDir(installDir);
    await ns_fs.unlink(filePath);

    await downloadFile(project.template + "/install/index.js", filePath);

    //endregion

    //region Execute the script

    try {
        let installer = (await import(filePath)).default;

        if (installer) {
            let res = installer({
                selected: {...selection},
                project: project,
            });

            if (res instanceof Promise) await res;
        }
    }
    catch (e) {
        console.error("Error when executing the custom install script", e);
        process.exit(1);
    }

    //endregion
}

async function installProjectSources(project: ProjectItem, installDir: string) {
    await ns_fs.mkDir(installDir);
    await downloadDir( project.template + "/project", ".");
}
