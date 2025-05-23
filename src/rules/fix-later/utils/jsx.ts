import type { Node } from 'estree';

export function getEnclosingJSX(node?: Node | null): Node | null {
  let currentNode = node as any;
  while (currentNode) {
    if (currentNode.type === 'JSXElement' || currentNode.type === 'JSXFragment') {
      return currentNode;
    }
    currentNode = currentNode.parent;
  }
  return null;
}
