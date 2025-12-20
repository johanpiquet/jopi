import {commandModInstall} from "../mod_install/index.js";
import * as jk_term from "jopi-toolkit/jk_term";

export interface CommandOptions_ModCheck {
    dir: string;
}

export async function commandModCheck(args: CommandOptions_ModCheck) {
    await commandModInstall(args, false);
    console.log(`${jk_term.textGreen("✓")} Project checked`);
}
