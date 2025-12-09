import "./loadDotEnvFile.ts";

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

import commandInit, {type CommandOptions_Init} from "./commandes/init/index.ts";
import commandUID from "./commandes/uid/index.ts";

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
    }, (args: any) => commandInit(args as CommandOptions_Init))
    .demandCommand(1, 'You must specify a valid command.')
    .version("2.0").help().parse();
