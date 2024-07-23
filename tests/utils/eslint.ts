import path from 'path';
import { execaNode } from 'execa';
import type { ESLint, Linter } from 'eslint';
import { name } from '../../package.json';
import { installSelfPackage } from './install-self-package.js';
import { createEslintConfig } from './create-eslint-config.js';

type StdIn = {
	name?: string;
	content: string;
};

type Options = {
	config: Linter.Config;
	code: string | StdIn;
	cwd?: string;
	fix?: boolean;
};

export const eslint = async (
	eslintName: string,
	{
		cwd = process.cwd(),
		config: configRaw,
		code,
		fix,
	}: Options,
) => {
	await installSelfPackage(cwd);

	await using config = await createEslintConfig({
		root: true,
		plugins: [
			name,
		],
		...configRaw,
	});

	const eslintArgs = [
		'-c',
		config.path,
		'--no-eslintrc',
		'--format=json',
	];

	if (fix) {
		eslintArgs.push('--fix-dry-run');
	}

	if (typeof code === 'object') {
		eslintArgs.push(
			'--stdin',
			'--stdin-filename',
			code.name || 'file.js',
		);
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
			nodeOptions: ['--import', 'alias-imports', '-C', eslintName]
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
