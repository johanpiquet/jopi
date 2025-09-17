/*
  Interactive template selector
  - Arrow-key/vi-key navigation (↑/↓ or k/j)
  - Enter to validate
  - Numbers to jump directly
  - q or ESC to quit
*/

import readline from 'node:readline'

/**
 * Terminal helpers
 */
export const term = {
    clear: () => process.stdout.write("\x1b[2J\x1b[0;0H"),
    hideCursor: () => process.stdout.write("\x1b[?25l"),
    showCursor: () => process.stdout.write("\x1b[?25h"),

    color: {
        dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
        gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
        cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
        green: (s: string) => `\x1b[32m${s}\x1b[0m`,
        yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
        inverse: (s: string) => `\x1b[7m${s}\x1b[0m`,
        bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
    }
};

/**
 * Structure of a choice, for a Parameter.
 */
export type Choice<T = string> = {
    label: string
    value: T
    hint?: string
    disabled?: boolean
};

/**
 * Structure for a parameter for which we need to make a choice.
 */
export type Parameter = {
    title?: string;
    choices: Choice[];
    initialIndex?: number;
};

/**
 * Render a list of choices.
 */
function renderChoices(choices: Choice[], index: number): string {
    const lines: string[] = [];

    for (let i = 0; i < choices.length; i++) {
        const c = choices[i];
        const num = term.color.gray(String(i + 1).padStart(2, ' '));

        if (c.disabled) {
            lines.push(`  ${num}  ${term.color.dim(c.label)} ${c.hint ? term.color.gray(`(${c.hint})`) : ''}`);
            continue;
        }

        if (i === index) {
            lines.push(`› ${num}  ${term.color.inverse(c.label)} ${c.hint ? term.color.gray(`(${c.hint})`) : ''}`);
        } else {
            lines.push(`  ${num}  ${c.label} ${c.hint ? term.color.gray(`(${c.hint})`) : ''}`);
        }
    }

    return lines.join('\n');
}

export async function ask<T = string>(opts: Parameter): Promise<Choice<T>> {
    const { title, choices } = opts;
    let index = Math.min(Math.max(opts.initialIndex ?? 0, 0), choices.length - 1);

    const nextEnabled = (start: number, dir: 1 | -1): number => {
        let i = start;

        for (let steps = 0; steps < choices.length; steps++) {
            if (!choices[i]?.disabled) return i;
            i = (i + dir + choices.length) % choices.length;
        }

        return start;
    }

    index = nextEnabled(index, 1);

    term.hideCursor();
    term.clear();

    const onExit = () => {
        term.showCursor();
        process.stdout.write('\n');
    }

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.removeListener('SIGINT', onSigint);
            onExit();
        }

        const render = () => {
            term.clear();

            if (title) {
                process.stdout.write(term.color.bold(title) + '\n');
                process.stdout.write(term.color.gray('Use ↑/↓, Enter to validate, q to quite') + '\n\n');
            }

            process.stdout.write(renderChoices(choices, index));
        }

        const onSigint = () => {
            cleanup();
            reject(new Error('Canceled'));
        }

        const onData = (buf: any) => {
            const s = buf.toString('utf8');

            // ESC or q
            if (s === '\u0003' /* Ctrl-C */ || s === 'q' || s === 'Q' || s === '\u001b') {
                cleanup();
                reject(new Error('Canceled'));

                return;
            }

            // Enter
            if (s === '\r' || s === '\n') {
                const picked = choices[index];
                if (picked?.disabled) return;
                cleanup();
                resolve(picked as Choice<T>);

                return;
            }

            // Up / Down arrows
            if (s === '\u001b[A' || s === 'k') {
                let i = index;

                do { i = (i - 1 + choices.length) % choices.length; }
                while (choices[i]?.disabled && i !== index);

                index = i;
                render();

                return;
            }

            if (s === '\u001b[B' || s === 'j') {
                // down
                let i = index;

                do { i = (i + 1) % choices.length; }
                while (choices[i]?.disabled && i !== index);

                index = i;
                render();

                return;
            }

            // number shortcuts 1..9
            const m = s.match(/^[1-9]$/);

            if (m) {
                const i = parseInt(m[0], 10) - 1;

                if (choices[i] && !choices[i].disabled) {
                    index = i;
                    render();
                }

                return;
            }
        }

        process.stdin.setRawMode?.(true);
        process.stdin.resume();
        process.stdin.on('data', onData);
        process.on('SIGINT', onSigint);

        render();
    })
}

export async function useTerm<T>(fn: () => Promise<T|null>): Promise<T|null> {
    // Ensure proper TTY config even if readline was used elsewhere
    readline.emitKeypressEvents(process.stdin);

    try {
        return await fn();
    }
    finally {
        term.clear();
        term.showCursor();
    }
}