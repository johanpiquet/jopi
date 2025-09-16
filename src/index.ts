import {select, term, useTerm} from "./cliMenu.js";

export type TemplateKind = 'nextjs' | 'express' | 'react-ssr' | 'empty';

export type SubChoices = {
  language: 'ts' | 'js';
  pkgManager: 'bun' | 'npm' | 'pnpm' | 'yarn';
}

export type Selection = {
  template: TemplateKind;
  options: SubChoices;
}

async function main(): Promise<Selection | null> {
  let selection = await useTerm<Selection>(async () => {
    const template = await select<TemplateKind>({
      title: 'Quel template souhaitez-vous créer ?',
      choices: [
        {label: 'Next.js (App Router)', value: 'nextjs', hint: 'React, App Router'},
        {label: 'Express API', value: 'express', hint: 'REST API de base'},
        {label: 'React SSR (Jopi Rewrite)', value: 'react-ssr', hint: 'SSR + Hydrate'},
        {label: 'Projet vide', value: 'empty', hint: 'Minimal'}
      ]
    });

    if (!template) return null;

    const language = await select<SubChoices['language']>({
      title: 'Choisissez la langue',
      choices: [
        {label: 'TypeScript', value: 'ts'},
        {label: 'JavaScript', value: 'js'},
      ]
    });

    if (!language) return null;

    const pkgManager = await select<SubChoices['pkgManager']>({
      title: 'Gestionnaire de paquets',
      choices: [
        {label: 'bun', value: 'bun', hint: 'Rapide'},
        {label: 'npm', value: 'npm'},
        {label: 'pnpm', value: 'pnpm'},
        {label: 'yarn', value: 'yarn'},
      ],
    });

    if (!pkgManager) return null;

    return {
      template: template.value,
      options: {
        language: language.value,
        pkgManager: pkgManager.value
      }
    };
  });

  if (!selection) return null;

  process.stdout.write('\n');
  process.stdout.write(term.color.green('✓ Sélection enregistrée') + '\n');
  process.stdout.write(`Template: ${term.color.cyan(selection.template)}\n`);
  process.stdout.write(`Langage: ${term.color.cyan(selection.options.language)}\n`);
  process.stdout.write(`Package manager: ${term.color.cyan(selection.options.pkgManager)}\n`);
  process.stdout.write('\n');

  return selection;
}


main().catch((err) => {
  term.showCursor();

  if (err && (err as Error).message !== 'Annulé') {
    console.error(err);
    process.exitCode = 1;
  }
});
