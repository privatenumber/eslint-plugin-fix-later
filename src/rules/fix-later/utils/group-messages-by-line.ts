import type { Linter, SourceCode } from 'eslint';
import { getVueElementNodeByRangeIndex } from './vue.js';
import type { Node } from 'estree';
export type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

export const commentSyntax = {
	js: ['/*', '*/'],
	vue: ['<!-- ', ' -->'],
	jsx: ['{/*', '*/}'],
};

type CodeType = keyof typeof commentSyntax;

export type ReportedErrors = {
	message: LintMessage;
	type: CodeType;
};

// // The number is the line where the disable comment should be inserted
// const groupedByLine: Record<string, {
//     line: ReportedErrors[];
//     start: ReportedErrors[];
//     end: ReportedErrors[];
// }> = {};

// const addMessage = (
//     key: string | number,
//     type: 'line' | 'start' | 'end',
//     message: LintMessage,
//     codeType: CodeType,
// ) => {
//     if (!groupedByLine[key]) {
//         groupedByLine[key] = {
//             line: [],
//             start: [],
//             end: [],
//         };
//     }
//     groupedByLine[key][type].push({
//         type: codeType,
//         message,
//     });
// };

function isInJSXExpressionContainer(node?: Node | null): boolean {
    let curr = node;
    while (curr) {
      if (curr.type === 'JSXExpressionContainer') {
        return curr;
      }
      curr = (curr as any).parent;
    }
    return false;
}

// for (const message of processMessages) {
//     const reportedIndex = sourceCode.getIndexFromLoc({
//         line: message.line,
//         column: message.column - 1,
//     });
//     const reportedNode = sourceCode.getNodeByRangeIndex(reportedIndex);

//     if (reportedNode) {
//         const isInJsx = isInJSXExpressionContainer(reportedNode);

//         if (isInJsx) {
//             // console.dir(reportedNode, { depth: 4, maxArrayLength: null });
//             // const loc = isInJsx.loc;
//             // if (!loc) {
//             // }
//             // console.log(loc);

//             // addMessage(
//             // 	loc.start.line,
//             // 	'start',
//             // 	message,
//             // 	'jsx',
//             // );
//             // addMessage(
//             // 	loc.end.line + 1,
//             // 	'end',
//             // 	message,
//             // 	'jsx',
//             // );
//         } else {
//             addMessage(
//                 message.line,
//                 'line',
//                 message,
//                 'js',
//             );
//         }
//     } else {
//         // Vue.js template
//         const vueDocumentFragment = sourceCode.parserServices.getDocumentFragment?.();
//         const templateNode = getVueElementNodeByRangeIndex(reportedIndex, vueDocumentFragment);

//         if (templateNode) {
//             addMessage(
//                 templateNode.loc.start.line,
//                 'start',
//                 message,
//                 'vue',
//             );
//             addMessage(
//                 templateNode.loc.end.line + 1,
//                 'end',
//                 message,
//                 'vue',
//             );
//         }
//     }
// }

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
            const isInJsx = isInJSXExpressionContainer(reportedNode);
            if (isInJsx) {
                // console.log(reportedNode);
                console.log(isInJsx);
                /*
                Maybe it can insert itself as L1C3 kind of thing, so all violations in the same expression
                container can be grouped
                */
            } else {
                addMessage(
                    message.line,
                    'line',
                    message,
                    'js',
                );
            }
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
