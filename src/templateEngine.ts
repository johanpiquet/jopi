import {fileURLToPath} from "node:url";
import {copyDirectory} from "./templateTools.js";

export type Selection = {
    template: string;
    installDir?: string;
}

export async function installTemplate(selection: Selection) {
    let templateDir = fileURLToPath(import.meta.resolve("../templates/" + selection.template));
    await copyDirectory(templateDir, selection.installDir!);
}