import type { ESLint } from 'eslint';
import { rules } from './rules/index.js';

const plugin = {
	rules,
} satisfies ESLint.Plugin;

export default plugin;
