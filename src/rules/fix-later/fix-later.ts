import eslint, { type Linter, type SourceCode } from 'eslint';
import { getSeverity } from './utils/eslint.js';
import {
	insertCommentAboveLine,
	insertCommentSameLine,
} from './utils/fixer.js';
import { gitBlame, type GitBlame } from './utils/git.js';
import { getCodeOwner } from './utils/codeowner.js';
import { interpolateString } from './utils/interpolate-string.js';
import { ruleId, ruleOptions } from './rule-meta.js';
import {
	groupMessagesByLine, commentSyntax, type ReportedErrors, type LintMessage,
} from './utils/group-messages-by-line.js';

const allowedErrorPattern = /^Definition for rule '[^']+' was not found\.$/;

const getRuleIds = (
	lintMessages: ReportedErrors[],
) => {
	const ruleIds: string[] = [];
	for (const { message } of lintMessages) {
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
	{ fix, filename }: {
		filename?: string;
		fix?: boolean | ((message: LintMessage) => boolean);
	},
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

		return messages;
	}

	if (processMessages.length === 0) {
		return messages;
	}

	const { commentTemplate } = ruleOptions;
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

	const groupedByLine = groupMessagesByLine(sourceCode, processMessages);
	for (const [line, groupedMessages] of groupedByLine) {
		const comments = [];
		if (groupedMessages.line.length > 0) {
			const rulesToDisable = getRuleIds(groupedMessages.line).join(', ');
			const { type, message } = groupedMessages.line[0];
			comments.push(`// ${ruleOptions!.disableDirective} ${rulesToDisable} -- ${getLineComment(message)}`);
		}
		if (groupedMessages.end.length > 0) {
			const { type } = groupedMessages.end[0];
			const rulesToDisable = getRuleIds(groupedMessages.end).join(', ');
			comments.push(`${commentSyntax[type][0]}eslint-enable ${rulesToDisable}${commentSyntax[type][1]}`);
		}
		if (groupedMessages.start.length > 0) {
			const { type, message } = groupedMessages.start[0];
			const rulesToDisable = getRuleIds(groupedMessages.start).join(', ');
			comments.push(`${commentSyntax[type][0]}eslint-disable ${rulesToDisable} -- ${getLineComment(message)}${commentSyntax[type][1]}`);
		}

		const lineStartIndex = sourceCode.getIndexFromLoc({
			line,
			column: 0,
		});

		const comment = comments.join('\n');
		const insertCommentAbove = (
			ruleOptions.insertDisableComment === 'above-line'
			|| groupedMessages.start.length > 0
			|| groupedMessages.end.length > 0
		);
		messages.push({
			/**
			 * Not specifiying a ruleId allows us to only apply this fix
			 * when --fix-type=directive is passed in
			 *
			 * https://github.com/eslint/eslint/blob/v8.0.0/lib/cli-engine/cli-engine.js#L342-L344
			 */
			ruleId: null,
			severity: ruleSeverity,
			message: `fix-later: insert eslint comment on L${line + (insertCommentAbove ? 1 : 0)}`,
			line,
			column: 0,
			fix: (
				insertCommentAbove
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
	_verifyWithFlatConfigArray,
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

if (_verifyWithFlatConfigArray) {
	eslint.Linter.prototype._verifyWithFlatConfigArray = function (
		textOrSourceCode,
		configArray,
		options,
	) {
		const messages: LintMessage[] = Reflect.apply(
			_verifyWithFlatConfigArray,
			this,
			arguments,
		);

		const filename = options.filename || '__placeholder__.js';
		const config = configArray.getConfig(filename);

		return suppressFileErrors(
			textOrSourceCode as string,
			this.getSourceCode(),
			config,
			messages,
			options,
		);
	};
}
