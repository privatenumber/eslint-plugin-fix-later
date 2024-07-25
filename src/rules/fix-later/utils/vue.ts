import type { AST } from 'vue-eslint-parser';

const safeRequire = <Type>(id: string) => {
	try {
		// eslint-disable-next-line import-x/no-dynamic-require, @typescript-eslint/no-var-requires
		return require(id) as Type;
	} catch {
		return null;
	}
};

const disallowedTypes = new Set(['VAttribute', 'VIdentifier', 'VExpressionContainer', 'VDirectiveKey', 'VText']);

/**
 * Re-implementation of getNodeByRangeIndex
 * https://github.com/eslint/eslint/blob/ab0ff2755d6950d7e7fb92944771c1c30f933e02/lib/languages/js/source-code/source-code.js#L707
 */
export const getVueElement = (
	index: number,
	rootNode: AST.Node,
): AST.Node | undefined => {
	const vueEslintParser = safeRequire<typeof import('vue-eslint-parser')>('vue-eslint-parser');
	if (!vueEslintParser) {
		return;
	}

	let result: AST.Node | undefined;
	let broken = false;
	vueEslintParser.AST.traverseNodes(rootNode, {
		enterNode: (node) => {
			if (broken) {
				return;
			}

			if (
				!disallowedTypes.has(node.type)
				&& node.range[0] <= index
				&& index < node.range[1]
			) {
				result = node;
			}
		},
		leaveNode: (node) => {
			if (!broken && node === result) {
				broken = true;
			}
		},
	});

	return result;
};
