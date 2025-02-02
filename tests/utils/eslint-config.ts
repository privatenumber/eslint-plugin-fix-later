import type { Linter } from 'eslint';
import type { FsFixture } from 'fs-fixture';
import { name } from '../../package.json';

const addFlatConfig = async (
	fixture: FsFixture,
	configRaw: Linter.Config,
) => {
	const configName = 'eslint.config.mjs';

	await fixture.writeFile(configName, `
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
		`);

	return [
		'--no-config-lookup',
		'-c',
		configName,
	];
};

const addESlintrcConfig = async (
	fixture: FsFixture,
	configRaw: Linter.Config,
) => {
	const configName = 'config.json';

	await fixture.writeFile(
		configName,
		JSON.stringify({
			root: true,
			plugins: [
				name,
			],
			...configRaw,
		}),
	);

	return [
		'--no-eslintrc',
		'-c',
		configName,
	];
};

export const addConfig = async (
	eslintName: string,
	fixture: FsFixture,
	configRaw: Linter.Config,
) => (eslintName === 'eslint9'
	? addFlatConfig(fixture, configRaw)
	: addESlintrcConfig(fixture, configRaw));
