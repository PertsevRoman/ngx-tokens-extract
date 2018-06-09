import * as parse5 from 'parse5';
import * as fs from 'fs';

import {getFilesList} from './common';

const delint = (filesList: string[]): string[] => {
    let res: string[] = [];

    /**
     *
     * @param node
     * @param tag
     * @return {any}
     */
    const findTag = (node, tag): any => {
        for (let subnode of node.childNodes) {
            if (subnode.tagName === tag) {
                return subnode;
            }
        }

        return null;
    };

    /**
     *
     * @param document
     * @return {any}
     */
    const findDocumentHtml = (document) => {
        return findTag(document, `html`);
    };

    /**
     *
     * @param document
     */
    const findDocumentBody = (document) => {
        const htmlNode = findDocumentHtml(document);
        return findTag(htmlNode, `body`);
    };

    /**
     *
     * @param {string} text
     * @return {string[]}
     */
    const clearTextValue = (text: string) : string[] => {
        let res = [];

        const regex = /(\'([A-Z0-9\_]+\.)*[A-Z0-9\_]+\'|\"([A-Z0-9\_]+\.)*[A-Z0-9\_]+\")\s*\|\s*translate/gm;

        let regexResult: any;
        let counter = 0;
        while ((regexResult = regex.exec(text)) !== null) {
            counter++;
            let fullMatch = regexResult[0];
            fullMatch = fullMatch.replace(`translate`, ``);
            fullMatch = fullMatch.replace(/\}|\{|\||\'|\"|\s*/g, ``);

            res.push(fullMatch);
        }

        return res;
    };

    /**
     *
     * @param node
     */
    const walkNode = (node) => {
        if (node.value && node.value.indexOf('translate') > -1) {
            const messages = clearTextValue(node.value);
            res.push(...messages);
        }

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
    };

    for (let filePath of filesList) {
        const fileContent = fs.readFileSync(filePath).toString();
        const document = parse5.parse(fileContent);

        const getBody = () => {
            try {
                return findDocumentBody(document);
            } catch (e) {
                console.log(filePath);
                console.log(document);
                return null;
            }
        };

        const body = getBody();
        if (body) walkNode(body);
    }

    return res;
};

export const htmlFilesParse = (files: string | string[]): string[] => {
    return delint(getFilesList(files));
};
