import type { ESLint } from 'eslint';
import { kebabKeys } from '../utils/kebab-case.js';
import * as fixLater from './fix-later/index.js';

export const rules = kebabKeys({
	...fixLater,
}) satisfies ESLint.Plugin['rules'];
