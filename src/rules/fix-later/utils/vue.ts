import type VueEslintParser from 'vue-eslint-parser';
import type { AST } from 'vue-eslint-parser';

export type VueTemplateNode = AST.Node;

const safeRequire = <Type>(id: string) => {
	try {
		// eslint-disable-next-line import-x/no-dynamic-require, @typescript-eslint/no-require-imports
		return require(id) as Type;
	} catch {
		return null;
	}
};

const ignoreNodes = new Set([
	'VAttribute',
	'VIdentifier',
	'VExpressionContainer',
	'VDirectiveKey',
	'VText',
]);

/**
 * Find the deepest node containing a node index
 *
 * Re-implementation of getNodeByRangeIndex
 * https://github.com/eslint/eslint/blob/ab0ff2755d6950d7e7fb92944771c1c30f933e02/lib/languages/js/source-code/source-code.js#L707
 */
export const getVueElementNodeByRangeIndex = (
	index: number,
	rootNode: VueTemplateNode,
): VueTemplateNode | undefined => {
	const vueEslintParser = safeRequire<typeof VueEslintParser>('vue-eslint-parser');
	if (!vueEslintParser) {
		return;
	}

	let result: VueTemplateNode | undefined;
	let stopTraversal = false;
	vueEslintParser.AST.traverseNodes(rootNode, {
		enterNode: (node) => {
			if (stopTraversal || ignoreNodes.has(node.type)) {
				return;
			}

			if (node.range[0] <= index && index < node.range[1]) {
				result = node;
			}
		},
		leaveNode: (node) => {
			if (
				!stopTraversal
				&& node === result
			) {
				stopTraversal = true;
			}
		},
	});

	return result;
};
