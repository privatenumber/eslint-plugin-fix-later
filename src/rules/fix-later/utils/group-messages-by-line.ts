import type { Linter, SourceCode } from 'eslint';
import { getVueElementNodeByRangeIndex } from './vue.js';

export type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

export const commentSyntax = {
	js: ['/*', '*/'],
	vue: ['<!-- ', ' -->'],
};

type CodeType = keyof typeof commentSyntax;

export type ReportedErrors = {
	message: LintMessage;
	type: CodeType;
};

export const groupMessagesByLine = (
	sourceCode: SourceCode,
	messages: LintMessage[],
) => {
	// The number is the line where the disable comment should be inserted
	const groupedByLine: Map<number, {
		line: ReportedErrors[];
		start: ReportedErrors[];
		end: ReportedErrors[];
	}> = new Map();

	const addMessage = (
		line: number,
		type: 'line' | 'start' | 'end',
		message: LintMessage,
		codeType: CodeType,
	) => {
		let group = groupedByLine.get(line);
		if (!group) {
			group = {
				line: [],
				start: [],
				end: [],
			};
			groupedByLine.set(line, group);
		}

		group[type].push({
			type: codeType,
			message,
		});
	};

	for (const message of messages) {
		const reportedIndex = sourceCode.getIndexFromLoc({
			line: message.line,
			column: message.column - 1,
		});
		const reportedNode = sourceCode.getNodeByRangeIndex(reportedIndex);
		if (reportedNode) {
			addMessage(
				message.line,
				'line',
				message,
				'js',
			);
		} else {
			// Vue.js template
			const vueDocumentFragment = sourceCode.parserServices.getDocumentFragment?.();
			const templateNode = getVueElementNodeByRangeIndex(reportedIndex, vueDocumentFragment);

			if (templateNode) {
				addMessage(
					templateNode.loc.start.line,
					'start',
					message,
					'vue',
				);
				addMessage(
					templateNode.loc.end.line + 1,
					'end',
					message,
					'vue',
				);
			}
		}
	}

	return groupedByLine;
};
