
const safeRequire = (id: string) => {
	try {
		return require(id);
	} catch {
		return null;
	}
};

export const getVueElement = (
	index,
	rootNode,
) => {
	const vueEslintParser = safeRequire('vue-eslint-parser');
	if (!vueEslintParser) {
		return;
	}

	let result = null;
	let broken = false;
	const disallowedTypes = ['VAttribute', 'VIdentifier', 'VExpressionContainer', 'VDirectiveKey', 'VText'];
	vueEslintParser.AST.traverseNodes(rootNode, {
		enterNode(node) {
			if (broken) {
				return;
			}

			if (
				!disallowedTypes.includes(node.type)
				&& node.range[0] <= index
				&& index < node.range[1]
			) {
				result = node;
			}
		},
		leaveNode(node) {
			if (!broken && node === result) {
				broken = true;
			}
		}
	});

	return result;
};
