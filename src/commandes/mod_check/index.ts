import {setProjectRootDir, updateWorkspaces} from "jopijs/modules";
import * as jk_fs from "jopi-toolkit/jk_fs";

export interface CommandOptions_ModCheck {
    dir: string;
}

export async function commandModCheck(args: CommandOptions_ModCheck) {
    let rootDir = jk_fs.resolve(args.dir) || process.cwd();
    setProjectRootDir(rootDir);
    await updateWorkspaces();
}
