import * as jk_fs from "jopi-toolkit/jk_fs";
import process from "node:process";
import {githubDownload} from "jopi-toolkit/jk_tools";

const GITHUB_URL = "https://github.com/johanpiquet/jopiProjectTemplates";

export async function downloadFile(internalPath: string, outputPath: string): Promise<void> {
    if (gLocalDevDir) {
        return jk_fs.copyFile(internalPath, outputPath);
    }

    await jk_fs.unlink(outputPath);

    await githubDownload({
        url: GITHUB_URL + "/tree/main/projects_v2/" + internalPath,
        downloadPath: outputPath,
        log: false
    });
}

export async function downloadDir(internalPath: string, outputDir: string): Promise<void> {
    if (gLocalDevDir) {
        return jk_fs.copyDirectory(internalPath, outputDir);
    }

    outputDir = jk_fs.resolve(outputDir);
    await jk_fs.rmDir(outputDir);
    await jk_fs.mkDir(outputDir);

    await githubDownload({
        url: GITHUB_URL + "/tree/main/projects_v2/" + internalPath,
        downloadPath: outputDir,
        log: false
    });
}

function getLocalDevDir(): string|undefined {
    let v = process.env.JOPI_INIT_USE_DEV_DIR;
    if (!v) return undefined;
    if (v==="0") return undefined;
    return v;
}

const gLocalDevDir = getLocalDevDir();