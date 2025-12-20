import {commandModInstall} from "../mod_install/index.js";

export interface CommandOptions_ModCheck {
    dir: string;
}

export async function commandModCheck(args: CommandOptions_ModCheck) {
    await commandModInstall(args)
}
