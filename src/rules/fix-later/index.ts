import { type Rule } from 'eslint';
import './fix-later.js';
import { setRuleUsage, normalizeOptions } from './rule-meta.js';
import { interpolateString } from './utils/interpolate-string.js';
import { escapeRegExp } from './utils/escape-regexp.js';

export const fixLater = {
	meta: {
		fixable: 'code',
		messages: {
			remindToFix: '[REMINDER] {{ description }}',
		},
		schema: [
			{
				type: 'object',
				properties: {
					includeWarnings: {
						type: 'boolean',
					},
					insertDisableComment: {
						enum: [
							'above-line',
							'end-of-line',
						],
					},
					commentTemplate: {
						type: 'string',
					},
				},
				additionalProperties: false,
			},
		],
		type: 'problem',
	},
	create: (context) => {
		const options = normalizeOptions(context.options[0]);
		setRuleUsage(context.id, options);

		const descriptionDelimiter = '--';

		const wildCard = Math.random().toString(36).slice(2);
		const template = interpolateString(
			options.commentTemplate,
			{
				'eslint-disable': `${options.disableDirective} ${wildCard}`,
			},
			() => wildCard,
		);
		const suppressCommentPattern = new RegExp(`^${escapeRegExp(template).replaceAll(wildCard, '.+?')}$`);

		// For older versions of ESLint
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const comments = sourceCode.getAllComments();

		for (const comment of comments) {
			// comment.value doesn't contain the syntax of the comment
			const commentString = sourceCode.text.slice(comment.range![0], comment.range![1]);

			if (!suppressCommentPattern.test(commentString)) {
				continue;
			}

			const descriptionIndex = commentString.indexOf(descriptionDelimiter);
			const description = commentString.slice(
				descriptionIndex + descriptionDelimiter.length,
			).trim();

			context.report({
				loc: comment.loc!,
				messageId: 'remindToFix',
				data: {
					description,
				},
			});
		}

		return {};
	},
} satisfies Rule.RuleModule;
