import "./loadDotEnvFile.ts";

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

import commandInit, {type CommandOptions_Init} from "./commandes/init/index.ts";
import commandUID from "./commandes/uid/index.ts";
import commandShadCnAdd, {type CommandOptions_ShadCnAdd} from "./commandes/shadCn_add/index.ts";
import {commandModInstall, type CommandOptions_ModInstall} from "./commandes/mod_install/index.ts";
import {commandModCheck, type CommandOptions_ModCheck} from "./commandes/mod_check/index.js";

yargs(hideBin(process.argv))
    .command("uid", "Print a new UID", ()=> {} , ()=> {
        commandUID();
    })
    .command("init [template]", "Initialize a new project from a template.", (yargs) => {
        return yargs
            .positional('template', {
                type: 'string',
                describe: 'The name of the template to use.\nIf not provided, a menu will be shown.',
                demandOption: false,
            })
            .option('engine', {
                type: 'string',
                choices: ['bun', 'node'],
                default: "node",
                description: "The engine to use ('bun' or 'node').",
            }).option("dir", {
                type: "string",
                description: "The installation directory.",
                default: process.cwd()
            }).option("forcegit", {
                type: "boolean",
                description: "Force the use of git.",
                default: false
            });
        },

        (args: any) => commandInit(args as CommandOptions_Init)
    )

    .command("shadcn-add <components..>", "Install ShadCN components", (yargs) => {
        return yargs
            .positional('components', {
                type: 'string',
                array: true,
                describe: 'The components to add.',
                demandOption: true,
            }).option('mod', {
                type: 'string',
                default: "shadCN",
                description: "The module to install into.",
            }).option("dir", {
                type: "string",
                description: "The installation directory.",
                default: process.cwd()
            }).option("registry", {
                type: "string",
                description: "The url of the registry to use."
            }).option("yes", {
                type: "boolean",
                description: "Return yes to each question."
            }).option("no", {
                type: "boolean",
                description: "Return no to each question."
            });
        },
        (args: any) => commandShadCnAdd(args as CommandOptions_ShadCnAdd)
    )

    .command("mod-check", "Check the modules", (yargs) => {
            return yargs
                .option("dir", {
                    type: "string",
                    description: "The installation directory.",
                    default: process.cwd()
                });
        },
        (args: any) => commandModCheck(args as CommandOptions_ModCheck)
    )

    .command("mod-install [modules..]", "Install modules into the src/ dir", (yargs) => {
            return yargs
                .positional('modules', {
                    type: 'string',
                    array: true,
                    describe: 'The modules to install.',
                    demandOption: true,
                }).option("dir", {
                    type: "string",
                    description: "The installation directory.",
                    default: process.cwd()
                });
        },
        (args: any) => commandModInstall(args as CommandOptions_ModInstall)
    )

    .demandCommand(1, 'You must specify a valid command.')
    .version("2.0").help().parse();
