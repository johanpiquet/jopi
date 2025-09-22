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
                {label: 'React SSR / Router', value: 'react-ssr-router', hint: 'React SSR using page router / react-router'},
                {label: 'Docker with Bun.js', value: 'docker-bunjs', hint: 'A docker script executing the app with Bun.js'},
                {label: 'Docker with Node.js', value: 'docker-nodejs', hint: 'A docker script executing the app with Node.js'}
            ]
        });

        if (!template) return null;

        return {template: template.value} as Selection;
    });

    if (!selection) return null;

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
            let isUsingMenu = false;

            if (!argv.template) {
                isUsingMenu = true;
                selection = await doShowMenu();
            } else {
                selection = {
                    template: argv.template
                }
            }

            if (selection) {
                selection.installDir = path.resolve(argv.dir) || process.cwd();
                await installTemplate(selection);

                process.stdout.write(term.color.green('✓ Installation done') + '\n');
                process.stdout.write(`Template: ${term.color.cyan(selection.template)}\n`);

                if (isUsingMenu) {
                    let dir = argv.dir || ".";
                    process.stdout.write('\n');
                    process.stdout.write(`You can directly invoke: jopi create ${selection.template} --dir ${dir}\n`);
                }
            }
        })
        .demandCommand(1, 'You must specify a valid command.')
        .version("1.0").strict().help().parse();
}

startUp().then();
