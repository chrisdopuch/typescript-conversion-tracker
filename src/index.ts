#!/usr/bin/env node

import { promisify } from 'util';
import { writeFile as _writefile, mkdir as _mkdir, exists as _exists } from 'fs';
import { join } from 'path';

import generateFileTree, { FileTree, calculateCoverage } from './generateFileTree';

const writeFile = promisify(_writefile);
// const exists = promisify(_exists);
const mkdir = promisify(_mkdir);

generateFileTree(process.cwd()).then(async (tree) => {
    calculateCoverage(tree);
    console.log('Filetree generated, writing HTML');
    await buildHtml(tree, 'report');
});

async function buildHtml(tree: FileTree, outDir: string): Promise<any> {
    const outDirTrimmed = outDir.replace('report', '');
    const rows = [
        // todo: need to calculate the percent coverage for a dir, probably bottom-up
        ...Object.keys(tree.directories).map(d => `<tr><td><a href="${join(outDirTrimmed, d)}">${d}</a></td><td>${tree.directories[d].coverage}</td></tr>`),
        ...Object.keys(tree.files).map(f => `<tr><td>${f}</td><td>${tree.files[f]}</td></tr>`),
    ];
    const html = `
    <html>
        <head>
        </head>
        <body>
            <table>
                <tr>
                    <th>Name</th>
                    <th>Conversion Status</th>
                </tr>
                ${rows}
            </table>
        </body>
    </html>`;
    // const shouldCreateDirectory = await !exists(outDir);
    // if (shouldCreateDirectory) {
        await mkdir(outDir);
    // }
    await writeFile(join(outDir, 'index.html'), html, {});
    return await Promise.all(Object.keys(tree.directories).map(d => buildHtml(tree.directories[d], join(outDir, d))));
}
