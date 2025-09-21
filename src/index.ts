import {ask, term, useTerm} from "./cliMenu.js";
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {installTemplate, type Selection} from "./templateEngine.ts";
import * as path from "node:path";

async function doShowMenu(): Promise<Selection | null> {
    let selection = await useTerm<Selection>(async () => {
        const template = await ask({
            title: 'What template to install',
            choices: [
                {label: 'Minimal', value: 'minimal', hint: 'A template with minimal thing'},
                {label: 'React SSR / API', value: 'react-ssr-api', hint: 'React SSR using API and manual declarations'},
                {label: 'React SSR / Router', value: 'react-ssr-router', hint: 'React SSR using page router / react-router'}
            ]
        });

        if (!template) return null;

        return {template: template.value} as Selection;
    });

    if (!selection) return null;

    process.stdout.write('\n');
    process.stdout.write(term.color.green('✓ Installation done') + '\n');
    process.stdout.write(`Template: ${term.color.cyan(selection.template)}\n`);
    process.stdout.write('\n');
    process.stdout.write(`You can directly invoke: jopi create ${selection.template}\n`);

    return selection;
}

async function startUp() {
    yargs(hideBin(process.argv))
        // <template> --> arg template is required
        // [template] --> arg template is optional
        .command("create [template]", "Create a new project from a template.", (yargs) => {
            return yargs
                .positional('template', {
                    type: 'string',
                    choices: ['minimal', 'api-server'],
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
                });
        }, async (argv) => {
            let selection: Selection | null;

            if (!argv.template) {
                selection = await doShowMenu();
            } else {
                selection = {
                    template: argv.template
                }
            }

            if (selection) {
                selection.installDir = path.resolve(argv.dir) || process.cwd();
                await installTemplate(selection);
            }
        })
        .demandCommand(1, 'You must specify a valid command.')
        .version("1.0").strict().help().parse();
}

startUp().then();
