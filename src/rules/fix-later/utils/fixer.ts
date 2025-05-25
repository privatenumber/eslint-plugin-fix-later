/**
 * Regex to only match a sequence of tabs or spaces (not both)
 * \s is not used because it can include new lines which we don't want
 */
const tabOrSpaces = /^([\t ]?)\1*/;

const getCommentIndex = (code: string) => {
	const lineCommentIndex = code.indexOf('//');
	if (lineCommentIndex !== -1) {
		return lineCommentIndex;
	}

	return code.indexOf('/*');
};

const eslintDisableNextLine = 'eslint-disable-next-line';
const eslintDisableSameLine = 'eslint-disable-line';
// TODO: support enable and disable
const getDisableDirectiveIndex = (comment: string) => {
	const nextLineIndex = comment.indexOf(eslintDisableNextLine);
	if (nextLineIndex !== -1) {
		return nextLineIndex + eslintDisableNextLine.length + 1;
	}

	const sameLineIndex = comment.indexOf(eslintDisableSameLine);
	if (sameLineIndex !== -1) {
		return sameLineIndex + eslintDisableSameLine.length + 1;
	}
	return -1;
};

const parseEslintDisableComment = (comment: string) => {
	const commentIndex = getCommentIndex(comment);
	if (commentIndex === -1) {
		return;
	}

	const disableIndex = getDisableDirectiveIndex(comment);
	if (disableIndex === -1) {
		return;
	}

	let commentContent = comment.slice(disableIndex);

	const commentEnd = commentContent.indexOf('*/');
	if (commentEnd !== -1) {
		commentContent = commentContent.slice(0, commentEnd);
	}

	commentContent = commentContent.trim();
	const [rules, description] = commentContent.split('--', 2);

	const index = (
		description
			? (disableIndex + commentContent.indexOf('--') + 2)
			: (
				disableIndex
				+ commentContent.length
			)
	);

	return {
		rules: rules.trim(),
		description: (description ?? '').trim(),
		index,
	};
};

type Fix = {
	insertAt: number;
	text: (comment: string) => string;
};

export const insertCommentAboveLine = (
	code: string,
	lineStart: number,
): Fix => {
	const indentation = code.slice(lineStart).match(tabOrSpaces)![0];
	const codeBefore = code.slice(0, lineStart - 1);
	const lastNewLine = codeBefore.lastIndexOf('\n');
	if (lastNewLine !== -1) {
		const lineBefore = codeBefore.slice(lastNewLine + 1);
		const commentBefore = parseEslintDisableComment(lineBefore);

		if (commentBefore) {
			const insertAt = lastNewLine + 1 + commentBefore.index;
			return {
				insertAt,
				text: (comment) => {
					const insertComment = parseEslintDisableComment(comment)!;
					return `, ${insertComment.rules} -- ${insertComment.description}`;
				},
			};
		}
	}

	return {
		insertAt: lineStart,
		text: comment => `${indentation}${comment}\n`,
	};
};

export const insertCommentSameLine = (
	code: string,
	lineStart: number,
): Fix => {
	const codeFromLine = code.slice(lineStart);
	const nextLineIndex = codeFromLine.indexOf('\n');
	const lineCode = codeFromLine.slice(0, (
		nextLineIndex === -1
			? code.length
			: nextLineIndex
	));

	const commentIndex = getCommentIndex(lineCode);
	if (commentIndex !== -1) {
		const commentExists = parseEslintDisableComment(lineCode.slice(commentIndex));
		if (commentExists) {
			const insertAt = lineStart + commentIndex + commentExists.index;
			return {
				insertAt,
				text: (comment) => {
					const insertComment = parseEslintDisableComment(comment)!;
					return `, ${insertComment.rules} -- ${insertComment.description}`;
				},
			};
		}
	}

	const insertAt = (
		nextLineIndex === -1
			? code.length
			: lineStart + nextLineIndex
	);

	return {
		insertAt,
		text: comment => ` ${comment}`,
	};
};
