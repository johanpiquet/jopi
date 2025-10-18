import {findPackageJSON} from "node:module";
import * as path from "node:path";
import {execFile} from "node:child_process";
import * as ns_fs from "jopi-node-space/ns_fs";
import process from "node:process";
import {term} from "../../common.js";

const GITHUB_URL = "https://github.com/johanpiquet/jopiProjectTemplates/";

async function executeGitPick(cwd: string, params: string[]): Promise<boolean> {
    let gitPickDir = findPackageJSON("gitpick", import.meta.url);
    if (!gitPickDir) return false;
    gitPickDir = path.dirname(gitPickDir);

    let gitPickEntryPoint = path.join(gitPickDir, "dist", "index.js");
    let nodePath = process.argv[0];

    let args: string[] = [gitPickEntryPoint, "--", ...params];

    const pr = new Promise<boolean>((resolve) => {
        execFile(nodePath, args, {cwd}, (error, _stdout, stderr) => {
            if (error) {
                //console.log(stderr);
                return resolve(false);
            }

            resolve(true);
        });
    })

    return await pr;
}

export async function downloadFile(internalPath: string, outputPath: string): Promise<void> {
    let dirPath = ns_fs.dirname(outputPath);
    let fileName = ns_fs.basename(outputPath);

    let resUrl = GITHUB_URL + "blob/main/projects_v2/" + internalPath;
    let isOk = await executeGitPick(dirPath, [resUrl, fileName]);

    if (!isOk) {
        process.stderr.write(term.color.red(`⚠️ Error: github resource not found '${resUrl}'\n`));
        process.exit(1);
    }
}

export async function downloadDir(internalPath: string, outputPath: string): Promise<void> {
    let dirPath = ns_fs.dirname(outputPath);

    let resUrl = GITHUB_URL + "tree/main/projects_v2/" + internalPath;
    let isOk = await executeGitPick(dirPath, [resUrl, "."]);

    if (!isOk) {
        process.stderr.write(term.color.red(`⚠️ Error: github resource not found '${resUrl}'\n`));
        process.exit(1);
    }
}