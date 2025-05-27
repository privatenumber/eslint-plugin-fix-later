import type { Linter } from 'eslint';
import { ruleId } from '../rule-meta.js';
import type { LintMessage, Fix } from './eslint.js';

const allowedErrorPattern = /^Definition for rule '[^']+' was not found\.$/;

export const filterMessages = (
	messages: LintMessage[],
	includeWarnings: boolean,
	fix: Fix,
	ruleSeverity: Linter.Severity,
) => {
	let processMessages = messages
		.filter(message => (
			// Errors like parsing errors don't have rule IDs
			message.ruleId

			// Don't suppress itself
			&& message.ruleId !== ruleId

			// Filter out missing rule errors
			&& !allowedErrorPattern.test(message.message)

			// Filter out errors that are already suppressed
			&& (
				!('suppressions' in message)
				|| message.suppressions.length === 0
			)
		));

	if (!includeWarnings) {
		processMessages = processMessages.filter(({ severity }) => severity > 1);
	}

	// If applying fix, only suppress errors that can't be fixed
	if (fix) {
		processMessages = processMessages.filter(message => (
			!message.fix

			// Filter that applies `--fix-type`
			|| (typeof fix === 'function' && !fix(message))
		));
	} else {
		const suppressableMessages = processMessages.filter(message => !message.fix);

		if (suppressableMessages.length > 0) {
			messages.push({
				ruleId,
				severity: ruleSeverity,
				message: `${suppressableMessages.length} suppressable errors (suppress with --fix)`,
				line: 0,
				column: 0,
			});
		}

		return [];
	}
	return processMessages;
};
