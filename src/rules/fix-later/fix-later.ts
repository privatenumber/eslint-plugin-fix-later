import eslint, { type Linter, type SourceCode } from 'eslint';
import { getSeverity, type LintMessage, type Fix } from './utils/eslint.js';
import {
	insertCommentAboveLine,
	insertCommentSameLine,
	type GetInsertText,
	type FixData,
} from './utils/fixer.js';
import { ruleId, ruleOptions } from './rule-meta.js';
import { getVueElementNodeByRangeIndex } from './utils/vue.js';
import { createCommentDescription, type GetCommentDescription } from './utils/comment-description.js';
import { filterMessages } from './utils/filter-messages.js';

type Fixer = {
	getInsertText: GetInsertText;
	messages: LintMessage[];
};

type CommentSyntax = [open: string, close: string];
type FixMap = {
	syntax: CommentSyntax;
	enable?: Fixer;
	disable?: Fixer;
	'disable-line'?: Fixer;
	'disable-next-line'?: Fixer;
};

const commentSyntax = {
	jsInline: ['// ', ''],
	jsBlock: ['/* ', ' */'],
	vue: ['<!-- ', ' -->'],
	jsx: ['{/* ', ' */}'],
} satisfies Record<string, CommentSyntax>;

const groupMessagesByFix = (
	sourceCode: SourceCode,
	code: string,
	messages: LintMessage[],
	disableDirective: string,
	ruleSeverity: Linter.Severity,
	getCommentDescription: GetCommentDescription,
) => {
	const disableDirectiveKey = disableDirective === 'eslint-disable-line'
		? 'disable-line'
		: 'disable-next-line';

	const fixesMap = new Map<number, FixMap>();

	const insertFix = (
		message: LintMessage,
		syntax: CommentSyntax,
		directive: 'disable' | 'enable' | 'disable-line' | 'disable-next-line',
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
			const fix = (
				disableDirectiveKey === 'disable-next-line'
					? insertCommentAboveLine(code, lineStart)
					: insertCommentSameLine(code, lineStart)
			);
			insertFix(message, commentSyntax.jsInline, disableDirectiveKey, fix);
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

	const asdf: LintMessage[] = [];
	for (const [insertAt, fix] of fixesMap) {
		const comments = [];

		if (fix.enable) {
			const rules = getRuleIds(fix.enable.messages);
			comments.push(
				fix.enable.getInsertText(`${fix.syntax[0]}eslint-enable ${rules}${fix.syntax[1]}`),
			);
		}
		if (fix.disable) {
			const { messages } = fix.disable;
			const rules = getRuleIds(messages);
			comments.push(
				fix.disable.getInsertText(`${fix.syntax[0]}eslint-disable ${rules} -- ${getCommentDescription(messages[0])}${fix.syntax[1]}`),
			);
		}
		if (fix['disable-next-line']) {
			const { messages } = fix['disable-next-line'];
			const rules = getRuleIds(messages);
			comments.push(
				fix['disable-next-line'].getInsertText(`${fix.syntax[0]}eslint-disable-next-line ${rules} -- ${getCommentDescription(messages[0])}${fix.syntax[1]}`),
			);
		}
		if (fix['disable-line']) {
			const { messages } = fix['disable-line'];
			const rules = getRuleIds(messages);
			comments.push(
				fix['disable-line'].getInsertText(`${fix.syntax[0]}eslint-disable-line ${rules} -- ${getCommentDescription(messages[0])}${fix.syntax[1]}`),
			);
		}

		asdf.push({
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

	return asdf;
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

	messages.push(...groupMessagesByFix(
		sourceCode,
		code,
		processMessages,
		ruleOptions.disableDirective,
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
