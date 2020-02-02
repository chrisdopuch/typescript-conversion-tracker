#!/usr/bin/env node

import { readdir, lstat, Stats, access } from 'fs';
import { extname, join } from 'path';
import { promisify, inspect } from 'util';

const lstatPromised = promisify(lstat);
const readdirPromised = promisify(readdir);

type FileTree = {
    percent: number, // percentage of files in TS, or null if there were no target files
    files: {
        [name: string]: boolean // value is whether or not it's TypeScript
    }
    directories: {
        [name: string]: FileTree,
    }
};

const tree = generateFileTree(process.cwd()).then((tree) => console.log(inspect(tree, { showHidden: false, depth: null })));

function generateFileTree(location: string): Promise<FileTree> {
    return new Promise(async (resolve, reject) => {
        const entries = await readdirPromised(location);
        const stats = await Promise.all(entries.map(e => lstatPromised(join(location, e))));
        const statsByEntry = entries.reduce((acc: { [key: string]: Stats }, path, i) => {
            acc[path] = stats[i];
            return acc;
        }, {});
        const files = Object.keys(statsByEntry).filter((s) => statsByEntry[s].isFile() && ['js', 'jsx', 'ts', 'tsx'].includes(extname(s).slice(1)));
        const directories = Object.keys(statsByEntry).filter((s) => statsByEntry[s].isDirectory() && !['node_modules', '.git'].includes(s));
        const percent = files.filter(f => ['ts', 'tsx'].includes(extname(f).slice(1))).length / files.length;
        return resolve({
            percent,
            files: files.reduce((acc: { [key: string]: boolean }, path) => {
                acc[path] = ['ts', 'tsx'].includes(extname(path).slice(1));
                return acc;
            }, {}),
            directories: await Promise.all(directories.map(d => generateFileTree(join(location, d))))
                .then((fts) => fts.reduce((acc: { [key: string]: FileTree }, value, i) => {
                    acc[directories[i]] = value;
                    return acc;
                }, {}))
        });
    });
}

