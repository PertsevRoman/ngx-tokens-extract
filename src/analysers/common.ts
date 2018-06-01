export const getFilesList = (list: string[] | string): string[] => {
    if (typeof list === "string") {
        return [ list ];
    }

    return list;
};
