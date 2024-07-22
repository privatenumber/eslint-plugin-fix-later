import path from 'path';
import fs from 'fs/promises';
import type { Linter } from 'eslint';

let counter = Date.now();
export const createEslintConfig = async (
	config: Linter.Config,
) => {
	counter += 1;
	const configFile = path.resolve(`.eslint-config-${counter}.json`);

	await fs.writeFile(
		configFile,
		JSON.stringify(config),
	);

	return {
		path: configFile,
		[Symbol.asyncDispose]: () => fs.rm(configFile),
	};
};
