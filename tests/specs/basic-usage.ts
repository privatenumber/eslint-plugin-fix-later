import { testSuite, expect } from 'manten';
import { eslint } from '../utils/eslint.js';

export default testSuite(({ describe }) => {
	describe('basic usage', async ({ describe, test }) => {
		test('off', async () => {
			const result = await eslint({
				config: {
					rules: {
						'fix-later/fix-later': 'off',
						'no-console': 'error',
					},
				},
				code: {
					content: 'console.log()',
				},
				fix: true,
			});

			expect(result.warningCount).toBe(0);
			expect(result.errorCount).toBe(1);
			expect(result.output).toBeUndefined();
		});

		test('ignores auto-fixable rules & no options', async () => {
			const result = await eslint({
				config: {
					rules: {
						'fix-later/fix-later': 'error',
						semi: ['error', 'never'],
					},
				},
				code: {
					content: '1;',
				},
				fix: true,
			});

			expect(result.warningCount).toBe(0);
			expect(result.errorCount).toBe(0);
			expect(result.output).toBe('1');
		});

		describe('inherits severity', ({ test }) => {
			test('"warning"', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': 'warn',
							'no-console': 'error',
						},
					},
					code: {
						content: 'console.log()',
					},
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(1);
				expect(result.messages).toMatchObject([
					{
						line: 1,
						column: 1,
						endLine: 1,
						endColumn: 12,

						ruleId: 'no-console',
						severity: 2,
						message: 'Unexpected console statement.',
						nodeType: 'MemberExpression',
						messageId: 'unexpected',
					},
					{
						line: 0,
						column: 0,

						ruleId: 'fix-later/fix-later',
						severity: 1,
						message: '1 suppressable errors (suppress with --fix)',
					},
				]);
			});

			test('1', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': 1,
							'no-console': 'error',
						},
					},
					code: {
						content: 'console.log()',
					},
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(1);
				expect(result.messages).toMatchObject([
					{
						line: 1,
						column: 1,
						endLine: 1,
						endColumn: 12,

						ruleId: 'no-console',
						severity: 2,
						message: 'Unexpected console statement.',
						nodeType: 'MemberExpression',
						messageId: 'unexpected',
					},
					{
						line: 0,
						column: 0,

						ruleId: 'fix-later/fix-later',
						severity: 1,
						message: '1 suppressable errors (suppress with --fix)',
					},
				]);
			});
		});

		test('handles multiple rules', async () => {
			const result = await eslint({
				config: {
					rules: {
						'fix-later/fix-later': 'warn',
						'no-console': 'error',
						'no-undef': 'error',
					},
				},
				code: {
					content: 'asdf(console.log())',
				},
				fix: true,
			});

			expect(result.messages).toMatchObject([
				{
					ruleId: 'fix-later/fix-later',
					severity: 1,
					message: '[REMINDER] Fix later',
					line: 1,
					column: 21,
					endLine: 1,
					endColumn: 77,
				},
			]);
			expect(result.suppressedMessages).toMatchObject([
				{
					ruleId: 'no-undef',
					severity: 2,
					message: "'asdf' is not defined.",
					line: 1,
					column: 1,
					nodeType: 'Identifier',
					messageId: 'undef',
					endLine: 1,
					endColumn: 5,
					suppressions: [{
						kind: 'directive',
						justification: 'Fix later',
					}],
				},
				{
					ruleId: 'no-console',
					severity: 2,
					message: 'Unexpected console statement.',
					line: 1,
					column: 6,
					nodeType: 'MemberExpression',
					messageId: 'unexpected',
					endLine: 1,
					endColumn: 17,
					suppressions: [{
						kind: 'directive',
						justification: 'Fix later',
					}],
				},
				{
					ruleId: 'no-undef',
					severity: 2,
					message: "'console' is not defined.",
					line: 1,
					column: 6,
					nodeType: 'Identifier',
					messageId: 'undef',
					endLine: 1,
					endColumn: 13,
					suppressions: [{
						kind: 'directive',
						justification: 'Fix later',
					}],
				},
			]);
			expect(result.output).toBe(
				'asdf(console.log()) // eslint-disable-line no-undef, no-console -- Fix later',
			);
		});

		describe('includeWarnings', ({ test }) => {
			test('false', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['warn'],
							'no-console': 'warn',
						},
					},
					code: {
						content: 'console.log()',
					},
					fix: true,
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);

				expect(result.output).toBeUndefined();
			});

			test('true', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								includeWarnings: true,
							}],
							'no-console': 'warn',
						},
					},
					code: {
						content: 'console.log()',
					},
					fix: true,
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);
				expect(result.output).toBe('console.log() // eslint-disable-line no-console -- Fix later');
			});
		});

		// test('vue', async () => {
		// 	const result = await eslint({
		// 		config: {
		// 			extends: 'plugin:vue/vue3-recommended',
		// 			rules: {
		// 				'fix-later/fix-later': 'error',
		// 			},
		// 		},
		// 		code: {
		// 			name: 'FileA.vue',
		// 			content: `
		// 			<template>
		// 				<div
		// 					title="header"
		// 					v-for="item in items"
		// 				/>
		// 			</template>
		// 			`,
		// 		},
		// 		fix: true,
		// 	});

		// 	console.log(result);
		// 	expect(result.warningCount).toBe(1);
		// 	expect(result.errorCount).toBe(0);

		// 	expect(result.output).toBeUndefined();
		// });
	});
});
