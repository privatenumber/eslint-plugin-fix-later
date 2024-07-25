import { type Rule } from 'eslint';
import './fix-later.js';
import { setRuleUsage, normalizeOptions } from './rule-meta.js';
import { interpolateString } from './utils/interpolate-string.js';
import { escapeRegExp } from './utils/escape-regexp.js';
import type { SourceLocation } from 'estree';

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
			const description = commentString.slice(
				descriptionIndex + descriptionDelimiter.length,
			).trim();

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

		const document = sourceCode.parserServices.getDocumentFragment?.();
		if (document) {
			for (const comment of document.comments) {
				const commentText = comment.value.trim();
				if (commentText.startsWith('eslint-disable')) {
					reportCommentDescription(commentText, comment.loc);
				}
			}
		}

		return {};
	},
} satisfies Rule.RuleModule;
