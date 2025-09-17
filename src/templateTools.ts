import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as path from "node:path";

/**
 * Uncompress a .zip file
 */
export async function unzipFile(zipFilePath: string, outputDir: string): Promise<void> {
    if (!fs.existsSync(zipFilePath)) {
        throw new Error(`File doesn't exist : ${zipFilePath}`);
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
    }

    // Décompresser le fichier
    await fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({path: outputDir}))
        .promise();
}

/**
 * Copy a directory recursively.
 */
export async function copyDirectory(srcDir: string, destDir: string): Promise<void> {
    if (!fs.existsSync(srcDir)) {
        throw new Error(`Directory doesn't exist : ${srcDir}`);
    }

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

    await Promise.all(entries.map(async (entry) => {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            return new Promise<void>((resolve, reject) => {
                const readStream = fs.createReadStream(srcPath);
                const writeStream = fs.createWriteStream(destPath);

                readStream.on('error', reject);
                writeStream.on('error', reject);
                writeStream.on('finish', resolve);

                readStream.pipe(writeStream);
            });
        }
    }));
}