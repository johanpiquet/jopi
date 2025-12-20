import commandShadCnAdd from "../shadCn_add/index.ts";
import * as jk_term from "jopi-toolkit/jk_term";

export interface CommandOptions_ShadCnInit {
    dir: string;
    yes?: boolean;
    no?: boolean;
}

export default async function shadCn_init(args: CommandOptions_ShadCnInit) {
    await commandShadCnAdd({...args, components: [], mod: ""}, false);
    console.log(`${jk_term.textGreen("✔")} ShadCN initialized`);
}