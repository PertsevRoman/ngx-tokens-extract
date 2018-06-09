import * as ts from 'typescript';
import {ParameterDeclaration} from 'typescript';
import * as fs from 'fs';
import {getFilesList} from "./common";

const delint = (filesSrcs: string[]): string[] => {
    let res: string[] = [];

    /**
     *
     * @param {ts.Node} node
     * @param {ts.SyntaxKind} kind
     * @return {ts.Node[]}
     */
    const findNodes = (node: ts.Node, kind: ts.SyntaxKind): ts.Node[] => {
        const childrenNodes: ts.Node[] = node.getChildren();
        const initialValue: ts.Node[] = node.kind === kind ? [node] : [];

        return childrenNodes.reduce((result: ts.Node[], childNode: ts.Node) => {
            return result.concat(findNodes(childNode, kind));
        }, initialValue);
    };

    /**
     *
     * @param {ts.Node} node
     * @return {ts.Node | null}
     */
    const findConstructorNode = (node: ts.Node): ts.Node | null => {
        let constructorNode = findNodes(node, ts.SyntaxKind.Constructor);
        return constructorNode.length ? constructorNode[0] : null;
    };

    /**
     *
     * @param {ts.Node} node
     * @return {ts.Node[] | null}
     */
    const findClassNodes = (node: ts.Node): ts.Node[] | null => {
        let classNodes = findNodes(node, ts.SyntaxKind.ClassDeclaration);
        return classNodes.length ? classNodes : null;
    };

    /**
     *
     * @param {ts.Node} node
     * @param {string} serviceName
     * @return {ts.CallExpression[]}
     */
    const getTranslateServiceCalls = (node: ts.Node, serviceName: string): ts.CallExpression[] => {
        let callNodes = findNodes(node, ts.SyntaxKind.CallExpression) as ts.CallExpression[];
        return callNodes.filter(callNode => {
            if (callNode.arguments.length < 1) {
                return false;
            }

            const propAccess = callNode.getChildAt(0).getChildAt(0) as ts.PropertyAccessExpression;
            if (!propAccess || propAccess.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                return false;
            }

            if (!propAccess.getFirstToken() || propAccess.getFirstToken().kind !== ts.SyntaxKind.ThisKeyword) {
                return false;
            }

            if (propAccess.name.text !== serviceName) {
                return false;
            }

            const methodAccess = callNode.getChildAt(0) as ts.PropertyAccessExpression;
            if (!methodAccess || methodAccess.kind !== ts.SyntaxKind.PropertyAccessExpression) {
                return false;
            }

            return !(!methodAccess.name ||
                (methodAccess.name.text !== 'get' &&
                    methodAccess.name.text !== 'instant' &&
                    methodAccess.name.text !== 'stream'));
        });
    };

    /**
     *
     * @param {ts.CallExpression} callNode
     * @return {string[] | null}
     */
    const getTranslateCallParams = (callNode: ts.CallExpression): string[] | null => {
        if (!callNode.arguments.length) {
            return;
        }

        const firstArg = callNode.arguments[0];

        switch (firstArg.kind) {
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.FirstTemplateToken:
                return [(firstArg as ts.StringLiteral).text];
            case ts.SyntaxKind.ArrayLiteralExpression:
                return (firstArg as ts.ArrayLiteralExpression).elements
                    .filter((element: ts.Node) => element.kind === ts.SyntaxKind.StringLiteral)
                    .map((element: ts.StringLiteral) => element.text);
            case ts.SyntaxKind.Identifier:
                console.warn('WARNING: We cannot extract variable values passed to TranslateService (yet)');
                break;
            default:
                console.warn(`SKIP: Unknown argument type: `, firstArg.getFullText());
        }

        return null;
    };

    /**
     *
     * @param {ts.ConstructorDeclaration} constructorNode
     * @return {string | null}
     */
    const findTranslateServiceArg = (constructorNode: ts.ConstructorDeclaration): string | null => {
        let translateServiceParameter: ParameterDeclaration | undefined = constructorNode.parameters.find(parameter => {
            if (!parameter.modifiers) {
                return false;
            }

            if (!parameter.type) {
                return false;
            }

            const parameterType: ts.Identifier = (parameter.type as ts.TypeReferenceNode).typeName as ts.Identifier;
            if (!parameterType) {
                return false;
            }
            const className: string = parameterType.text;

            return className === 'TranslateService';
        });

        if (translateServiceParameter === undefined) {
            return null;
        }

        return (translateServiceParameter.name as ts.Identifier).text;
    };

    /**
     *
     * @param {string} sourcePath
     */
    const findClassLangServiceCalls = (sourcePath: string) => {
        const srcContent = fs.readFileSync(sourcePath).toString();
        const fileNode: ts.SourceFile = ts.createSourceFile(sourcePath, srcContent, ts.ScriptTarget.ES2015, true);

        const classNodes = findClassNodes(fileNode);
        if (!classNodes) return;

        for (let classNode of classNodes) {
            const constructorNode = findConstructorNode(classNode);
            if (!constructorNode) continue;

            const serviceName: string = findTranslateServiceArg(constructorNode as ts.ConstructorDeclaration);
            if (typeof serviceName !== "string") continue;

            let translateCalls = getTranslateServiceCalls(classNode, serviceName);
            if (!translateCalls.length) continue;

            for(let translateCall of translateCalls) {
                let translateArgs: string[] = getTranslateCallParams(translateCall);
                if (translateArgs && translateArgs.length) {
                    res.push(...translateArgs);
                }
            }
        }
    };

    function findTypeReferences(fileNode: ts.SourceFile): ts.TypeReferenceNode[] {
        return findNodes(fileNode, ts.SyntaxKind.TypeReference) as ts.TypeReferenceNode[];
    }

    /**
     *
     * @param {string} sourcePath
     */
    const findRouteInits = (sourcePath: string) => {
        const srcContent = fs.readFileSync(sourcePath).toString();
        const fileNode: ts.SourceFile = ts.createSourceFile(sourcePath, srcContent, ts.ScriptTarget.ES2015, true);

        const varDeclLists = findTypeReferences(fileNode);
        varDeclLists.forEach((typeRef: ts.TypeReferenceNode) => {
            const isRouteRef = typeRef.getText() == `Routes`;

            if (!isRouteRef) return;

            const varDeclNodes = typeRef.parent.getChildren(fileNode);
            const routesArrayLiteral = varDeclNodes[varDeclNodes.length - 1];
            if (routesArrayLiteral.kind == ts.SyntaxKind.ArrayLiteralExpression) {
                (routesArrayLiteral as ts.ArrayLiteralExpression)
                    .elements.forEach((obj: ts.ObjectLiteralExpression) => {
                    obj.properties.forEach((routeProp: ts.PropertyAssignment) => {
                        if (routeProp.name.getText() == `data`) {
                            const dataEntry = routeProp.getChildren(fileNode);
                            if (dataEntry[2].kind == ts.SyntaxKind.ObjectLiteralExpression) {
                                (dataEntry[2] as ts.ObjectLiteralExpression)
                                    .properties.forEach((dataProp: ts.PropertyAssignment) => {
                                    if (dataProp.name.getText() == 'breadcrumb') {
                                        const breadcrumbAssignment = dataProp.getChildren(fileNode);
                                        if (breadcrumbAssignment[2].kind == ts.SyntaxKind.StringLiteral) {
                                            res.push((breadcrumbAssignment[2] as ts.StringLiteral).text);
                                        }
                                    }
                                });
                            }
                        }
                    });
                });
            }
        });
    };

    for (const sourcePath of filesSrcs) {
        findClassLangServiceCalls(sourcePath);
        findRouteInits(sourcePath);
    }

    return res;
};

export const tsFilesParse = (files: string[] | string): string[] => {
    return delint(getFilesList(files));
};
