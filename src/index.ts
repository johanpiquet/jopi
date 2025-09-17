import {select, term, useTerm} from "./cliMenu.js";
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {type Selection, type EngineKind, type TemplateKind, installTemplate} from "./templateEngine.ts";
import * as path from "node:path";

async function doShowMenu(): Promise<Selection | null> {
    let selection = await useTerm<Selection>(async () => {
        const template = await select<TemplateKind>({
            title: 'What template to install',
            choices: [
                {label: 'Minimal', value: 'minimal', hint: 'A template with minimal thing'},
                {label: 'API server', value: 'api-server', hint: 'A sample REST API with JWT auth'},
                {label: 'React SSR', value: 'react-ssr', hint: 'React SSR using API'},
                {label: 'Page router', value: 'page-router', hint: 'React SSR using page router'}
            ]
        });

        if (!template) return null;

        const engine = await select<EngineKind>({
            title: 'Engine to use',
            choices: [
                {label: 'Node.js', value: 'node'},
                {label: 'Bun.js', value: 'bun'}
            ]
        });

        if (!engine) return null;

        return {
            template: template.value,
            options: {engine: engine.value},
            installDir: process.cwd()
        } as Selection;
    });

    if (!selection) return null;

    process.stdout.write('\n');
    process.stdout.write(term.color.green('✓ Selected') + '\n');
    process.stdout.write(`Template: ${term.color.cyan(selection.template)}\n`);
    process.stdout.write(`Engine: ${term.color.cyan(selection.options.engine)}\n`);
    process.stdout.write('\n');
    process.stdout.write(`You can directorly invoke: jopi create ${selection.template} --engine ${selection.options.engine}\n`);

    return selection;
}

async function startUp() {
    yargs(hideBin(process.argv))
        .command("create <template>", "Create a new project from a template.", (yargs) => {
            return yargs
                .positional('template', {
                    type: 'string',
                    choices: ['minimal', 'api-server'],
                    describe: 'The name of the template to use.\nIf not provided, a menu will be shown.',
                    demandOption: false
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
                    template: argv.template as unknown as TemplateKind,
                    installDir: path.resolve(argv.dir),

                    options: {
                        engine: argv.engine as EngineKind
                    }
                }
            }

            if (selection) {
                await installTemplate(selection);
            }
        })
        .demandCommand(1, 'You must specify a valid command.')
        .version("1.0").strict().help().parse();
}

startUp().then();
