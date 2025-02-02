import path from 'path';
import { execaNode } from 'execa';
import type { ESLint, Linter } from 'eslint';
import { createFixture } from 'fs-fixture';
import { installSelfPackage } from './install-self-package.js';
import { addConfig } from './eslint-config.js';

export const eslintRaw = (
	eslintName: string,
	eslintArgs: string[],
	cwd: string,
) => execaNode(
	path.resolve(`./node_modules/${eslintName}/bin/eslint.js`),
	[
		'--format=json',
		...eslintArgs,
	],
	{
		cwd,
		all: true,
		stdio: 'pipe',
		reject: false,
		nodeOptions: ['--import', 'alias-imports', '-C', eslintName],
	},
);

// TODO: Add string type
type Code = {
	name?: string;
	content: string;
};

const nodeModulesPath = path.resolve('./node_modules');
const installingSelf = installSelfPackage();

type Options = {
	config: Linter.Config;
	code: Code;
	fix?: boolean;
	fixType?: 'directive';
};
export const eslint = async (
	eslintName: string,
	{
		config: configRaw,
		code,
		fix,
		fixType,
	}: Options,
) => {
	await installingSelf;

	await using fixture = await createFixture({
		node_modules: ({ symlink }) => symlink(nodeModulesPath),
	});

	const configArgs = await addConfig(eslintName, fixture, configRaw);
	const eslintArgs = [
		...configArgs,
	];

	if (fix) {
		eslintArgs.push('--fix-dry-run');
		if (fixType) {
			eslintArgs.push(`--fix-type=${fixType}`);
		}
	}

	const filename = code.name || 'file.js';
	await fixture.writeFile(filename, code.content);
	eslintArgs.push(fixture.getPath(filename));

	const processResult = await eslintRaw(
		eslintName,
		eslintArgs,
		fixture.path,
	);

	let results: ESLint.LintResult[];
	try {
		results = JSON.parse(processResult.all!) as ESLint.LintResult[];
	} catch {
		throw processResult;
	}

	const [firstFile] = results;
	return firstFile;
};
