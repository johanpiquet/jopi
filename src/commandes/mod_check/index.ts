import {updateWorkspaces} from "jopijs/modules";

export interface CommandOptions_ModCheck {
    dir: string;
}

export async function commandModCheck(args: CommandOptions_ModCheck) {
    await updateWorkspaces();
}
