import { testSuite, expect } from 'manten';
import outdent from 'outdent';
import { eslint } from '../utils/eslint.js';

export default testSuite(({ describe }, eslintPath: string) => {
	describe('basic usage', async ({ describe, test }) => {
		test('off', async () => {
			const result = await eslint(eslintPath, {
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
			const result = await eslint(eslintPath, {
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
				const result = await eslint(eslintPath, {
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
				const result = await eslint(eslintPath, {
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
			const result = await eslint(eslintPath, {
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

			// Added in ESLint v8.8.0
			// https://github.com/eslint/eslint/commit/5d60812d440762dff72420714273c714c4c5d074
			if ('suppressedMessages' in result) {
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
			}

			expect(result.output).toBe(
				'asdf(console.log()) // eslint-disable-line no-undef, no-console -- Fix later',
			);
		});

		describe('includeWarnings', ({ test }) => {
			test('false', async () => {
				const result = await eslint(eslintPath, {
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
				const result = await eslint(eslintPath, {
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

		test('inherits indentation without mixing tabs + spaces', async () => {
			const content = outdent`
			if (true) {
				 console.log()
			}
			`;
			expect(content).toMatch('\n\t console');
			const result = await eslint(eslintPath, {
				config: {
					rules: {
						'fix-later/fix-later': ['warn', {
							insertDisableComment: 'above-line',
						}],
						'no-mixed-spaces-and-tabs': 'error',
					},
				},
				code: {
					content,
				},
				fix: true,
			});

			expect(result.output).toBe(
				outdent`
				if (true) {
					// eslint-disable-next-line no-mixed-spaces-and-tabs -- Fix later
					 console.log()
				}
				`,
			);
		});

		describe('merges eslint-disable comment if exists', ({ test }) => {
			test('above-line', async () => {
				const content = outdent`
				if (true) {
					// eslint-disable-next-line no-mixed-spaces-and-tabs
					 console.log()
				}
				`;
				expect(content).toMatch('\n\t console');
				const result = await eslint(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								insertDisableComment: 'above-line',
							}],
							'no-mixed-spaces-and-tabs': 'error',
							'no-console': 'error',
						},
					},
					code: {
						content,
					},
					fix: true,
				});

				expect(result.output).toBe(
					outdent`
					if (true) {
						// eslint-disable-next-line no-mixed-spaces-and-tabs, no-console -- Fix later
						 console.log()
					}
					`,
				);
			});

			test('same-line', async () => {
				const content = outdent`
				if (true) {
					 console.log() /* eslint-disable-line no-mixed-spaces-and-tabs */
				}
				`;
				const result = await eslint(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': 'warn',
							'no-mixed-spaces-and-tabs': 'error',
							'no-console': 'error',
						},
					},
					code: {
						content,
					},
					fix: true,
				});

				expect(result.output).toBe(
					outdent`
					if (true) {
						 console.log() /* eslint-disable-line no-mixed-spaces-and-tabs, no-console -- Fix later */
					}
					`,
				);
			});
		});

		test('vue', async () => {
			const result = await eslint(eslintPath, {
				config: {
					extends: 'plugin:vue/vue3-recommended',
					rules: {
						'vue/html-indent': 'off',
						'fix-later/fix-later': ['error', { includeWarnings: true }],
					},
				},
				code: {
					name: 'FileA.vue',
					content: outdent`
					<template>
						<template
							v-text="asdf"
							v-html="asdf"
						>
							{{ this.adf }}
						</template>
					</template>
					`,
				},
				fix: true,
			});

			expect(result.messages).toMatchObject([
				{
					ruleId: 'fix-later/fix-later',
					severity: 2,
					message: '[REMINDER] Fix later',
					line: 2,
					column: 2,
					endLine: 2,
					endColumn: 96,
				},
			]);

			expect(result.errorCount).toBe(1);
			expect(result.output).toBe(
				outdent`
				<template>
					<!-- eslint-disable vue/no-lone-template, vue/no-v-html, vue/no-child-content -- Fix later -->
					<template
						v-text="asdf"
						v-html="asdf"
					>
						<!-- eslint-enable vue/no-lone-template, vue/no-v-html -->
						{{ adf }}
					</template>
				<!-- eslint-enable vue/no-child-content -->
				</template>
				`,
			);
		});
	});
});
