import {isNodeJS} from "jopi-toolkit/jk_what";
import * as jk_fs from "jopi-toolkit/jk_fs";
import * as jk_process from "jopi-toolkit/jk_process";
import path from "node:path";
import * as Process from 'node:process';
import process from "node:process";

if (isNodeJS) {
    let rootDir = process.cwd();
    let envFile = path.join(rootDir, ".env");

    if (jk_fs.isFileSync(envFile)) {
        Process.loadEnvFile(envFile);
    } else {
        // development or production
        let nodeEnv = jk_process.isProduction ? "production" : "development";
        envFile = path.join(rootDir, ".env." + nodeEnv);

        if (jk_fs.isFileSync(envFile)) {
            Process.loadEnvFile(envFile);
        } else {
            envFile = path.join(rootDir, ".env.local");

            if (jk_fs.isFileSync(envFile)) {
                Process.loadEnvFile(envFile);
            }
        }
    }
}