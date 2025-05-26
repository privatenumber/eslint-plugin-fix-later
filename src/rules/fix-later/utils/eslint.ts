import type { Linter } from 'eslint';

export type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

export type Fix = boolean | ((message: LintMessage) => boolean) | undefined;

export const getSeverity = (
	ruleLevel: Linter.RuleLevel,
) => {
	switch (ruleLevel) {
		case 2:
		case 'error': {
			return 2;
		}

		case 1:
		case 'warn': {
			return 1;
		}

		default: {
			return 0;
		}
	}
};
