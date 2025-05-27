import eslint, { type Linter, type SourceCode } from 'eslint';
import {
	getSeverity, type LintMessage, type Fix,
} from './utils/eslint.js';
import { ruleId, ruleOptions } from './rule-meta.js';
import { createCommentDescription } from './utils/comment-description.js';
import { filterMessages } from './utils/filter-messages.js';
import { getFixLaterMessages } from './utils/fix-later-messages.js';

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
		(
			'languageOptions' in extractedConfig
				// @ts-expect-error ESLint v9
				? extractedConfig.languageOptions.parserOptions.ecmaFeatures.jsx
				: extractedConfig.parserOptions?.ecmaFeatures?.jsx
		),
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
