import path from 'path';
import { execaNode } from 'execa';
import type { ESLint, Linter } from 'eslint';
import { createFixture } from 'fs-fixture';
import { name } from '../../package.json';
import { installSelfPackage } from './install-self-package.js';

export const eslintRaw = (
	eslintName: string,
	eslintArgs: string[],
	cwd: string,
) => execaNode(
	path.resolve(`./node_modules/${eslintName}/bin/eslint.js`),
	eslintArgs,
	{
		cwd,
		all: true,
		stdio: 'pipe',
		reject: false,
		nodeOptions: ['--import', 'alias-imports', '-C', eslintName],
	},
);

type StdIn = {
	name?: string;
	content: string;
};

type Options = {
	config: Linter.Config;
	code: string | StdIn;
	cwd?: string;
	fix?: boolean;
	fixType?: 'directive';
};

const nodeModulesPath = path.resolve('./node_modules');

export const eslint = async (
	eslintName: string,
	{
		cwd,
		config: configRaw,
		code,
		fix,
		fixType,
	}: Options,
) => {
	await installSelfPackage();

	await using fixture = await createFixture({
		node_modules: ({ symlink }) => symlink(nodeModulesPath),
		...(
			eslintName === 'eslint9'
				? {
					'eslint.config.mjs': `
					import fixLater from '${name}'
					import { FlatCompat } from '@eslint/eslintrc';

					export default [
						{
							plugins: {
								'fix-later': fixLater,
							},
						},
						...new FlatCompat().config(${JSON.stringify(configRaw)})
					];
					`,
				}
				: {
					'config.json': JSON.stringify({
						root: true,
						plugins: [
							name,
						],
						...configRaw,
					}),
				}
		),
	});

	const eslintArgs = [
		...(
			eslintName === 'eslint9'
				? [
					'--no-config-lookup',
					'-c',
					'eslint.config.mjs',
				]
				: [
					'--no-eslintrc',
					'-c',
					'config.json',
				]
		),
		'--format=json',
	];

	if (fix) {
		eslintArgs.push('--fix-dry-run');
		if (fixType) {
			eslintArgs.push(`--fix-type=${fixType}`);
		}
	}

	if (typeof code === 'object') {
		const filename = code.name || 'file.js';
		await fixture.writeFile(filename, code.content);
		eslintArgs.push(fixture.getPath(filename));
	} else {
		eslintArgs.push(code);
	}

	const eslintProcess = eslintRaw(
		eslintName,
		eslintArgs,
		cwd ?? fixture.path,
	);

	if (typeof code === 'object') {
		eslintProcess.stdin!.end(code.content);
	}

	const processResult = await eslintProcess;

	let results: ESLint.LintResult[];
	try {
		results = JSON.parse(processResult.all!) as ESLint.LintResult[];
	} catch {
		throw processResult;
	}

	const [firstFile] = results;
	return firstFile;
};
