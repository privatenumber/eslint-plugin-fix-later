import type { Linter } from 'eslint';

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
