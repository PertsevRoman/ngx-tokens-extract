import * as walk from 'walk';
import {tsFilesParse} from "./analysers/ts-analyser";
import {htmlFilesParse} from "./analysers/html-analyser";
import * as fs from 'fs';

const srcPath = `D:\\Users\\RAPertsev\\IdeaProjects\\vendor-ui\\src`;
const i18Path = `D:\\Users\\RAPertsev\\IdeaProjects\\vendor-ui\\src\\assets\\i18n`;

interface FileDescriptor {
    name: string;
    root?: string;
    content?: string;
}


(() => {
    const srcWalker = walk.walk(srcPath);

    const replacer = (key, value) =>
        value instanceof Object && !(value instanceof Array) ?
            Object.keys(value)
                .sort()
                .reduce((sorted, key) => {
                    sorted[key] = value[key];
                    return sorted
                }, {}) :
            value;

    let tsFiles: string[] = [];
    let htmlFiles: string[] = [];

    /**
     *
     * @param shadowTree
     * @param sourceTree
     * @param fileName
     */
    let stack = [];
    const fillShadowBranches = (shadowTree: any, sourceTree: any, fileName: string) => {
        for(let shadowKey in shadowTree) {
            stack.push(shadowKey);

            if(sourceTree[shadowKey]) {
                if(typeof sourceTree[shadowKey] === 'object') {
                    fillShadowBranches(shadowTree[shadowKey], sourceTree[shadowKey], fileName);
                } else if(typeof sourceTree[shadowKey] === 'string') {
                    shadowTree[shadowKey] = sourceTree[shadowKey];
                }
            } else {
                if(!shadowTree[shadowKey]) {
                    console.log(`WARNING: ${fileName}: translate path '${
                        stack.join('.')}' is empty, please give value to that`);
                }
            }

            stack.pop();
        }
    };

    /**
     *
     * @param {string[][]} branches
     * @return {{}}
     */
    const makeTranslatorTree = (branches: string[][]) => {
        let shadowTranslateTree = {};
        branches.forEach(branch => {
            let mirror = shadowTranslateTree;
            while (branch.length > 1) {
                let key = branch.shift();

                if(!mirror[key]) {
                    mirror[key] = {};
                }

                mirror = mirror[key];
            }

            mirror[branch[0]] = '';
        });

        return shadowTranslateTree;
    };

    srcWalker.on('file', (root, fileStats, next) => {
        if (fileStats.name.endsWith(`.ts`) && !fileStats.name.endsWith(`.d.ts`)) {
            const fileFullPath = `${root}\\${fileStats.name}`;
            tsFiles.push(fileFullPath);
        }

        if (fileStats.name.endsWith(`.html`)) {
            const fileFullPath = `${root}\\${fileStats.name}`;
            htmlFiles.push(fileFullPath);
        }

        next();
    });

    srcWalker.on('end', () => {
        const entries = [
            ...tsFilesParse(tsFiles),
            ...htmlFilesParse(htmlFiles),
        ];

        let branches: string[][] = entries.map(token => token.split(`.`));

        let shadowTranslateTree: any = makeTranslatorTree(branches);

        const i18Walker = walk.walk(i18Path);
        const i18Files: FileDescriptor[] = [];
        i18Walker.on(`file`, (root, fileStats, next) => {
            if (fileStats.name.endsWith('.json') &&
                !fileStats.name.endsWith('-static.json')) {
                const fileFullPath = `${root}\\${fileStats.name}`;
                const content = JSON.parse(fs.readFileSync(fileFullPath, {
                    encoding: 'utf8'
                }).toString());

                i18Files.push({
                    root,
                    name: fileStats.name,
                    content
                });
            }

            next();
        });

        i18Walker.on(`end`, () => {
            i18Files.forEach((i18File: FileDescriptor) => {
                const shadowTreeCopy = Object.assign({}, shadowTranslateTree);

                fillShadowBranches(shadowTreeCopy, i18File.content, i18File.name);

                const translatePath = `${i18File.root}/${i18File.name}`;
                const dumpContent = JSON.stringify(shadowTreeCopy, replacer, 2);

                fs.writeFileSync(translatePath, dumpContent, 'utf8');
            });
        });
    });
})();
