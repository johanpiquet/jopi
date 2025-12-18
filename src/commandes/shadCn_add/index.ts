import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_term from "jopi-toolkit/jk_term";
import * as jk_app from "jopi-toolkit/jk_app";

import process from "node:process";
import {confirm, select} from '@inquirer/prompts';

//region Interfaces

type ShadCnType = "registry:lib" |
                "registry:block" |
                "registry:component" |
                "registry:ui" |
                "registry:hook" |
                "registry:theme" |
                "registry:page" |
                "registry:file" |
                "registry:style" |
                "registry:base"|
                "registry:item";

export interface CommandOptions_ShadCnAdd {
    components: string[],
    dir: string;
    mod: string;
    registry?: string;
    yes?: boolean;
    no?: boolean;
}

interface ShadCn_FileInfos {
    /**
     * The path to the file relative to the registry root
     * Exemple: 'ui/chart.tsx'
     */
    path: string;

    /**
     * The file content.
     */
    content: string;

    type: ShadCnType,

    /**
     * The target path of the file. This is the path to the file in the project.
     */
    target: string;
}

/**
 * See: https://ui.shadcn.com/schema/registry-item.json
 */
interface ShadCn_ComponentJson {
    name: string;
    type: ShadCnType;
    author: string;

    /**
     * Exemple: [ 'recharts@2.15.4', 'lucide-react' ]
     */
    dependencies: string[]

    /**
     * Exemple: [ 'recharts@2.15.4', 'lucide-react' ]
     */
    devDependencies: string[];

    /**
     * Exemple: [ 'card' ]
     */
    registryDependencies: string[];

    files: ShadCn_FileInfos[]
}

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: string[];
}

//endregion

//region File Installers

interface FileInstallerParams {
    installBaseDir: string;
    cliArgs: CommandOptions_ShadCnAdd,
    parentItemName: string,
    parentType: ShadCnType,
    fileInfos: ShadCn_FileInfos
}

class FileInstaller {
    constructor(protected params: FileInstallerParams) {
    }

    async install() {
        let filePath = this.patchFilePath(this.params.fileInfos.path);

        // Convert to platform-agnostic (win32 or linux)
        filePath = jk_fs.join(...filePath.split("/"));

        this.installLocalPath = jk_fs.join("src", this.params.cliArgs.mod, filePath);
        this.installFinalPath = jk_fs.join(this.params.cliArgs.dir, this.installLocalPath);

        await this.onBeforeInstall(this.params.fileInfos)

        if (!await this.confirmReplaceFile(this.params.fileInfos.content)) {
            this.params.fileInfos.content = "[jopi-done]";
            return;
        }

        await jk_fs.writeTextToFile(this.installFinalPath, this.params.fileInfos.content);
        this.printAddedMessage();

        this.params.fileInfos.content = "[jopi-done]";
    }

    protected async onBeforeInstall(fileInfos: ShadCn_FileInfos) {
        this.patchAliasImports(fileInfos);
    }

    // ***************

    private installLocalPath: string = "";
    private installFinalPath: string = "";

    /**
     * Define how items are imported.
     * - true: use @alias/shadUI and import "@/shadUI/myComp".
     * - false: use "mod_myMod/shadCN/ui" and import "../ui/myComp".
     */
    protected readonly useAliasMod = false;

    protected patchFilePath(filePath: string): string {
        return this.patchShadCnPath(filePath);
    }

    protected patchShadCnPath(filePath: string): string {
        function replace(toReplace: string, replaceBy: string, filePath: string): string {
            return replaceBy + filePath.substring(toReplace.length);
        }

        if (this.params.parentType==="registry:block") {
            let prefix = "blocks/" + this.params.parentItemName + "/";
            if (filePath.startsWith(prefix)) {
                filePath = filePath.substring(prefix.length);
            }
        }

        if (this.useAliasMod) {
            if (filePath.startsWith("ui/")) return replace("ui/", "@alias/shadUI/", filePath);
            if (filePath.startsWith("lib/")) return replace("lib/", "@alias/shadLib/", filePath);
            if (filePath.startsWith("hooks/")) return replace("hooks/", "@alias/shadHooks/", filePath);
            if (filePath.startsWith("utils/")) return replace("utils/", "@alias/shadUtils/", filePath);
            if (filePath.startsWith("components/")) return replace("components/", "@alias/shadComponents/", filePath);
        } else {
            if (filePath.startsWith("ui/")) return replace("ui/", "shadCN/ui/", filePath);
            if (filePath.startsWith("lib/")) return replace("lib/", "shadCN/lib/", filePath);
            if (filePath.startsWith("hooks/")) return replace("hooks/", "shadCN/hooks/", filePath);
            if (filePath.startsWith("utils/")) return replace("utils/", "shadCN/utils/", filePath);
            if (filePath.startsWith("components/")) return replace("components/", "shadCN/components/", filePath);
        }

        return filePath;
    }

    protected getRelatifShadCnDirPath() {
        return "..";
    }

    protected patchAliasImports(fileInfos: ShadCn_FileInfos) {
        const doPatch = (text: string): string => {
            const content = text;

            let newContent: string[] = [];
            let lines = content.split("\n");
            let max = lines.length;

            for (let i=0;i<max;i++) {
                let line = lines[i];
                let lineImport = line;

                if (lineImport.trim().startsWith("import ")) {
                    let lineFrom = line;
                    let idxFrom = lineImport.indexOf("from");

                    while (idxFrom===-1) {
                        newContent.push(lineFrom);

                        i++;
                        if (i===max) return newContent.join("\n");

                        lineFrom = lines[i];
                        idxFrom = lineFrom.indexOf("from");
                    }

                    line = lineFrom;
                    let idxFromTargetBegin = lineFrom.indexOf("@/", idxFrom);

                    if (idxFromTargetBegin===-1) {
                        newContent.push(lineFrom);
                        continue;
                    }

                    let sep = line[idxFromTargetBegin-1];
                    let idxFromTargetEnd = lineFrom.indexOf(sep, idxFromTargetBegin);

                    let theImport = lineFrom.substring(idxFromTargetBegin, idxFromTargetEnd);
                    let parts = theImport.split("/");

                    if (parts.length >= 2) {
                        let item = parts.pop();
                        let group = parts.pop();

                        if (this.useAliasMod) {
                            switch (group) {
                                case "ui":
                                    group = "shadUI";
                                    break;
                                case "lib":
                                    group = "shadLib";
                                    break;
                                case "components":
                                    group = "shadComponents";
                                    break;
                                case "utils":
                                    group = "shadUtils";
                                    break;
                                case "hooks":
                                    group = "shadHooks";
                                    break;
                                default:
                                    newContent.push(line);
                                    continue;
                            }

                            theImport = "@/" + group + "/" + item;
                        }
                        else {
                            theImport = this.getRelatifShadCnDirPath() + "/" + group + "/" + item;
                        }

                        line = line.substring(0, idxFromTargetBegin) + theImport + line.substring(idxFromTargetEnd);
                    }
                }

                newContent.push(line);
            }

            return newContent.join("\n");
        }

        let fileContent = fileInfos.content;
        fileInfos.content = doPatch(fileContent);
    }

    private printAddedMessage() {
        console.log(`${jk_term.textRed(">")} Added file ${jk_term.textBlue(this.installLocalPath)}`);
    }

    private async confirmReplaceFile(expectedContent: string): Promise<boolean> {
        if (await jk_fs.isFile(this.installFinalPath)) {
            let currentContent = await jk_fs.readTextFromFile(this.installFinalPath);

            // Content is identical? Nothing to do.
            if (currentContent.trim()===expectedContent.trim()) {
                return false;
            }

            if (this.params.cliArgs.no===true) return false;

            if (this.params.cliArgs.yes!==true) {
                let res = await confirm({message: `Override file ${jk_term.textBlue(this.installFinalPath)}`, default: false});
                if (!res) return false;
            }
        }

        return true;
    }
}

class FileInstaller_Page extends FileInstaller {
    protected patchFilePath(filePath: string): string {
        const fileDir = "@routes/shadPages/" + this.params.parentItemName + "/";
        filePath = super.patchFilePath(filePath);
        return fileDir + filePath;
    }

    protected getRelatifShadCnDirPath() {
        return "../../../shadCN";
    }
}

class FileInstaller_PageFile extends FileInstaller {
    protected patchFilePath(filePath: string): string {
        let basePath = "@routes/shadPages/" + this.params.parentItemName;
        filePath = super.patchFilePath(filePath);
        return basePath + "/" + filePath;
    }
}

//endregion

//region Item installer

interface ItemInstallerParams {
    cliArgs: CommandOptions_ShadCnAdd,
    itemName: string,
    itemType: ShadCnType,
    item: ShadCn_ComponentJson
}

class ItemInstaller {
    private readonly installBaseDir: string;

    constructor(private params: ItemInstallerParams) {
        this.installBaseDir = params.cliArgs.dir + '/src/' + params.cliArgs.mod;
    }

    async install() {
        if (!this.acceptItem(this.params.item)) {
            console.log(`Ignored item ${jk_term.textBlue(this.params.itemName)} of type ${jk_term.textGrey(this.params.itemType)}`);
            return;
        }

        this.queueShadCnDependencies();
        await this.installPackageJsonDependencies();
        await this.installAllFiles();
    }

    protected acceptItem(item: ShadCn_ComponentJson) {
        switch (item.type) {
            case "registry:ui":
                return true;
            case "registry:component":
                return true;
            case "registry:block":
            case "registry:hook":
            case "registry:lib":
                return true;
            default:
                return false;
        }
    }

    protected queueShadCnDependencies() {
        // Queue ShadCN items this item depends on.
        //
        if (this.params.item.registryDependencies) {
            for (let dep of this.params.item.registryDependencies) {
                if (!this.params.cliArgs.components.includes(dep)) {
                    this.params.cliArgs.components.push(dep);
                }
            }
        }
    }

    protected async installPackageJsonDependencies() {
        function appendAll() {
            for (let dep of list) {
                let dep2 = dep;
                if (dep[0]==="@") dep2 = dep.substring(1);

                let version = "latest";
                let name = dep;

                let idx = dep2.indexOf("@");

                if (idx!==-1) {
                    name = dep2.substring(0, idx);
                    version = dep2.substring(idx+1);

                    if (version!=="latest") {
                        let first = version[0];
                        if ((first!=="^") && (first!==">") && (first !== "~")) version = "^" + version;
                    }
                }

                let currentVersion = map[name];

                if (currentVersion) {
                    if (version==="latest") {
                        continue;
                    }
                }

                map[name] = version;
            }
        }

        const item = this.params.item;
        if (!item.dependencies && !item.devDependencies) return;

        let map = gDependenciesToAdd;
        let list = item.dependencies;
        if (list) appendAll();

        map = gDevDependenciesToAdd;
        list = item.devDependencies;
        if (list) {
            appendAll();
        }
    }

    protected async installAllFiles() {
        if (this.params.item.files) {
            for (let fileInfos of this.params.item.files) {
                await this.installThisFile(fileInfos);
            }
        }

        await this.installThisFile({
            type: "registry:lib",
            path: "lib/utils.ts",
            target: "",

            content: `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
`
        });
    }

    protected async installThisFile(fileInfos: ShadCn_FileInfos) {
        const fileParams: FileInstallerParams = {
            fileInfos, installBaseDir: this.installBaseDir,
            cliArgs: this.params.cliArgs,
            parentItemName: this.params.itemName,
            parentType: this.params.item.type
        };

        switch (fileParams.fileInfos.type) {
            case "registry:ui":
            case "registry:component":
            case "registry:hook":
            case "registry:lib":
                return (new FileInstaller(fileParams)).install();

            case "registry:page":
                return (new FileInstaller_Page(fileParams)).install();

            case "registry:file":
                if (fileParams.parentType!=="registry:block") {
                    console.log("Ignoring invalid file", fileParams.fileInfos.path);
                    return undefined;
                }

                return (new FileInstaller_PageFile(fileParams)).install();

            default:
                console.log("Ignored file type", fileParams.parentType, fileParams.fileInfos)
                return undefined;
        }
    }
}

//endregion

//region Tailwind Themes

const Theme_Neutral = `
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

const Theme_Gray = `
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.13 0.028 261.692);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.13 0.028 261.692);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.13 0.028 261.692);
  --primary: oklch(0.21 0.034 264.665);
  --primary-foreground: oklch(0.985 0.002 247.839);
  --secondary: oklch(0.967 0.003 264.542);
  --secondary-foreground: oklch(0.21 0.034 264.665);
  --muted: oklch(0.967 0.003 264.542);
  --muted-foreground: oklch(0.551 0.027 264.364);
  --accent: oklch(0.967 0.003 264.542);
  --accent-foreground: oklch(0.21 0.034 264.665);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.928 0.006 264.531);
  --input: oklch(0.928 0.006 264.531);
  --ring: oklch(0.707 0.022 261.325);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0.002 247.839);
  --sidebar-foreground: oklch(0.13 0.028 261.692);
  --sidebar-primary: oklch(0.21 0.034 264.665);
  --sidebar-primary-foreground: oklch(0.985 0.002 247.839);
  --sidebar-accent: oklch(0.967 0.003 264.542);
  --sidebar-accent-foreground: oklch(0.21 0.034 264.665);
  --sidebar-border: oklch(0.928 0.006 264.531);
  --sidebar-ring: oklch(0.707 0.022 261.325);
}

.dark {
  --background: oklch(0.13 0.028 261.692);
  --foreground: oklch(0.985 0.002 247.839);
  --card: oklch(0.21 0.034 264.665);
  --card-foreground: oklch(0.985 0.002 247.839);
  --popover: oklch(0.21 0.034 264.665);
  --popover-foreground: oklch(0.985 0.002 247.839);
  --primary: oklch(0.928 0.006 264.531);
  --primary-foreground: oklch(0.21 0.034 264.665);
  --secondary: oklch(0.278 0.033 256.848);
  --secondary-foreground: oklch(0.985 0.002 247.839);
  --muted: oklch(0.278 0.033 256.848);
  --muted-foreground: oklch(0.707 0.022 261.325);
  --accent: oklch(0.278 0.033 256.848);
  --accent-foreground: oklch(0.985 0.002 247.839);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.21 0.034 264.665);
  --sidebar-foreground: oklch(0.985 0.002 247.839);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0.002 247.839);
  --sidebar-accent: oklch(0.278 0.033 256.848);
  --sidebar-accent-foreground: oklch(0.985 0.002 247.839);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;

const Theme_Zinc = `@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.705 0.015 286.067);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.141 0.005 285.823);
  --sidebar-primary: oklch(0.21 0.006 285.885);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.967 0.001 286.375);
  --sidebar-accent-foreground: oklch(0.21 0.006 285.885);
  --sidebar-border: oklch(0.92 0.004 286.32);
  --sidebar-ring: oklch(0.705 0.015 286.067);
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.21 0.006 285.885);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.21 0.006 285.885);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.92 0.004 286.32);
  --primary-foreground: oklch(0.21 0.006 285.885);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --accent: oklch(0.274 0.006 286.033);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.552 0.016 285.938);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.21 0.006 285.885);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.274 0.006 286.033);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.552 0.016 285.938);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

const Theme_Stone = `@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.147 0.004 49.25);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.147 0.004 49.25);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.147 0.004 49.25);
  --primary: oklch(0.216 0.006 56.043);
  --primary-foreground: oklch(0.985 0.001 106.423);
  --secondary: oklch(0.97 0.001 106.424);
  --secondary-foreground: oklch(0.216 0.006 56.043);
  --muted: oklch(0.97 0.001 106.424);
  --muted-foreground: oklch(0.553 0.013 58.071);
  --accent: oklch(0.97 0.001 106.424);
  --accent-foreground: oklch(0.216 0.006 56.043);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.923 0.003 48.717);
  --input: oklch(0.923 0.003 48.717);
  --ring: oklch(0.709 0.01 56.259);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0.001 106.423);
  --sidebar-foreground: oklch(0.147 0.004 49.25);
  --sidebar-primary: oklch(0.216 0.006 56.043);
  --sidebar-primary-foreground: oklch(0.985 0.001 106.423);
  --sidebar-accent: oklch(0.97 0.001 106.424);
  --sidebar-accent-foreground: oklch(0.216 0.006 56.043);
  --sidebar-border: oklch(0.923 0.003 48.717);
  --sidebar-ring: oklch(0.709 0.01 56.259);
}

.dark {
  --background: oklch(0.147 0.004 49.25);
  --foreground: oklch(0.985 0.001 106.423);
  --card: oklch(0.216 0.006 56.043);
  --card-foreground: oklch(0.985 0.001 106.423);
  --popover: oklch(0.216 0.006 56.043);
  --popover-foreground: oklch(0.985 0.001 106.423);
  --primary: oklch(0.923 0.003 48.717);
  --primary-foreground: oklch(0.216 0.006 56.043);
  --secondary: oklch(0.268 0.007 34.298);
  --secondary-foreground: oklch(0.985 0.001 106.423);
  --muted: oklch(0.268 0.007 34.298);
  --muted-foreground: oklch(0.709 0.01 56.259);
  --accent: oklch(0.268 0.007 34.298);
  --accent-foreground: oklch(0.985 0.001 106.423);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.553 0.013 58.071);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.216 0.006 56.043);
  --sidebar-foreground: oklch(0.985 0.001 106.423);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0.001 106.423);
  --sidebar-accent: oklch(0.268 0.007 34.298);
  --sidebar-accent-foreground: oklch(0.985 0.001 106.423);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.553 0.013 58.071);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

const Theme_Slate = `@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.984 0.003 247.858);
  --sidebar-foreground: oklch(0.129 0.042 264.695);
  --sidebar-primary: oklch(0.208 0.042 265.755);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.968 0.007 247.896);
  --sidebar-accent-foreground: oklch(0.208 0.042 265.755);
  --sidebar-border: oklch(0.929 0.013 255.508);
  --sidebar-ring: oklch(0.704 0.04 256.788);
}

.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.929 0.013 255.508);
  --primary-foreground: oklch(0.208 0.042 265.755);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.279 0.041 260.031);
  --accent-foreground: oklch(0.984 0.003 247.858);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;

const gThemes: Record<string, string> = {
    "neutral": Theme_Neutral,
    "gray": Theme_Gray,
    "zinc": Theme_Zinc,
    "stone": Theme_Stone,
    "slate": Theme_Slate,
}

//endregion

function stopError(msg: string) {
    console.log(msg);
    process.exit(1);
}

export default async function(cliArgs: CommandOptions_ShadCnAdd) {
    cliArgs.dir = jk_fs.resolve(cliArgs.dir);
    if (!cliArgs.mod.startsWith("mod_")) cliArgs.mod = "mod_" + cliArgs.mod;

    let componentsJson = await jk_fs.readJsonFromFile(cliArgs.dir + "/components.json");

    if (!componentsJson) {
        await initComponentsJsonFile(cliArgs.dir);
        componentsJson = await jk_fs.readJsonFromFile(cliArgs.dir + "/components.json");
    }

    // "new-york" or "default"
    let baseStyleName = componentsJson.style;
    
    while (true) {
        let component = cliArgs.components.pop();
        if (!component) break;

        await installItem(cliArgs, component, baseStyleName);
    }

    await addDependenciesToPackageJson(cliArgs);

    console.log(`\n${jk_term.textGreen("✔")} Installed`);

    if (gHasDependenciesAdded) {
        console.log(`${jk_term.textBgRed("\n!!!!!! Warning - Dependencies has been added !!!!!!")}\n!!!!!! You must run ${jk_term.textBlue("npm install")} to install them.`);
    }
}

async function installItem(cliArgs: CommandOptions_ShadCnAdd, itemName: string, style: any) {
    let url = `https://ui.shadcn.com/r/styles/${style}/${itemName}.json`;
    if (cliArgs.registry) url = cliArgs.registry + "/" + itemName + ".json";

    let content = await fetch(url);
    if (!content.ok) stopError(`Error fetching ${url}`);

    let json = await content.json() as ShadCn_ComponentJson;

    await new ItemInstaller({
        cliArgs,
        itemName: itemName,
        itemType: json.type,
        item: json
    }).install();

    //console.log(json);
}

async function addDependenciesToPackageJson(cliArgs: CommandOptions_ShadCnAdd) {
    function appendAll(depMap: Record<string, string>, modJson: Record<string, string>) {
        for (let depName in depMap) {
            let depVersion = depMap[depName];

            if (!modJson[depName]) {
                mustSaveModJson = true;
                gHasDependenciesAdded = true;
                modJson[depName] = depVersion;
                console.log(`    ${jk_term.textRed(">")} Added dependency ${depName}`);
            }
        }
    }

    if (
        !Object.values(gDependenciesToAdd).length &&
        !Object.values(gDevDependenciesToAdd).length
    ) return;

    let pkgJsonFilePath = jk_app.findPackageJson(cliArgs.dir);
    if (!pkgJsonFilePath) stopError("No 'package.json' file found in " + cliArgs.dir);

    let packageJson = await jk_fs.readJsonFromFile<PackageJson>(pkgJsonFilePath);
    if (!packageJson) stopError("Can't read 'package.json' file at" + pkgJsonFilePath);

    if (!packageJson.workspaces) packageJson.workspaces = [];

    if (!packageJson.workspaces.includes("src/" + cliArgs.mod)) {
        packageJson.workspaces.push("src/" + cliArgs.mod);
        gHasDependenciesAdded = true;
        await jk_fs.writeTextToFile(pkgJsonFilePath, JSON.stringify(packageJson, null, 4));
    }


    let mustSaveModJson = false;

    let modDir = jk_fs.join(cliArgs.dir, "src", cliArgs.mod);
    let moduleJsonFilePath = jk_fs.join(modDir, "package.json");
    let moduleJson = await jk_fs.readJsonFromFile<PackageJson>(moduleJsonFilePath);

    if (!moduleJson) {
        mustSaveModJson = true;

        moduleJson = {
            dependencies: {},
            devDependencies: {}
        };
    }

    if (gDependenciesToAdd) {
        if (!packageJson.dependencies) packageJson.dependencies = {};
        if (!moduleJson.dependencies) moduleJson.dependencies = {};
        appendAll(gDependenciesToAdd, moduleJson.dependencies);
    }

    if (gDevDependenciesToAdd) {
        if (!packageJson.devDependencies) packageJson.devDependencies = {};
        if (!moduleJson.devDependencies) moduleJson.devDependencies = {};
        appendAll(gDevDependenciesToAdd, moduleJson.devDependencies);
    }

    if (mustSaveModJson) {
        await jk_fs.writeTextToFile(moduleJsonFilePath, JSON.stringify(moduleJson, null, 4));
    }
}

async function initComponentsJsonFile(baseDir: string) {
    jk_term.logRed("components.json not found.");
    let accept = await confirm({message: "Would you like to create a new project?", default: true});
    if (!accept) stopError("Aborted.");

    const selectedColor = await select({
        message: 'Which color to use?',

        choices: [
            {value: 'gray'},
            {value: 'neutral'},
            {value: 'slate'},
            {value: 'stone'},
            {value: 'zinc'}
        ]
    });

    const json = {
        "$schema": "https://ui.shadcn.com/schema.json",
        "style": "new-york",

        "rsc": true,
        "tsx": true,

        "tailwind": {
            "config": "",
            "css": "./globals.css",
            "baseColor": selectedColor,
            "cssVariables": true,
            "prefix": ""
        },

        "aliases": {
            "components": "@/shadComponents",
            "ui": "@/shadUI",
            "lib": "@/shadLib",
            "utils": "@/shadLib/utils",
            "hooks": "@/shadHooks"
        },

        "iconLibrary": "lucide"
    };

    await jk_fs.writeTextToFile(
        jk_fs.join(baseDir, "components.json"),
        JSON.stringify(json, null, 4)
    );

    let globalCssFile = jk_fs.join(baseDir, "global.css");

    if (!await jk_fs.isFile(globalCssFile)) {
        let themeContent = gThemes[selectedColor].trim();
        await jk_fs.writeTextToFile(globalCssFile, themeContent);
    }
}

let gHasDependenciesAdded = false;
let gDependenciesToAdd: Record<string, string> = {};
let gDevDependenciesToAdd: Record<string, string> = {};

