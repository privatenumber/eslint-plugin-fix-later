import type { ESLint, Linter } from 'eslint';
import { rules } from './rules/index.js';

const plugin: ESLint.Plugin = { rules };

const recommended = {
	plugins: {
		'fix-later': plugin,
	},
	rules: {
		'fix-later/fix-later': ['warn', {
			insertDisableComment: 'above-line',
			commentTemplate: 'Fix later',
		}],
	},
} satisfies Linter.FlatConfig;

export default Object.assign(plugin, {
	configs: {
		recommended,
	},
});
