import path from 'path';
import { execaNode } from 'execa';
import type { ESLint, Linter } from 'eslint';
import { name } from '../../package.json';
import { installSelfPackage } from './install-self-package.js';
import { createEslintConfig } from './create-eslint-config.js';
import { createFixture } from 'fs-fixture';

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

export const eslint = async (
	eslintName: string,
	{
		cwd = process.cwd(),
		config: configRaw,
		code,
		fix,
		fixType,
	}: Options,
) => {
	await installSelfPackage(process.cwd());

	const fixture = await createFixture({
		'node_modules': ({ symlink }) => symlink(path.resolve(`./node_modules`)),
		'config.json': JSON.stringify({
			root: true,
			plugins: [
				name,
			],
			...configRaw,
		}),
	});

	console.log(fixture);

	const eslintArgs = [
		'-c',
		fixture.getPath('config.json'),
		'--no-eslintrc',
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

	const eslintProcess = execaNode(
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
