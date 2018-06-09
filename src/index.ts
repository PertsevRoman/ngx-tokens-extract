import * as walk from 'walk';
import * as path from 'path';
import {tsFilesParse} from "./analysers/ts-analyser";
import {htmlFilesParse} from "./analysers/html-analyser";
import * as rx from 'rxjs';

import {filter, map, reduce} from 'rxjs/operators';
import {forkJoin, Observable} from "rxjs/index";
import * as fs from 'fs';

interface FileDescriptor {
    name: string;
    root?: string;
    content?: string;
}

/**
 *
 * @param {string} src
 * @return {Observable<FileDescriptor>}
 */
const makeFilesStream = (src: string): rx.Observable<FileDescriptor> => {
    return rx.Observable.create(observer => {
        const srcWalker = walk.walk(src);
        srcWalker.on(`file`, (root, fileStats, next) => {
            const fd: FileDescriptor = {
                name: fileStats.name,
                root
            };

            observer.next(fd);

            next();
        });

        srcWalker.on(`end`, () => {
            observer.complete();
        });
    });
};

(() => {
    const srcPath = path.resolve(process.argv[process.argv.length - 1]);

    if (!srcPath && !fs.existsSync(srcPath) && !fs.lstatSync(srcPath).isDirectory()) {
        return console.error(`Can't find src path argument or it's not directory: ${srcPath}`);
    }

    console.log(`src path: ${srcPath}, argv: ${process.argv}`);

    /**
     *
     * @type {Observable<FileDescriptor>}
     */
    const pathsObservable = makeFilesStream(srcPath);

    const replacer = (key, value) =>
    value instanceof Object && !(value instanceof Array) ?
        Object.keys(value)
            .sort()
            .reduce((sorted, key) => {
                sorted[key] = value[key];
                return sorted
            }, {}) :
        value;

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

    /**
     *
     * @param {FileDescriptor[]} acc
     * @param {FileDescriptor} val
     * @return {FileDescriptor[]}
     */
    const fileDescriptorAccumulator = (acc: FileDescriptor[], val: FileDescriptor) => {
        acc.push(val);
        return acc;
    };

    /**
     *
     * @param {FileDescriptor[]} descriptors
     * @return {string[]}
     */
    const fileDescStringDump = (descriptors: FileDescriptor[]) => {
        return descriptors.map((descriptor: FileDescriptor) => {
            return `${descriptor.root}\\${descriptor.name}`;
        });
    };

    const i18Names = [`en`, `ru`, `cn`].map(val => `${val}.json`);
    pathsObservable
        .pipe(filter((fd: FileDescriptor) => i18Names.indexOf(fd.name) > -1))
        .pipe(reduce(fileDescriptorAccumulator, [] as FileDescriptor[]))
        .subscribe((i18nDescriptors: FileDescriptor[]) => {
            if (!i18nDescriptors.length) {
                console.warn(`i18File are not found, path ${srcPath}`);
                return;
            }

            const tsTokensObserver = pathsObservable
                .pipe(filter((fd: FileDescriptor) => fd.name.indexOf('.ts') > -1 &&
                    fd.name.indexOf('.d.ts') < 0 && fd.name.indexOf('.ts.orig') < 0))
                .pipe(reduce(fileDescriptorAccumulator, [] as FileDescriptor[]))
                .pipe(map(fileDescStringDump))
                .pipe(map(tsFilesParse));

            const htmlTokensObserver = pathsObservable
                .pipe(filter((fd: FileDescriptor) =>
                    fd.name.indexOf('.html') > -1 && fd.name.indexOf('.html.orig') < 0))
                .pipe(reduce(fileDescriptorAccumulator, [] as FileDescriptor[]))
                .pipe(map(fileDescStringDump))
                .pipe(map(htmlFilesParse));

            forkJoin([
                tsTokensObserver,
                htmlTokensObserver
            ]).subscribe(([tsTokens, htmlTokens]) => {
                let branches: string[][] = [
                    ...tsTokens,
                    ...htmlTokens
                ].map(token => token.split(`.`));

                let shadowTranslateTree: any = makeTranslatorTree(branches);

                i18nDescriptors.forEach((i18File: FileDescriptor) => {
                    const shadowTreeCopy = Object.assign({}, shadowTranslateTree);
                    const i18FileSrc = `${i18File.root}\\${i18File.name}`;

                    const content = JSON.parse(fs.readFileSync(i18FileSrc).toString());

                    fillShadowBranches(shadowTreeCopy, content, i18File.name);

                    const translatePath = `${i18File.root}/${i18File.name}`;
                    const dumpContent = JSON.stringify(shadowTreeCopy, replacer, 2);

                    console.log(`i18File write: ${i18FileSrc}, tokens count: ${branches.length}`);

                    fs.writeFileSync(translatePath, dumpContent, 'utf8');
                });
            });
        });
})();
