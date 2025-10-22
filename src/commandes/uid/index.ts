import * as jk_tools from "jopi-toolkit/jk_tools";
import * as jk_term from "jopi-toolkit/jk_term";

export default function() {
    jk_tools.generateUUIDv4();
    console.log("New UID:", jk_term.textBgRed(jk_tools.generateUUIDv4()));
}