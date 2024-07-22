import { testSuite, expect } from 'manten';
import outdent from 'outdent';
import { eslint } from '../../utils/eslint.js';

export default testSuite(({ describe }) => {
	describe('insertDisableComment', ({ describe, runTestSuite }) => {
		describe('end-of-line', ({ test }) => {
			test('added to complex line', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								insertDisableComment: 'end-of-line',
							}],
							'no-console': 'error',
						},
					},
					code: {
						content: outdent`
						asdf(
							1,console.log()
						)
						`,
					},
					fix: true,
				});

				expect(result.output).toBe(
					outdent`
					asdf(
						1,console.log() // eslint-disable-line no-console -- Fix later
					)
					`,
				);
				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);
			});

			test('added to even more complex line', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['error', {
								insertDisableComment: 'end-of-line',
							}],
							'no-console': 'error',
						},
					},
					code: {
						content: 'asdf(1,console.log())',
					},
					fix: true,
				});

				expect(result.output).toBe(
					'asdf(1,console.log()) // eslint-disable-line no-console -- Fix later',
				);
				expect(result.warningCount).toBe(0);
				expect(result.errorCount).toBe(1);
			});
		});

		describe('above-line', ({ test }) => {
			test('simple code', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['error', {
								insertDisableComment: 'above-line',
							}],
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
				expect(result.output).toBe(
					outdent`
					// eslint-disable-next-line no-console -- Fix later
					console.log()
					`,
				);
			});

			test('complex code', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['error', {
								insertDisableComment: 'above-line',
							}],
							'no-console': 'error',
						},
					},
					code: {
						content: outdent`
							asdf(
								1,console.log()
							)
						`,
					},
					fix: true,
				});

				expect(result.warningCount).toBe(0);
				expect(result.errorCount).toBe(1);
				expect(result.output).toBe(
					outdent`
					asdf(
						// eslint-disable-next-line no-console -- Fix later
						1,console.log()
					)
					`,
				);
			});

			test('condensed code', async () => {
				const result = await eslint({
					config: {
						rules: {
							'fix-later/fix-later': ['error', {
								insertDisableComment: 'above-line',
							}],
							'no-console': 'error',
						},
					},
					code: {
						content: 'asdf(1,console.log())',
					},
					fix: true,
				});

				expect(result.warningCount).toBe(0);
				expect(result.errorCount).toBe(1);
				expect(result.output).toBe(
					outdent`
					// eslint-disable-next-line no-console -- Fix later
					asdf(1,console.log())
					`,
				);
			});
		});

		runTestSuite(import('./git-blame.js'));
	});
});
