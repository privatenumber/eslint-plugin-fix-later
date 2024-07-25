import { type Rule } from 'eslint';
import './fix-later.js';
import type { SourceLocation } from 'estree';
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

		const descriptionDelimiter = ' -- ';

		const wildCard = Math.random().toString(36).slice(2);
		const template = interpolateString(
			options.commentTemplate,
			{},
			() => wildCard,
		);
		const suppressCommentPattern = new RegExp(`^${escapeRegExp(template).replaceAll(wildCard, '.+?')}$`);

		// For older versions of ESLint
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const comments = sourceCode.getAllComments();

		const reportCommentDescription = (
			commentString: string,
			commentLocation: SourceLocation,
		) => {
			const descriptionIndex = commentString.indexOf(descriptionDelimiter);
			if (descriptionIndex === -1) {
				return;
			}

			const description = commentString.slice(descriptionIndex + descriptionDelimiter.length);
			if (!suppressCommentPattern.test(description)) {
				return;
			}

			context.report({
				loc: commentLocation,
				messageId: 'remindToFix',
				data: {
					description,
				},
			});
		};

		for (const comment of comments) {
			// comment.value doesn't contain the syntax of the comment
			const commentString = sourceCode.text.slice(comment.range![0] + 2, comment.range![1]).trim();
			if (commentString.startsWith('eslint-disable-')) {
				reportCommentDescription(commentString, comment.loc!);
			}
		}

		const vueDocument = sourceCode.parserServices.getDocumentFragment?.();
		if (vueDocument) {
			for (const comment of vueDocument.comments) {
				const commentText = comment.value.trim();
				if (commentText.startsWith('eslint-disable')) {
					reportCommentDescription(commentText, comment.loc);
				}
			}
		}

		return {};
	},
} satisfies Rule.RuleModule;
