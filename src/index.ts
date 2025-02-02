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
			commentTemplate: 'Please fix',
		}],
	},
} satisfies Linter.FlatConfig;

export default Object.assign(plugin, {
	configs: {
		recommended,
	},
});
