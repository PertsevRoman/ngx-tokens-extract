import * as walk from 'walk';
import {tsFilesParse} from "./analysers/ts-analyser";

const srcPath = `D:\\Users\\RAPertsev\\IdeaProjects\\vendor-ui\\src`;
(() => {
    const walker = walk.walk(srcPath);

    let tsFiles: string[] = [];
    let htmlFiles: string[] = [];

    walker.on('file', (root, fileStats, next) => {
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


    walker.on('end', () => {
        const tokens: string[] = tsFilesParse(tsFiles);

        console.log(tokens);
    });
})();
