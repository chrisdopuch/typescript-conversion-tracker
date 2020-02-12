import { readdir as _readdir, lstat as _lstat, Stats } from 'fs';
import { extname, join } from 'path';
import { promisify } from 'util';

const lstat = promisify(_lstat);
const readdir = promisify(_readdir);
const jsFileEndings = ['js', 'jsx'];
const tsFileEndings = ['ts', 'tsx'];
const targetFileEndings = [...jsFileEndings, ...tsFileEndings];
const ignoreDirectories = ['node_modules', '.git', 'build'];

export type FileTree = {
    files: {
        [name: string]: boolean // value is whether or not it's TypeScript
    }
    directories: {
        [name: string]: FileTree,
    }
    coverage?: number,
};

type Acc<T> = {
    [key: string]: T,
};

// trims the "." from extname
function getFileExtension(f: string) {
    return extname(f).slice(1);
}

function generateFileTree(location: string): Promise<FileTree> {
    console.log('Generate file tree location: ', location);
    return new Promise(async (resolve, reject) => {
        try {
            // get all the entries in the current directory
            const entries = await readdir(location);
            // get the `lstat` stats for each entry for metadata
            const stats = await Promise.all(entries.map(e => lstat(join(location, e))));
            // map the Stats to each filepath
            const statsByEntry = entries.reduce((acc: Acc<Stats>, path, i) => ({ ...acc, [path]: stats[i] }), {});
            // build the mapping of files to booleans (which is whether or not it's typescript)
            const files = Object
                .keys(statsByEntry)
                .filter(s => statsByEntry[s].isFile() && targetFileEndings.includes(getFileExtension(s)))
                .reduce((acc: Acc<boolean>, path) => ({
                    ...acc,
                    [path]: tsFileEndings.includes(getFileExtension(path))
                }), {});
            // get all the non-ignored directories
            const validDirectories = Object
                .keys(statsByEntry)
                .filter((s) => statsByEntry[s].isDirectory() && !ignoreDirectories.includes(s));
            // recurse for each directory asynchronously
            const directories = await Promise.all(validDirectories.map(d => generateFileTree(join(location, d))))
                .then((trees) => trees.reduce((acc: Acc<FileTree>, value, i) => {
                    acc[validDirectories[i]] = value;
                    return acc;
                }, {}))
            return resolve({ files, directories });
        } catch (err) {
            reject(err);
        }
    });
}

export function calculateCoverage(tree: FileTree) {
    const totalTSFiles = Object.keys(tree.files).map(f => tsFileEndings.includes(getFileExtension(f))).reduce((acc: number, val: boolean) => {
        if (val) {
            acc++
        }
        return acc;
    }, 0);
    const percentage = totalTSFiles / Object.keys(tree.files).length;
    if (Object.keys(tree.directories).length === 0) {
        tree.coverage = percentage;
        return { percentage, fileCount: Object.keys(tree.files).length };
    }
    const childCoverage = Object.keys(tree.directories).reduce((acc: {[key: string]: {percentage: number, fileCount: number}}, directory) => { 
        acc[directory] = calculateCoverage(tree.directories[directory]);
        return acc;
    }, {});
    const totalFileCount = Object.keys(childCoverage).reduce((acc, val) => {
        acc += childCoverage[val].fileCount;
        return acc;
    }, 0);
    const totalPercentage = Object.keys(childCoverage).reduce((acc, val) => {
        acc += childCoverage[val].fileCount * childCoverage[val].percentage;
        return acc;
    }, 0) / totalFileCount;
    tree.coverage = totalPercentage;
    return {percentage: totalPercentage, fileCount: totalFileCount};
}

export default generateFileTree;