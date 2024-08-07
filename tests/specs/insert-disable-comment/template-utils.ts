import path from 'path';
import { testSuite, expect } from 'manten';
import outdent from 'outdent';
import { createFixture } from 'fs-fixture';
import { execa } from 'execa';
import { eslint } from '../../utils/eslint.js';

export default testSuite(({ describe }, eslintPath: string) => {
	describe('template utils', async ({ describe, test, onFinish }) => {
		const fixture = await createFixture({
			'file.js': 'console.log()',
			node_modules: ({ symlink }) => symlink(path.resolve('./node_modules')),
			'.github/CODEOWNERS': 'file.js @johndoe',
		});
		onFinish(() => fixture.rm());

		await describe('git blame', async ({ test }) => {
			await test('No git project', async () => {
				await expect(
					() => eslint(eslintPath, {
						config: {
							rules: {
								'fix-later/fix-later': ['error', {
									commentTemplate: '{{ blame.author }} {{ blame.author-mail }}',
								}],
								'no-console': 'error',
							},
						},
						code: {
							content: 'console.log()',
						},
						cwd: fixture.path,
						fix: true,
					}),
				).rejects.toThrow('not a git repository');
			});

			// Setup git
			await execa('git', ['init'], { cwd: fixture.path });
			await execa('git', ['config', 'user.name', 'John Doe'], { cwd: fixture.path });
			await execa('git', ['config', 'user.email', 'john@doe.org'], { cwd: fixture.path });

			await execa('git', ['commit', '--allow-empty', '-m', 'test'], { cwd: fixture.path });

			await test('Unchecked file', async () => {
				await expect(
					() => eslint(eslintPath, {
						config: {
							rules: {
								'fix-later/fix-later': ['error', {
									commentTemplate: '{{ blame.author }} {{ blame.author-mail }}',
								}],
								'no-console': 'error',
							},
						},
						code: 'file.js',
						cwd: fixture.path,
						fix: true,
					}),
				).rejects.toThrow('no such path \'file.js\' in HEAD');
			});

			// Add file
			await execa('git', ['add', 'file.js'], { cwd: fixture.path });

			await test('Uncommitted file - gets current git user', async () => {
				const result = await eslint(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								commentTemplate: '{{ blame.author }} <{{ blame.author-mail }}>',
							}],
							'no-console': 'error',
						},
					},
					code: 'file.js',
					cwd: fixture.path,
					fix: true,
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);
				expect(result.output).toBe(
					outdent`
					console.log() // eslint-disable-line no-console -- John Doe <john@doe.org>
					`,
				);
			});

			await execa('git', ['commit', '-am', 'a'], { cwd: fixture.path });

			await test('Committed file', async () => {
				const result = await eslint(eslintPath, {
					config: {
						rules: {
							'fix-later/fix-later': ['warn', {
								commentTemplate: '{{ blame.author }} <{{ blame.author-mail }}>',
							}],
							'no-console': 'error',
						},
					},
					code: 'file.js',
					cwd: fixture.path,
					fix: true,
				});

				expect(result.warningCount).toBe(1);
				expect(result.errorCount).toBe(0);
				expect(result.output).toBe(
					outdent`
					console.log() // eslint-disable-line no-console -- John Doe <john@doe.org>
					`,
				);
			});
		});

		test('CODEOWNERS', async () => {
			const result = await eslint(eslintPath, {
				config: {
					rules: {
						'fix-later/fix-later': ['warn', {
							commentTemplate: 'TODO: {{ codeowner }}',
						}],
						'no-console': 'error',
					},
				},
				code: 'file.js',
				cwd: fixture.path,
				fix: true,
			});

			expect(result.warningCount).toBe(1);
			expect(result.errorCount).toBe(0);
			expect(result.output).toBe(
				outdent`
				console.log() // eslint-disable-line no-console -- TODO: @johndoe
				`,
			);
		});
	});
});
