import type { Linter, SourceCode } from 'eslint';
import type { InsertDisableComment } from '../rule-meta.js';
import {
	type LintMessage, type Directives, directives,
} from './eslint.js';
import {
	insertCommentAboveLine,
	insertCommentSameLine,
	type GetInsertText,
	type FixData,
} from './fixer.js';
import { getVueElementNodeByRangeIndex } from './vue.js';
import type { GetCommentDescription } from './comment-description.js';

type CommentSyntax = [open: string, close: string];
const commentSyntax = {
	jsInline: ['// ', ''],
	jsBlock: ['/* ', ' */'],
	vue: ['<!-- ', ' -->'],
	jsx: ['{/* ', ' */}'],
} satisfies Record<string, CommentSyntax>;

const getRuleIds = (
	lintMessages: LintMessage[],
) => {
	const ruleIds = new Set<string>();
	for (const message of lintMessages) {
		if (message.ruleId) {
			ruleIds.add(message.ruleId);
		}
	}
	return Array.from(ruleIds).join(', ');
};

type Fixer = {
	getInsertText: GetInsertText;
	messages: LintMessage[];
};

type FixMap = {
	syntax: CommentSyntax;
} & { [directive in Directives]?: Fixer; };

type Node<T> = {
	type: string;
	parent?: T;
};

const findNodeParent = <T extends Node<T>>(
	node: T,
	parentTypes: string[],
): T | false => {
	let current: T | undefined = node;
	while (current) {
		if (parentTypes.includes(current.type)) {
			return current;
		}
		current = current.parent;
	}
	return false;
};

export const getFixLaterMessages = (
	sourceCode: SourceCode,
	code: string,
	errorMessages: LintMessage[],
	disableDirective: InsertDisableComment,
	ruleSeverity: Linter.Severity,
	jsxEnabled: boolean | undefined,
	getCommentDescription: GetCommentDescription,
) => {
	const fixesMap = new Map<number, FixMap>();

	const insertFix = (
		message: LintMessage,
		syntax: CommentSyntax,
		directive: Directives,
		{ insertAt, getInsertText }: FixData,
	) => {
		let fixMap = fixesMap.get(insertAt);
		if (!fixMap) {
			fixMap = { syntax };
			fixesMap.set(insertAt, fixMap);
		}

		let got = fixMap[directive];
		if (!got) {
			got = {
				getInsertText,
				messages: [],
			};
			fixMap[directive] = got;
		}
		got.messages.push(message);
	};

	for (const message of errorMessages) {
		const index = sourceCode.getIndexFromLoc({
			line: message.line,
			column: message.column - 1,
		});

		const node = sourceCode.getNodeByRangeIndex(index);
		if (node) {
			if (jsxEnabled) {
				const jsxExpression = findNodeParent(node, ['JSXExpressionContainer']);
				if (jsxExpression) {
					const isMultiline = node.loc!.start.line !== jsxExpression.loc!.start.line;

					if (isMultiline) {
						const disableLine = sourceCode.getIndexFromLoc({
							line: node.loc!.start.line,
							column: 0,
						});
						const disableFix = insertCommentAboveLine(code, disableLine);
						disableFix.insertAt = Math.max(
							disableFix.insertAt,
							jsxExpression.range![0] + 1,
						);
						insertFix(message, commentSyntax.jsBlock, 'disable', disableFix);

						const enableLine = sourceCode.getIndexFromLoc({
							line: node.loc!.end.line + 1,
							column: 0,
						});
						const enableFix = insertCommentAboveLine(code, enableLine);
						enableFix.insertAt = Math.min(
							enableFix.insertAt,
							jsxExpression.range![1] - 1,
						);
						insertFix(message, commentSyntax.jsBlock, 'enable', enableFix);

						continue;
					} else {
						const [start, end] = jsxExpression.range!;
						insertFix(
							message,
							commentSyntax.jsBlock,
							'disable',
							{
								insertAt: start + 1,
								getInsertText: comment => comment,
							},
						);
						insertFix(
							message,
							commentSyntax.jsBlock,
							'enable',
							{
								insertAt: end - 1,
								getInsertText: comment => comment,
							},
						);
						continue;
					}

				}

				// type JSXElement = {
				// 	type: string;
				// 	openingElement: {
				// 		start: number;
				// 	};
				// 	closingElement: {
				// 		end: number;
				// 	};
				// };
				// const inJsx = findNodeParent(node as JSXElement, ['JSXElement', 'JSXFragment']);
				// if (inJsx) {
				// 	insertFix(
				// 		message,
				// 		commentSyntax.jsx,
				// 		'disable',
				// 		{
				// 			insertAt: inJsx.openingElement.start,
				// 			getInsertText: comment => comment,
				// 		},
				// 	);
				// 	insertFix(
				// 		message,
				// 		commentSyntax.jsx,
				// 		'enable',
				// 		{
				// 			insertAt: inJsx.closingElement.end,
				// 			getInsertText: comment => comment,
				// 		},
				// 	);
				// 	continue;
				// }
			}

			const lineStart = sourceCode.getIndexFromLoc({
				line: message.line,
				column: 0,
			});
			if (disableDirective === 'above-line') {
				insertFix(
					message,
					commentSyntax.jsInline,
					'disable-next-line',
					insertCommentAboveLine(code, lineStart),
				);
			} else {
				insertFix(
					message,
					commentSyntax.jsInline,
					'disable-line',
					insertCommentSameLine(code, lineStart),
				);
			}
			continue;
		}

		const vueFrag = sourceCode.parserServices.getDocumentFragment?.();
		const vueNode = getVueElementNodeByRangeIndex(index, vueFrag);

		if (vueNode) {
			const disableLine = sourceCode.getIndexFromLoc({
				line: vueNode.loc.start.line,
				column: 0,
			});
			const disableFix = insertCommentAboveLine(code, disableLine);
			insertFix(message, commentSyntax.vue, 'disable', disableFix);

			const enableLine = sourceCode.getIndexFromLoc({
				line: vueNode.loc.end.line + 1,
				column: 0,
			});
			const enableFix = insertCommentAboveLine(code, enableLine);
			insertFix(message, commentSyntax.vue, 'enable', enableFix);
		}
	}

	const fixLaterMessages: LintMessage[] = [];
	for (const [insertAt, fix] of fixesMap) {
		const comments = [];
		for (const directive of directives) {
			const fixDirective = fix[directive];
			if (fixDirective) {
				const { messages, getInsertText } = fixDirective;
				const rules = getRuleIds(messages);

				let comment = `eslint-${directive} ${rules}`;
				if (directive !== 'enable') {
					comment += ` -- ${getCommentDescription(messages[0])}`;
				}

				comments.push(getInsertText(`${fix.syntax[0]}${comment}${fix.syntax[1]}`));
			}
		}

		fixLaterMessages.push({
			/**
			 * Not specifiying a ruleId allows us to only apply this fix
			 * when --fix-type=directive is passed in
			 *
			 * https://github.com/eslint/eslint/blob/v8.0.0/lib/cli-engine/cli-engine.js#L342-L344
			 */
			ruleId: null,
			severity: ruleSeverity,
			message: '',
			line: 0,
			column: 0,
			fix: {
				range: [insertAt, insertAt],
				text: comments.join('\n'),
			},
		});
	}

	return fixLaterMessages;
};
