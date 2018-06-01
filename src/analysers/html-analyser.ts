import {getFilesList} from "./common";

const delint = (filesList: string[]): string[] => {
};

export const htmlFilesParse = (files: string | string[]): string[] => {
    return delint(getFilesList(files));
};
