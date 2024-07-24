import type { Rule } from 'eslint';

export const insertCommentAboveLine = (
	code: string,
	lineStart: number,
	comment: string,
): Rule.Fix => {
	const indentation = code.slice(lineStart).match(/^\s*/)![0];

	return {
		range: [lineStart, lineStart],
		text: `${indentation}${comment}\n`,
	};
};

export const insertCommentSameLine = (
	code: string,
	lineStart: number,
	comment: string,
): Rule.Fix => {
	const nextLineIndex = code.slice(lineStart).indexOf('\n');
	const insertAt = (
		nextLineIndex === -1
			? code.length
			: lineStart + nextLineIndex
	);

	return {
		range: [insertAt, insertAt],
		text: ` ${comment}`,
	};
};
