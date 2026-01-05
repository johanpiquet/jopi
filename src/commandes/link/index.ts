import {compile, getDefaultLinkerConfig} from "jopijs/linker";
import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";

export interface CommandOptions_Link {
    dir: string;
}

export default async function(args: CommandOptions_Link) {
    const projectRootDir = jk_fs.resolve(args.dir);
    
    if (!await jk_fs.isDirectory(projectRootDir)) {
        jk_term.logBgRed("⚠️ Error: directory not found", projectRootDir);
        process.exit(1);
    }

    // Inform jk_app about the project root
    jk_app.setApplicationMainFile(jk_fs.join(projectRootDir, "src", "index.ts"));

    const config = getDefaultLinkerConfig();
    config.projectRootDir = projectRootDir;

    jk_term.logBlue("Linking project at:", projectRootDir);

    try {
        await compile(import.meta, config);
        jk_term.logGreen("✓ Project linked successfully");
    } catch (e) {
        jk_term.logBgRed("⚠️ Error during linking", e);
        process.exit(1);
    }
}
