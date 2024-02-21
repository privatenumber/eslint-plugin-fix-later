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

export const groupMessagesByLine = (
	messages: Linter.LintMessage[],
) => {
	const groupedByLine: Record<number, Linter.LintMessage[]> = {};
	for (const message of messages) {
		if (!groupedByLine[message.line]) {
			groupedByLine[message.line] = [];
		}

		// Don't add duplicate rules to the same line
		const lineMessages = groupedByLine[message.line];
		const ruleExists = lineMessages.some(({ ruleId }) => ruleId === message.ruleId);
		if (!ruleExists) {
			lineMessages.push(message);
		}
	}
	return Object.values(groupedByLine);
};
