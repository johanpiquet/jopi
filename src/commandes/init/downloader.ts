import * as jk_fs from "jopi-toolkit/jk_fs";
import process from "node:process";
import {githubDownload} from "jopi-toolkit/jk_tools";
import {createTempDir} from "jopi-toolkit/jk_fs";

const GITHUB_URL = "https://github.com/jopijs/jopiProjectTemplates";

export async function downloadProject(internalPath: string, outputPath: string) {
    const tempDir = await createTempDir("jopiInit_")

    try {
        const zipFilePath = jk_fs.join(tempDir.path, "temp.zip");
        await downloadFile(internalPath, zipFilePath);
        await jk_fs.unzipFile(zipFilePath, tempDir.path);

        await jk_fs.copyDirectory(jk_fs.join(tempDir.path, "project"), outputPath);
    }
    finally {
        await tempDir.remove();
    }
}

/**
 * Download the file from the github repository.
 *
 * @param internalPath
 *      The path inside the github repository.
 *      Example: "templateName/project.zip"
 * @param outputPath
 *      The path where the file will be downloaded.
 */
export async function downloadFile(internalPath: string, outputPath: string): Promise<void> {
    let stat = await jk_fs.getFileStat(outputPath);

    if (stat) {
        if (stat.isFile() || stat.isSymbolicLink()) {
            await jk_fs.unlink(outputPath);
        } else if (stat.isDirectory()) {
            await jk_fs.rmDir(outputPath);
        }
    }

    await jk_fs.mkDir(jk_fs.dirname(outputPath));

    if (gLocalDevDir) {
        await jk_fs.copyFile(jk_fs.join(gLocalDevDir, internalPath), outputPath);
    } else {
        await githubDownload({
            url: GITHUB_URL + "/tree/main/projects_v2/" + internalPath,
            downloadPath: outputPath,
            log: false
        });
    }
}

export function forceGit() {
    gLocalDevDir = undefined;
}

function getLocalDevDir(): string|undefined {
    let v = process.env.JOPI_INIT_USE_DEV_DIR;
    if (!v) return undefined;
    if (v==="0") return undefined;

    if (!jk_fs.isDirectorySync(v)) {
        return undefined;
    }

    let flagFilePath = jk_fs.join(v, "jopi-ignore.enable");
    
    if (jk_fs.isFileSync(flagFilePath)) {
        console.log("JOPI_INIT_USE_DEV_DIR - Flag found. Ignoring");
        return undefined;
    } else {
        jk_fs.writeTextToFileSync(jk_fs.join(v, "_jopi-ignore.enable"), "");
    }
        

    console.log("JOPI_INIT_USE_DEV_DIR - Using local dev directory:", v);
    return v;
}

let gLocalDevDir = getLocalDevDir();