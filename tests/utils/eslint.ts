import path from 'path';
import fs from 'fs/promises';
import { execa } from 'execa';
import type { ESLint } from 'eslint';
import { name } from '../../package.json';

type StdIn = {
	name?: string;
	content: string;
};

type Options = {
	ruleConfig: Record<string, unknown>;
	code: string | StdIn;
	cwd?: string;
	fix?: boolean;
};

export const eslint = async (
	{
		cwd = process.cwd(),
		ruleConfig,
		code,
		fix,
	}: Options,
) => {
	const packageInstallPath = path.resolve(cwd, 'node_modules', name);
	const packageInstalled = await fs.lstat(packageInstallPath).then(() => true, () => false);
	if (!packageInstalled) {
		await fs.mkdir(path.dirname(packageInstallPath), { recursive: true });
		try {
			await fs.symlink(
				process.cwd(),
				packageInstallPath,
			);
		} catch {}
	}

	const rules = Object.entries(ruleConfig)
		.flatMap(
			(([ruleName, config]) => ['--rule', `${ruleName}:${JSON.stringify(config)}`]),
		);

	const eslintArgs = [
		'--no-eslintrc',
		'--plugin',
		name,
		...rules,
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

	const eslintProcess = execa(
		'eslint',
		eslintArgs,
		{
			cwd,
			all: true,
			stdio: 'pipe',
			reject: false,
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
