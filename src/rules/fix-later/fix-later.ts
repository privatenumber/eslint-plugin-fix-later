import eslint, { type Linter, type SourceCode } from 'eslint';
import { getSeverity, type LintMessage, type Fix, type Directives, type InlineDirectives, directives } from './utils/eslint.js';
import {
	insertCommentAboveLine,
	insertCommentSameLine,
	type GetInsertText,
	type FixData,
} from './utils/fixer.js';
import { ruleId, ruleOptions, type InsertDisableComment } from './rule-meta.js';
import { getVueElementNodeByRangeIndex } from './utils/vue.js';
import { createCommentDescription, type GetCommentDescription } from './utils/comment-description.js';
import { filterMessages } from './utils/filter-messages.js';

type CommentSyntax = [open: string, close: string];
const commentSyntax = {
	jsInline: ['// ', ''],
	jsBlock: ['/* ', ' */'],
	vue: ['<!-- ', ' -->'],
	jsx: ['{/* ', ' */}'],
} satisfies Record<string, CommentSyntax>;

type Fixer = {
	getInsertText: GetInsertText;
	messages: LintMessage[];
};

type FixMap = {
	syntax: CommentSyntax;
} & { [directive in Directives]?: Fixer; }

const getFixLaterMessages = (
	sourceCode: SourceCode,
	code: string,
	messages: LintMessage[],
	disableDirective: InsertDisableComment,
	ruleSeverity: Linter.Severity,
	getCommentDescription: GetCommentDescription,
) => {
	const fixesMap = new Map<number, FixMap>();

	const insertFix = (
		message: LintMessage,
		syntax: CommentSyntax,
		directive: Directives,
		{ insertAt, getInsertText }: FixData,
	) => {
		let fixMap = fixesMap.get(insertAt);
		if (!fixMap) {
			fixMap = { syntax };
			fixesMap.set(insertAt, fixMap);
		}

		let got = fixMap[directive];
		if (!got) {
			got = {
				getInsertText,
				messages: [],
			};
			fixMap[directive] = got;
		}
		got.messages.push(message);
	};

	for (const message of messages) {
		const index = sourceCode.getIndexFromLoc({
			line: message.line,
			column: message.column - 1,
		});
		const node = sourceCode.getNodeByRangeIndex(index);

		if (node) {
			const lineStart = sourceCode.getIndexFromLoc({
				line: message.line,
				column: 0,
			});
			if (disableDirective === 'above-line') {
				insertFix(
					message,
					commentSyntax.jsInline,
					'disable-next-line',
					insertCommentAboveLine(code, lineStart),
				)
			} else {
				insertFix(
					message,
					commentSyntax.jsInline,
					'disable-line',
					insertCommentSameLine(code, lineStart),
				);
			}
			continue;
		}

		const vueFrag = sourceCode.parserServices.getDocumentFragment?.();
		const vueNode = getVueElementNodeByRangeIndex(index, vueFrag);

		if (vueNode) {
			const disableLine = sourceCode.getIndexFromLoc({
				line: vueNode.loc.start.line,
				column: 0,
			});
			const disableFix = insertCommentAboveLine(code, disableLine);
			insertFix(message, commentSyntax.vue, 'disable', disableFix);

			const enableLine = sourceCode.getIndexFromLoc({
				line: vueNode.loc.end.line + 1,
				column: 0,
			});
			const enableFix = insertCommentAboveLine(code, enableLine);
			insertFix(message, commentSyntax.vue, 'enable', enableFix);
		}
	}

	const fixLaterMessages: LintMessage[] = [];
	for (const [insertAt, fix] of fixesMap) {
		const comments = [];
		for (const directive of directives) {
			const fixDirective = fix[directive];
			if (fixDirective) {
				const { messages, getInsertText } = fixDirective;
				const rules = getRuleIds(messages);

				let comment = `eslint-${directive} ${rules}`;
				if (directive !== 'enable') {
					comment += ` -- ${getCommentDescription(messages[0])}`;
				}

				comments.push(getInsertText(`${fix.syntax[0]}${comment}${fix.syntax[1]}`));
			}
		}

		fixLaterMessages.push({
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
			fix: {
				range: [insertAt, insertAt],
				text: comments.join('\n'),
			},
		});
	}

	return fixLaterMessages;
};

const getRuleIds = (
	lintMessages: LintMessage[],
) => {
	const ruleIds = new Set<string>();
	for (const message of lintMessages) {
		if (message.ruleId) {
			ruleIds.add(message.ruleId);
		}
	}
	return Array.from(ruleIds).join(', ');
};

const suppressFileErrors = (
	code: string,
	sourceCode: SourceCode,
	extractedConfig: Linter.Config,
	messages: LintMessage[],
	{ fix, filename }: {
		filename?: string;
		fix?: Fix;
	},
) => {
	if (!ruleId || !ruleOptions) {
		return messages;
	}

	const ruleConfig = extractedConfig?.rules?.[ruleId];
	if (!ruleConfig) {
		return messages;
	}
	const ruleSeverity = getSeverity(Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig);

	const processMessages = filterMessages(
		messages,
		ruleOptions.includeWarnings,
		fix,
		ruleSeverity,
	);
	if (processMessages.length === 0) {
		return messages;
	}

	messages.push(...getFixLaterMessages(
		sourceCode,
		code,
		processMessages,
		ruleOptions.insertDisableComment,
		ruleSeverity,
		createCommentDescription(ruleOptions.commentTemplate, filename),
	));

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
