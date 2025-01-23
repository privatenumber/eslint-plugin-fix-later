import type { ESLint } from 'eslint';
import { fixLater } from './fix-later/index.js';

export const rules = {
	'fix-later': fixLater,
} satisfies ESLint.Plugin['rules'];
