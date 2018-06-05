import * as walk from 'walk';
import {tsFilesParse} from "./analysers/ts-analyser";
import {htmlFilesParse} from "./analysers/html-analyser";
import * as rx from 'rxjs';

import {filter, map, reduce} from 'rxjs/operators';
import {Observable} from "rxjs/index";

const srcPath = `D:\\Users\\RAPertsev\\IdeaProjects\\vendor-ui\\src`;

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

// (() => {
//     const srcWalker = walk.walk(srcPath);
//
//     const replacer = (key, value) =>
//         value instanceof Object && !(value instanceof Array) ?
//             Object.keys(value)
//                 .sort()
//                 .reduce((sorted, key) => {
//                     sorted[key] = value[key];
//                     return sorted
//                 }, {}) :
//             value;
//
//     let tsFiles: string[] = [];
//     let htmlFiles: string[] = [];
//
//     /**
//      *
//      * @param shadowTree
//      * @param sourceTree
//      * @param fileName
//      */
//     let stack = [];
//     const fillShadowBranches = (shadowTree: any, sourceTree: any, fileName: string) => {
//         for(let shadowKey in shadowTree) {
//             stack.push(shadowKey);
//
//             if(sourceTree[shadowKey]) {
//                 if(typeof sourceTree[shadowKey] === 'object') {
//                     fillShadowBranches(shadowTree[shadowKey], sourceTree[shadowKey], fileName);
//                 } else if(typeof sourceTree[shadowKey] === 'string') {
//                     shadowTree[shadowKey] = sourceTree[shadowKey];
//                 }
//             } else {
//                 if(!shadowTree[shadowKey]) {
//                     console.log(`WARNING: ${fileName}: translate path '${
//                         stack.join('.')}' is empty, please give value to that`);
//                 }
//             }
//
//             stack.pop();
//         }
//     };
//
//     /**
//      *
//      * @param {string[][]} branches
//      * @return {{}}
//      */
//     const makeTranslatorTree = (branches: string[][]) => {
//         let shadowTranslateTree = {};
//         branches.forEach(branch => {
//             let mirror = shadowTranslateTree;
//             while (branch.length > 1) {
//                 let key = branch.shift();
//
//                 if(!mirror[key]) {
//                     mirror[key] = {};
//                 }
//
//                 mirror = mirror[key];
//             }
//
//             mirror[branch[0]] = '';
//         });
//
//         return shadowTranslateTree;
//     };
//
//     srcWalker.on('file', (root, fileStats, next) => {
//         if (fileStats.name.endsWith(`.ts`) && !fileStats.name.endsWith(`.d.ts`)) {
//             const fileFullPath = `${root}\\${fileStats.name}`;
//             tsFiles.push(fileFullPath);
//         }
//
//         if (fileStats.name.endsWith(`.html`)) {
//             const fileFullPath = `${root}\\${fileStats.name}`;
//             htmlFiles.push(fileFullPath);
//         }
//
//         next();
//     });
//
//     srcWalker.on('end', () => {
//         const entries = [
//             ...tsFilesParse(tsFiles),
//             ...htmlFilesParse(htmlFiles),
//         ];
//
//         let branches: string[][] = entries.map(token => token.split(`.`));
//
//         let shadowTranslateTree: any = makeTranslatorTree(branches);
//
//         const i18Walker = walk.walk(i18Path);
//         const i18Files: FileDescriptor[] = [];
//         i18Walker.on(`file`, (root, fileStats, next) => {
//             if (fileStats.name.endsWith('.json') &&
//                 !fileStats.name.endsWith('-static.json')) {
//                 const fileFullPath = `${root}\\${fileStats.name}`;
//                 const content = JSON.parse(fs.readFileSync(fileFullPath, {
//                     encoding: 'utf8'
//                 }).toString());
//
//                 i18Files.push({
//                     root,
//                     name: fileStats.name,
//                     content
//                 });
//             }
//
//             next();
//         });
//
//         i18Walker.on(`end`, () => {
//             i18Files.forEach((i18File: FileDescriptor) => {
//                 const shadowTreeCopy = Object.assign({}, shadowTranslateTree);
//
//                 fillShadowBranches(shadowTreeCopy, i18File.content, i18File.name);
//
//                 const translatePath = `${i18File.root}/${i18File.name}`;
//                 const dumpContent = JSON.stringify(shadowTreeCopy, replacer, 2);
//
//                 fs.writeFileSync(translatePath, dumpContent, 'utf8');
//             });
//         });
//     });
// })();

(() => {
    /**
     *
     * @type {Observable<FileDescriptor>}
     */
    const pathsObservable = makeFilesStream(srcPath);

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

    pathsObservable
        .pipe(filter((fd: FileDescriptor) =>
            fd.name.indexOf('.html') > -1 && fd.name.indexOf('.html.orig') < 0))
        .pipe(reduce(fileDescriptorAccumulator, [] as FileDescriptor[]))
        .pipe(map(fileDescStringDump))
        .pipe(map(htmlFilesParse))
        .subscribe((fd: string[]) => {
            console.log(fd);
        });

    pathsObservable
        .pipe(filter((fd: FileDescriptor) => fd.name.indexOf('.ts') > -1 &&
            fd.name.indexOf('.d.ts') < 0 && fd.name.indexOf('.ts.orig') < 0))
        .pipe(reduce(fileDescriptorAccumulator, [] as FileDescriptor[]))
        .pipe(map(fileDescStringDump))
        .pipe(map(tsFilesParse))
        .subscribe((fd: string[]) => {
            console.log(fd);
        });

    // const i18Names = [`en`, `ru`, `cn`].map(val => `${val}.json`);
    // pathsObservable
    //     .pipe(filter((fd: FileDescriptor) => i18Names.indexOf(fd.name) > -1))
    //     .pipe(reduce(fileDescriptorAccumulator, [] as FileDescriptor[]))
    //     .subscribe((fd: FileDescriptor[]) => {
    //         console.log(fd);
    //     });
})();
