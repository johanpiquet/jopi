import {downloadFile} from "./gitpick.js";
import * as jk_fs from "jopi-toolkit/jk_fs";

//region project.json file format

export interface ProjectFile {
    projects: ProjectItem[];
}

export interface ProjectItem {
    title: string;
    template: string;

    options?: ProjectOptions[];

    hasInstaller?: boolean;
}

export interface ProjectOptions {
    title: string;
    type: "ask" | "confirm";
    code: string;
    default?: boolean|string;
}

//endregion

//region Getting the project list

const ONE_HOUR = 1000 * 60 * 60;
const ENABLE_CACHE = false;

async function updateProjectsList(): Promise<string> {
    let filePath = jk_fs.resolve(import.meta.dirname, "projects.json");
    let mustDownload = true;

    if (ENABLE_CACHE) {
        let stats = await jk_fs.getFileStat(filePath);

        if (stats) {
            let now = Date.now();

            if ((now - stats.mtimeMs) < ONE_HOUR) {
                mustDownload = false;
            }
        }
    }

    if (mustDownload) {
        await jk_fs.unlink(filePath);
        console.log("Uploading projects list...")
        await downloadFile("projects.json", filePath);
    }

    return filePath;
}

let gProjectList: ProjectFile | undefined;

export async function getProjectList(): Promise<ProjectFile> {
    if (gProjectList) return gProjectList;

    let filePath = await updateProjectsList();
    return gProjectList = JSON.parse(await jk_fs.readTextFromFile(filePath));
}

//endregion