import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import {toModDirName, updateWorkspaces} from "jopijs/modules";
import os from "os";
import fs from "node:fs/promises";
import path from "node:path";

export interface CommandOptions_Link {
    dir: string;
    modules?: string[];
}

const GLOBAL_LINKS_DIR = jk_fs.join(os.homedir(), ".jopi", "links");

/**
 * Ensures that the global links directory exists.
 */
async function ensureGlobalLinksDir() {
    if (!await jk_fs.isDirectory(GLOBAL_LINKS_DIR)) {
        await jk_fs.mkDir(GLOBAL_LINKS_DIR);
    }
}

/**
 * Recursively searches for the project root (containing package.json) starting from a directory.
 */
async function findProjectRoot(startDir: string): Promise<string | null> {
    let currentDir = startDir;
    while (true) {
        if (await jk_fs.isFile(path.join(currentDir, "package.json"))) {
            return currentDir;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) return null;
        currentDir = parentDir;
    }
}

/**
 * Main entry point for the 'link' command.
 * Dispatches to either global registration or project linking based on arguments.
 * 
 * Usage:
 * - `jopi link`: Registers the current module globally.
 * - `jopi link <modName>`: Links a globally registered module to the current project.
 */
export async function commandLink(args: CommandOptions_Link) {
    await ensureGlobalLinksDir();

    if (!args.modules || args.modules.length === 0) {
        // Mode 1: Register globally
        await registerModuleGlobally(args.dir);
    } else {
        // Mode 2: Link to project
        await linkModulesToProject(args.dir, args.modules);
    }
}

/**
 * Registers a module globally by creating a symlink in ~/.jopi/links.
 * Validates that the directory is a valid module (starts with 'mod_').
 */
async function registerModuleGlobally(startDir: string) {
    const startPath = jk_fs.resolve(startDir);
    const moduleRoot = await findProjectRoot(startPath);

    if (!moduleRoot) {
        jk_term.logBgRed("❌ Error: No package.json found in current or parent directories.");
        return;
    }

    const modName = jk_fs.basename(moduleRoot);

    if (!modName.startsWith("mod_")) {
        jk_term.logBgRed(`❌ Error: Invalid module folder name '${modName}'. Must start with 'mod_'.`);
        return;
    }

    const linkPath = jk_fs.join(GLOBAL_LINKS_DIR, modName);

    try {
        // Remove existing link if it exists to ensure freshness
        try {
            await fs.rm(linkPath, { force: true, recursive: true });
        } catch {}
        
        await fs.symlink(moduleRoot, linkPath);
        jk_term.logGreen(`✓ Module linked globally: ${modName} -> ${moduleRoot}`);
        console.log(`You can now go to a project and run 'jopi link ${modName}'`);

    } catch (e) {
        jk_term.logBgRed("❌ Error creating global link:", e);
    }
}

/**
 * Links globally registered modules into the current project's src/ directory.
 * @param projectDir The root directory of the target project.
 * @param moduleNames List of module names to link.
 */
async function linkModulesToProject(projectDir: string, moduleNames: string[]) {
    const projectRoot = jk_fs.resolve(projectDir);
    const srcDir = jk_fs.join(projectRoot, "src");

    if (!await jk_fs.isDirectory(srcDir)) {
        jk_term.logBgRed("❌ Error: 'src' directory not found in project.");
        return;
    }

    for (const rawName of moduleNames) {
        const modName = toModDirName(rawName);
        if (!modName) {
            console.log(jk_term.textRed(`Warning: Invalid module name '${rawName}'. Skipping.`));
            continue;
        }

        const globalLinkPath = path.join(GLOBAL_LINKS_DIR, modName);
        
        // Check existence manually since jk_fs doesn't have simple exists
        try {
            await fs.access(globalLinkPath);
        } catch {
            console.log(jk_term.textRed(`Error: Module '${modName}' not found in global links.`));
            console.log(`Run 'jopi link' inside the '${modName}' directory first.`);
            continue;
        }

        const destPath = path.join(srcDir, modName);

        try {
            // Check existence of destination using lstat to see symlinks
            const stat = await fs.lstat(destPath);
            if (stat.isSymbolicLink()) {
               console.log(jk_term.textBlue(`ℹ Module '${modName}' already linked.`));
            } else {
               console.log(jk_term.textRed(`Error: Directory '${modName}' already exists in src/ and is not a symlink.`));
            }
            continue;
        } catch (e: any) {
            // Not exists, safe to proceed
            if (e.code !== 'ENOENT') throw e; 
        }

        try {
            const targetPath = await fs.readlink(globalLinkPath);
             // Create absolute symlink
             // We read where the global link points to, and link specificially to THAT
             // The global link is just a registry.
            await fs.symlink(targetPath, destPath);
            jk_term.logGreen(`✓ Module '${modName}' linked to project.`);
        } catch (e) {
            jk_term.logBgRed(`❌ Error linking module '${modName}':`, e);
        }
    }

    await updateWorkspaces();
}

/**
 * Lists all modules currently registered in the global ~/.jopi/links directory.
 */
export async function commandLinkList() {
    await ensureGlobalLinksDir();
    const links = await fs.readdir(GLOBAL_LINKS_DIR);
    
    if (links.length === 0) {
        console.log("No global module links found.");
        return;
    }

    console.log(jk_term.textBlue("Global Jopi Module Links:"));
    for (const linkName of links) {
        const linkPath = path.join(GLOBAL_LINKS_DIR, linkName);
        try {
            const target = await fs.readlink(linkPath);
            console.log(`- ${jk_term.textGreen(linkName)} -> ${target}`);
        } catch (e) {
             console.log(`- ${jk_term.textRed(linkName)} (broken link)`);
        }
    }
}
