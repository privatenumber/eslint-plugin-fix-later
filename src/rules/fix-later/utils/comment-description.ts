import { gitBlame, type GitBlame } from './git.js';
import { getCodeOwner } from './codeowner.js';
import { interpolateString } from './interpolate-string.js';
import type { LintMessage } from './eslint.js';

export const createCommentDescription = (
	commentTemplate: string,
	filename?: string,
) => (
	message: LintMessage,
): string => {
	let blameData: GitBlame | undefined;
	const comment = interpolateString(
		commentTemplate,
		{
			get blame() {
				if (filename && !blameData) {
					blameData = gitBlame(filename, message.line, message.endLine ?? message.line);
				}
				return blameData;
			},
			get codeowner() {
				if (filename) {
					return getCodeOwner(filename);
				}
			},
		},
		(_match, key) => {
			throw new Error(`Can't find key: ${key}`);
		},
	);

	return comment;
};

export type GetCommentDescription = ReturnType<typeof createCommentDescription>;
