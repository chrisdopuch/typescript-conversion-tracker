#!/usr/bin/env node

import { inspect } from 'util';

import generateFileTree from './generateFileTree';

generateFileTree(process.cwd()).then((tree) => console.log(inspect(tree, { showHidden: false, depth: null })));
