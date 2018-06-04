import * as parse5 from 'parse5';
import * as fs from 'fs';

import {getFilesList} from "./common";

const delint = (filesList: string[]): string[] => {
    let res: string[] = [];

    const findDocumentBody = (document) => {
        return document.childNodes[0].childNodes[1];
    };

    const clearTextValue = (text: string) : string[] => {
        let res = [];

        const regex = /\'([A-Z0-9\_]+\.)*[A-Z0-9\_]+\'\s*\|\s*translate/gm;

        let regexResult: any;
        let counter = 0;
        while ((regexResult = regex.exec(text)) !== null) {
            counter++;
            let fullMatch = regexResult[0];
            fullMatch = fullMatch.replace(`translate`, ``);
            fullMatch = fullMatch.replace(/\}|\{|\||\'|\s*/g, ``);

            res.push(fullMatch);
        }

        return res;
    };

    const walkNode = (node) => {
        if (node.nodeName === `#text`) {
            if (node.value.indexOf('translate') > -1) {
                const message = clearTextValue(node.value);
                res.push(...message);
            }
        } else {
            if (node.attrs) {
                node.attrs.forEach(({name, value}) => {
                    if (value.indexOf('translate') > -1) {
                        const message = clearTextValue(value);
                        res.push(...message);
                    }
                });
            }

            if (node.childNodes) {
                node.childNodes.forEach(walkNode);
            }
        }
    };

    for (let filePath of filesList) {
        const fileContent = fs.readFileSync(filePath).toString();
        const document = parse5.parse(fileContent);

        try {
            const body = findDocumentBody(document);

            walkNode(body);
        } catch (e) {
        }
    }

    return res;
};

export const htmlFilesParse = (files: string | string[]): string[] => {
    return delint(getFilesList(files));
};
