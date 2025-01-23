import type { ESLint, Linter } from 'eslint';
import { rules } from './rules/index.js';

const plugin = {
	rules,
	configs: {
		recommended: {},
	},
} satisfies ESLint.Plugin;

const recommended = {
	plugins: {
		'fix-later': plugin,
	},
	rules: {
		'fix-later/fix-later': ['warn', {
			insertDisableComment: 'above-line',
			commentTemplate: 'Please fix: {{ codeowner }}',
		}],
	},
} satisfies Linter.Config;

plugin.configs.recommended = recommended;

export default plugin;
