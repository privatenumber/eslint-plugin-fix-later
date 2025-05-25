import eslint, { type Linter, type Rule, type SourceCode } from 'eslint';
import { getSeverity } from './utils/eslint.js';
import {
	insertCommentAboveLine,
	insertCommentSameLine,
} from './utils/fixer.js';
import { gitBlame, type GitBlame } from './utils/git.js';
import { getCodeOwner } from './utils/codeowner.js';
import { interpolateString } from './utils/interpolate-string.js';
import { ruleId, ruleOptions } from './rule-meta.js';
import { getVueElementNodeByRangeIndex } from './utils/vue.js';

export type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;

const commentSyntax = {
	js: ['/*', '*/'],
	vue: ['<!-- ', ' -->'],
	jsx: ['{/*', '*/}'],
};

const allowedErrorPattern = /^Definition for rule '[^']+' was not found\.$/;

const getRuleIds = (
	lintMessages: LintMessage[],
) => {
	const ruleIds = new Set<string>();
	for (const message of lintMessages) {
		if (message.ruleId) {
			ruleIds.add(message.ruleId);
		}
	}
	return Array.from(ruleIds);
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

	const createMessage = (fix: Rule.Fix): LintMessage => ({
		/**
		 * Not specifiying a ruleId allows us to only apply this fix
		 * when --fix-type=directive is passed in
		 *
		 * https://github.com/eslint/eslint/blob/v8.0.0/lib/cli-engine/cli-engine.js#L342-L344
		 */
		ruleId: null,
		severity: ruleSeverity,
		message: '',
		line: 0,
		column: 0,
		fix,
	});

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

	const disableDirective = ruleOptions!.disableDirective === 'eslint-disable-line' ? 'disable-line' : 'disable-next-line';
	const preferCommentAbove = ruleOptions.insertDisableComment === 'above-line';

	type CommentTypes = 'js' | 'jsx' | 'vue';
	type FixMap = {
		type: CommentTypes;
		enable: LintMessage[];
		disable: LintMessage[];
		'disable-line': LintMessage[];
		'disable-next-line': LintMessage[];
	};
	const createFixMap = (
		type: CommentTypes,
	): FixMap => ({
		type,
		enable: [],
		disable: [],
		'disable-line': [],
		'disable-next-line': [],
	});
	const fixesMap = new Map<number, FixMap>();

	const getFixMap = (
		insertAt: number,
		type: CommentTypes,
	) => {
		let fixMap = fixesMap.get(insertAt);
		if (!fixMap) {
			fixMap = createFixMap(type);
			fixesMap.set(insertAt, fixMap);
		}
		return fixMap;
	};

	for (const message of processMessages) {
		const reportedIndex = sourceCode.getIndexFromLoc({
			line: message.line,
			column: message.column - 1,
		});
		const reportedNode = sourceCode.getNodeByRangeIndex(reportedIndex);
		if (reportedNode) {
			const lineStartIndex = sourceCode.getIndexFromLoc({
				line: message.line,
				column: 0,
			});
			const theFix = preferCommentAbove
				? insertCommentAboveLine(
					code,
					lineStartIndex,
				)
				: insertCommentSameLine(
					code,
					lineStartIndex,
				);

			const fixMap = getFixMap(theFix.insertAt, 'js');
			fixMap[disableDirective].push(message);
			fixMap[disableDirective].text = theFix.text;
		} else {
			// Vue.js template
			const vueDocumentFragment = sourceCode.parserServices.getDocumentFragment?.();
			const templateNode = getVueElementNodeByRangeIndex(reportedIndex, vueDocumentFragment);

			if (templateNode) {
				const theFix = insertCommentAboveLine(
					code,
					sourceCode.getIndexFromLoc({
						line: templateNode.loc.start.line,
						column: 0,
					}),
				);

				const fixMap1 = getFixMap(theFix.insertAt, 'vue');
				fixMap1.disable.push(message);
				fixMap1.disable.text = theFix.text;

				const theFix2 = insertCommentAboveLine(
					code,
					sourceCode.getIndexFromLoc({
						line: templateNode.loc.end.line + 1,
						column: 0,
					}),
				);

				const fixMap2 = getFixMap(theFix2.insertAt, 'vue');
				fixMap2.enable.push(message);
				fixMap2.enable.text = theFix2.text;
			}
		}
	}

	for (const [insertAt, fix] of fixesMap) {
		const comments = [];

		if (fix.enable.length > 0) {
			const rules = getRuleIds(fix.enable).join(', ');
			comments.push(
				fix.enable.text(`${commentSyntax[fix.type][0]}eslint-enable ${rules}${commentSyntax[fix.type][1]}`),
			);
		}
		if (fix.disable.length > 0) {
			const [message] = fix.disable;
			const rules = getRuleIds(fix.disable).join(', ');
			comments.push(
				fix.disable.text(`${commentSyntax[fix.type][0]}eslint-disable ${rules} -- ${getLineComment(message)}${commentSyntax[fix.type][1]}`),
			);
		}
		if (fix['disable-next-line'].length > 0) {
			const [message] = fix['disable-next-line'];
			const rules = getRuleIds(fix['disable-next-line']).join(', ');
			comments.push(
				fix['disable-next-line'].text(`// eslint-disable-next-line ${rules} -- ${getLineComment(message)}`),
			);
		}
		if (fix['disable-line'].length > 0) {
			const [message] = fix['disable-line'];
			const rules = getRuleIds(fix['disable-line']).join(', ');
			comments.push(
				fix['disable-line'].text(`// eslint-disable-line ${rules} -- ${getLineComment(message)}`),
			);
		}

		const fixObject = {
			range: [insertAt, insertAt] as [number, number],
			text: comments.join('\n'),
		};

		messages.push(createMessage(fixObject));
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
