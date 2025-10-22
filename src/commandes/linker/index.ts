import * as jk_linker from "jopi-toolkit/jk_linker";

export default async function() {
    await jk_linker.compile();
    console.log("✅  Linker compilation finished.");
}