import {findPackageJSON} from "node:module";
import * as path from "node:path";
import {execFile} from "node:child_process";
import * as ns_fs from "jopi-toolkit/ns_fs";
import process from "node:process";
import {term} from "../../common.js";
import {copyDirectory, copyFile} from "../../templateTools.js";

const GITHUB_URL = "https://github.com/johanpiquet/jopiProjectTemplates/";

async function executeGitPick(cwd: string, params: string[]): Promise<boolean> {
    let gitPickDir = findPackageJSON("gitpick", import.meta.url);
    if (!gitPickDir) return false;
    gitPickDir = path.dirname(gitPickDir);

    let gitPickEntryPoint = path.join(gitPickDir, "dist", "index.js");
    let nodePath = process.argv[0];

    let args: string[] = [gitPickEntryPoint, "--", ...params];

    const pr = new Promise<boolean>((resolve) => {
        execFile(nodePath, args, {cwd}, (error, _stdout, _stderr) => {
            if (error) {
                console.log(_stdout);
                console.log(_stderr);
                return resolve(false);
            }

            resolve(true);
        });
    })

    return await pr;
}

export async function downloadFile(internalPath: string, outputPath: string): Promise<void> {
    if (process.env.JOPI_INIT_USE_DEV_DIR) {
        return copyThisFile(internalPath, outputPath);
    }

    await ns_fs.unlink(outputPath);

    let dirPath = ns_fs.dirname(outputPath);
    let fileName = ns_fs.basename(outputPath);

    let resUrl = GITHUB_URL + "blob/main/projects_v2/" + internalPath;
    let isOk = await executeGitPick(dirPath, [resUrl, fileName]);

    if (!isOk) {
        process.stderr.write(term.color.red(`⚠️ Error: github file not found '${resUrl}'\n`));
        process.exit(1);
    }
}

export async function downloadDir(internalPath: string, outputDir: string): Promise<void> {
    if (process.env.JOPI_INIT_USE_DEV_DIR) {
        return copyThisDir(internalPath, outputDir);
    }

    outputDir = ns_fs.resolve(outputDir);
    await ns_fs.rmDir(outputDir);
    await ns_fs.mkDir(outputDir);

    let resUrl = GITHUB_URL + "tree/main/projects_v2/" + internalPath;
    let isOk = await executeGitPick(outputDir, [resUrl, "."]);

    if (!isOk) {
        process.stderr.write(term.color.red(`⚠️ Error: github dir not found '${resUrl}'\n`));
        process.exit(1);
    }
}

async function copyThisFile(internalPath: string, outputPath: string): Promise<void> {
    let baseDir = process.env.JOPI_INIT_USE_DEV_DIR!;
    internalPath = ns_fs.resolve(baseDir, internalPath);
    console.log("Dev mode - Cloning file: ", internalPath);

    return copyFile(internalPath, outputPath);
}

async function copyThisDir(internalPath: string, outputDir: string): Promise<void> {
    let baseDir = process.env.JOPI_INIT_USE_DEV_DIR!;
    internalPath = ns_fs.resolve(baseDir, internalPath);
    console.log("Dev mode - Cloning dir: ", internalPath);

    return copyDirectory(internalPath, outputDir);
}