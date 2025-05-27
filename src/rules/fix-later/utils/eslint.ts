import type { Linter } from 'eslint';

export type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

export type Fix = boolean | ((message: LintMessage) => boolean) | undefined;

export type InlineDirectives = 'disable-line' | 'disable-next-line';

export const directives = [
	'enable',
	'disable',
	'disable-next-line',
	'disable-line',
] as const;

export type Directives = typeof directives[number];

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
