import eslint, { type Linter, type SourceCode } from 'eslint';
import {
	getSeverity,
	groupMessagesByLine,
} from './utils/eslint';
import {
	insertIgnoreAboveLine,
	insertIgnoreSameLine,
} from './utils/fixer';
import {
	gitBlame,
	type GitBlame,
} from './utils/git';
import {
	interpolateString,
} from './utils/interpolate-string';
import { ruleId, ruleOptions } from './rule-meta';

type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

const allowedErrorPattern = /^Definition for rule '[^']+' was not found\.$/;

const suppressFileErrors = (
	code: string,
	sourceCode: SourceCode,
	extractedConfig: Linter.Config,
	messages: LintMessage[],
	{ fix, filename }: Linter.FixOptions,
) => {
	if (!ruleId || !ruleOptions) {
		return messages;
	}

	const ruleConfig = extractedConfig?.rules?.[ruleId];
	if (!ruleConfig) {
		return messages;
	}
	const ruleLevel = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
	const ruleSeverity = getSeverity(ruleLevel);

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

	if (!ruleOptions.includeWarnings) {
		processMessages = processMessages.filter(({ severity }) => severity > 1);
	}

	// If applying fix, only suppress errors that can't be fixed
	if (fix) {
		processMessages = processMessages.filter(message => !message.fix);
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

		return messages;
	}

	const { commentTemplate } = ruleOptions;
	const messagesGroupedByLine = groupMessagesByLine(processMessages);

	for (const lineGroup of messagesGroupedByLine) {
		const rulesToDisable = lineGroup
			.map(rule => rule.ruleId)
			.join(', ');

		const [message] = lineGroup;
		const reportedIndex = sourceCode.getIndexFromLoc({
			line: message.line,
			column: message.column - 1,
		});

		// const vueDocumentFragment = sourceCode.parserServices.getDocumentFragment?.()
		// console.dir(vueDocumentFragment);
		const reportedNode = sourceCode.getNodeByRangeIndex(reportedIndex);
		if (!reportedNode) {
			continue;
		}

		let blameData: GitBlame | undefined;
		const comment = interpolateString(
			commentTemplate,
			{
				'eslint-disable': `${ruleOptions.disableDirective} ${rulesToDisable}`,
				get blame() {
					if (filename && !blameData) {
						blameData = gitBlame(filename, message.line, message.endLine ?? message.line);
					}
					return blameData;
				},
			},
			(_match, key) => {
				throw new Error(`Can't find key: ${key}`);
			},
		);

		const lineStart = sourceCode.getIndexFromLoc({
			line: message.line,
			column: 0,
		});

		messages.push({
			ruleId,
			severity: ruleSeverity,
			message: `Suppressing errors: ${rulesToDisable}`,
			line: message.line,
			column: message.column,
			fix: (
				ruleOptions.insertDisableComment === 'above-line'
					? insertIgnoreAboveLine(
						code,
						lineStart,
						comment,
					)
					: insertIgnoreSameLine(
						code,
						lineStart,
						comment,
					)
			),
		});

		// In practice, ESLint runs multiple times so the suppressed rules
		// don't need to be removed
	}

	return messages;
};

/**
 * This could be implemented as a processor, but ESLint doesn't support nesting processors.
 * For example, Vue and Markdown plugins have processors so this would be mutually exclusive.
 */
const {
	_verifyWithoutProcessors,
	_verifyWithProcessor,
} = eslint.Linter.prototype;

eslint.Linter.prototype._verifyWithoutProcessors = function (
	textOrSourceCode,
	config,
	options,
) {
	const messages: LintMessage[] = Reflect.apply(
		_verifyWithoutProcessors,
		this,
		arguments,
	);

	// Process in _verifyWithProcessor instead
	if (options.postprocess) {
		return messages;
	}

	return suppressFileErrors(
		textOrSourceCode as string,
		this.getSourceCode(),
		config,
		messages,
		options,
	);
};

/**
 * Only called if there's a processor
 * Processors are sometimes used to add custom comment directives
 * So a plugin's postprocess may remove suppressed errors
 * We want to filter out after that
 */
eslint.Linter.prototype._verifyWithProcessor = function (
	textOrSourceCode,
	config,
	options,
) {
	const messages: LintMessage[] = Reflect.apply(
		_verifyWithProcessor,
		this,
		arguments,
	);

	return suppressFileErrors(
		textOrSourceCode as string,
		this.getSourceCode(),
		config,
		messages,
		options,
	);
};
