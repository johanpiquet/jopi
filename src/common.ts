export const term = {
    color: {
        dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
        gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
        cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
        green: (s: string) => `\x1b[32m${s}\x1b[0m`,
        yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,

        red: (s: string) => `\x1b[31m${s}\x1b[0m`,

        magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
        blue: (s: string) => `\x1b[34m${s}\x1b[0m`,

        inverse: (s: string) => `\x1b[7m${s}\x1b[0m`,
        bold: (s: string) => `\x1b[1m${s}\x1b[0m`,

        underline: (s: string) => `\x1b[4m${s}\x1b[0m`,
    }
};