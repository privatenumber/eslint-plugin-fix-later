import { testSuite, expect } from 'manten';
import outdent from 'outdent';
import { eslintWithCode } from '../utils/eslint.js';

export default testSuite(({ describe }, eslintPath: string) => {
	describe('basic usage', async ({ describe, test }) => {
		test('off', async () => {
			const result = await eslintWithCode(eslintPath, {
				config: {
					rules: {
						'fix-later/fix-later': 'off',
						'no-console': 'error',
					},
				},
				code: 'console.log()',
				fix: true,
			});

			expect(result.warningCount).toBe(0);
			expect(result.errorCount).toBe(1);
			expect(result.output).toBeUndefined();
		});

		test('ignores auto-fixable rules & no options', async () => {
			const result = await eslintWithCode(eslintPath, {
				config: {
					rules: {
						'fix-later/fix-later': 'error',
						semi: ['error', 'never'],
					},
				},
				code: '1;',
				fix: true,
			});

			expect(result.warningCount).toBe(0);
			expect(result.errorCount).toBe(0);
			expect(result.output).toBe('1');
		});

		describe('inherits severity', ({ test }) => {
			test('"warning"', async () => {
				const result = await eslintWithCode(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': 'warn',
							'no-console': 'error',
						},
					},
					code: 'console.log()',
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
				const result = await eslintWithCode(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': 1,
							'no-console': 'error',
						},
					},
					code: 'console.log()',
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
			const result = await eslintWithCode(eslintPath, {
				config: {
					rules: {
						'fix-later/fix-later': 'warn',
						'no-console': 'error',
						'no-undef': 'error',
					},
				},
				code: 'asdf(console.log())',
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
				const result = await eslintWithCode(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': ['warn'],
							'no-console': 'warn',
						},
					},
					code: 'console.log()',
					fix: true,
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);

				expect(result.output).toBeUndefined();
			});

			test('true', async () => {
				const result = await eslintWithCode(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								includeWarnings: true,
							}],
							'no-console': 'warn',
						},
					},
					code: 'console.log()',
					fix: true,
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);
				expect(result.output).toBe('console.log() // eslint-disable-line no-console -- Fix later');
			});
		});

		if (eslintPath.includes('eslint8')) {
			test('apply fix-only with --fix-type=directive', async () => {
				const code = outdent`
				var foo = () => 0
				`;
				const result = await eslintWithCode(eslintPath, {
					config: {
						parserOptions: {
							ecmaVersion: 2021,
						},
						rules: {
							'fix-later/fix-later': ['warn', {
								insertDisableComment: 'above-line',
							}],
							'arrow-body-style': ['error', 'always'],
						},
					},
					code,
					fix: true,

					// Only applies fix-later and doesn't auto-fix the arrow-body-style
					fixType: 'directive',
				});

				expect(result.output).toBe(
					outdent`
					// eslint-disable-next-line arrow-body-style -- Fix later
					var foo = () => 0
					`,
				);
			});
		}

		test('inherits indentation without mixing tabs + spaces', async () => {
			const code = outdent`
			if (true) {
				 console.log()
			}
			`;
			expect(code).toMatch('\n\t console');
			const result = await eslintWithCode(eslintPath, {
				config: {
					rules: {
						'fix-later/fix-later': ['warn', {
							insertDisableComment: 'above-line',
						}],
						'no-mixed-spaces-and-tabs': 'error',
					},
				},
				code,
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
				const code = outdent`
				if (true) {
					// eslint-disable-next-line no-mixed-spaces-and-tabs
					 console.log()
				}
				`;
				expect(code).toMatch('\n\t console');
				const result = await eslintWithCode(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								insertDisableComment: 'above-line',
							}],
							'no-mixed-spaces-and-tabs': 'error',
							'no-console': 'error',
						},
					},
					code,
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
				const code = outdent`
				if (true) {
					 console.log() /* eslint-disable-line no-mixed-spaces-and-tabs */
				}
				`;
				const result = await eslintWithCode(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': 'warn',
							'no-mixed-spaces-and-tabs': 'error',
							'no-console': 'error',
						},
					},
					code,
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

		test('jsx expression', async () => {
			const content = outdent`
			(
				<>
					{ true ? <div>Hello World</div> : null }
				</>
			);
			(
				<>{ true ? <div>Hello World</div> : null }</>
			);

			(<>
				<div
					a={true ? <div>Hello World</div> : null}
				/>
			</>);

			(<div
				a={true ? <div>Hello World</div> : null}
			/>);

			(<div
				a={
					true ? <div>Hello World</div> : null
				}
			/>);

			(<div
				a={
					true ? <div>Hello World</div> : null}
			/>);
			`;

			const result = await eslintWithCode(eslintPath, {
				config: {
					rules: {
						'no-ternary': 'error',
						'fix-later/fix-later': ['error'],
					},
				},
				code: {
					name: 'FileA.js',
					content,
				},
				fix: true,
			});

			expect(result.errorCount).toBe(0);
			expect(result.output).toBe(
				outdent`
				(
					<>
						{/* eslint-disable no-ternary -- Fix later */ true ? <div>Hello World</div> : null /* eslint-enable no-ternary */}
					</>
				);
				(
					<>{/* eslint-disable no-ternary -- Fix later */ true ? <div>Hello World</div> : null /* eslint-enable no-ternary */}</>
				);

				(<>
					<div
						a={/* eslint-disable no-ternary -- Fix later */true ? <div>Hello World</div> : null/* eslint-enable no-ternary */}
					/>
				</>);

				(<div
					a={/* eslint-disable no-ternary -- Fix later */true ? <div>Hello World</div> : null/* eslint-enable no-ternary */}
				/>);

				(<div
					a={
						/* eslint-disable no-ternary -- Fix later */
						true ? <div>Hello World</div> : null
					/* eslint-enable no-ternary */
					}
				/>);

				(<div
					a={
						/* eslint-disable no-ternary -- Fix later */
						true ? <div>Hello World</div> : null/* eslint-enable no-ternary */
				}
				/>);
				`,
			);
		});

		test('jsx element', async () => {
			const content = outdent`
			(
				<div>
					Here is a
					<a>link</a>
				</div>
			);
			`;

			const result = await eslintWithCode(eslintPath, {
				config: {
					plugins: ['@stylistic/jsx'],
					rules: {
						'@stylistic/jsx/jsx-child-element-spacing': 'error',
						'fix-later/fix-later': ['error'],
					},
				},
				code: {
					name: 'FileA.js',
					content,
				},
				fix: true,
			});

			// expect(result.errorCount).toBe(0);
			expect(result.output).toBe(
				outdent`
				(
					<div>
						Here is a
						{/* eslint-disable @stylistic/jsx/jsx-child-element-spacing -- Fix later */}<a>link</a>{/* eslint-enable @stylistic/jsx/jsx-child-element-spacing */}
					</div>
				);
				`,
			);
		});

		test('vue', async () => {
			const result = await eslintWithCode(eslintPath, {
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

		if (eslintPath.includes('eslint8')) {
			test('consecutive errors', async () => {
				const result = await eslintWithCode(eslintPath, {
					config: {
						extends: 'plugin:vue/base',
						rules: {
							'vue/no-deprecated-slot-attribute': 'error',
							'fix-later/fix-later': 'error',
						},
					},
					code: {
						name: 'FileA.vue',
						content: outdent`
						<template>
							<comp>
								<img slot="media">
								<img slot="media">
							</comp>
						</template>
						`,
					},
					fix: true,
					fixType: 'directive',
				});

				expect(result.errorCount).toBe(2);
				expect(result.output).toBe(
					outdent`
					<template>
						<comp>
							<!-- eslint-disable vue/no-deprecated-slot-attribute -- Fix later -->
							<img slot="media">
							<!-- eslint-enable vue/no-deprecated-slot-attribute -->

							<!-- eslint-disable vue/no-deprecated-slot-attribute -- Fix later -->
							<img slot="media">
						<!-- eslint-enable vue/no-deprecated-slot-attribute -->
						</comp>
					</template>
					`,
				);
			});
		}
	});
});
