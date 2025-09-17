import {fileURLToPath} from "node:url";
import {copyDirectory} from "./templateTools.js";

export type TemplateKind = "minimal" | "api-server" | "react-ssr" | "page-router";
export type EngineKind = "bun" | "node";

export type SubChoices = {
    engine: EngineKind;
};

export type Selection = {
    template: TemplateKind;
    options: SubChoices;
    installDir: string;
}

export async function installTemplate(selection: Selection) {
    console.log("selection", selection);

    let templateDir = fileURLToPath(import.meta.resolve("../templates/" + selection.template));
    console.log("templateDir", templateDir);

    await copyDirectory(templateDir, selection.installDir);
}