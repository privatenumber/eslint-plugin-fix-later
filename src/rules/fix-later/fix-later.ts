import eslint, { type Linter, type SourceCode } from 'eslint';
import { getSeverity } from './utils/eslint.js';
import {
	insertCommentAboveLine,
	insertCommentSameLine,
} from './utils/fixer.js';
import { gitBlame, type GitBlame } from './utils/git.js';
import { interpolateString } from './utils/interpolate-string.js';
import { ruleId, ruleOptions } from './rule-meta.js';
import { getVueElement } from './utils/vue.js';

type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

const allowedErrorPattern = /^Definition for rule '[^']+' was not found\.$/;

const getRuleIds = (
	lintMessages: LintMessage[],
) => {
	const ruleIds: string[] = [];
	for (const message of lintMessages) {
		if (message.ruleId && !ruleIds.includes(message.ruleId)) {
			ruleIds.push(message.ruleId);
		}
	}
	return ruleIds;
};

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

	if (processMessages.length === 0) {
		return messages;
	}

	const { commentTemplate } = ruleOptions;

	// The number is the line where the disable comment should be inserted
	const groupedByLine: Record<string, {
		line: LintMessage[];
		start: LintMessage[];
		end: LintMessage[];
	}> = {};
	const addMessage = (
		key: string | number,
		type: 'line' | 'start' | 'end',
		message: LintMessage,
	) => {
		if (!groupedByLine[key]) {
			groupedByLine[key] = {
				line: [],
				start: [],
				end: [],
			};
		}
		groupedByLine[key][type].push(message);
	};

	for (const message of processMessages) {
		const reportedIndex = sourceCode.getIndexFromLoc({
			line: message.line,
			column: message.column - 1,
		});
		const reportedNode = sourceCode.getNodeByRangeIndex(reportedIndex);
		if (reportedNode) {
			addMessage(message.line, 'line', message);
		} else {
			// Vue.js template
			const vueDocumentFragment = sourceCode.parserServices.getDocumentFragment?.();
			const templateNode = getVueElement(reportedIndex, vueDocumentFragment);

			if (templateNode) {
				addMessage(templateNode.loc.start.line, 'start', message);
				addMessage(templateNode.loc.end.line + 1, 'end', message);
			}
		}
	}

	const getLineComment = (
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
				// TODO: codeowners
			},
			(_match, key) => {
				throw new Error(`Can't find key: ${key}`);
			},
		);

		return comment;
	};

	for (const key in groupedByLine) {
		if (!Object.hasOwn(groupedByLine, key)) {
			continue;
		}

		const groupedMessages = groupedByLine[key];
		const comments = [];
		if (groupedMessages.line.length > 0) {
			const rulesToDisable = getRuleIds(groupedMessages.line).join(', ');
			comments.push(`${ruleOptions!.disableDirective} ${rulesToDisable} -- ${getLineComment(groupedMessages.line[0])}`);
		}
		if (groupedMessages.start.length > 0) {
			const rulesToDisable = getRuleIds(groupedMessages.start).join(', ');
			comments.push(`<!-- eslint-disable ${rulesToDisable} -- ${getLineComment(groupedMessages.start[0])} -->`);
		}
		if (groupedMessages.end.length > 0) {
			const rulesToDisable = getRuleIds(groupedMessages.end).join(', ');
			comments.push(`<!-- eslint-enable ${rulesToDisable} -->`);
		}

		const lineStartIndex = sourceCode.getIndexFromLoc({
			line: Number(key),
			column: 0,
		});

		const comment = comments.join('\n');
		messages.push({
			ruleId,
			severity: ruleSeverity,
			message: 'Suppressing errors',
			line: 0,
			column: 0,
			fix: (
				(
					ruleOptions.insertDisableComment === 'above-line'
					|| groupedMessages.start.length > 0
					|| groupedMessages.end.length > 0
				)
					? insertCommentAboveLine(
						code,
						lineStartIndex,
						comment,
					)
					: insertCommentSameLine(
						code,
						lineStartIndex,
						comment,
					)
			),
		});
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
