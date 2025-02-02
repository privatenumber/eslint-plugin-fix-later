import type { AST } from 'vue-eslint-parser';
import { ConfigArray } from '@eslint/config-array';

declare module 'eslint' {
	class FlatConfigArray extends ConfigArray {}

	type LintMessage = Linter.LintMessage | Linter.SuppressedLintMessage;
	interface Linter {
		// https://github.com/eslint/eslint/blob/8e8e9f8476d701e4e981b9b4d9957e5d4855e530/lib/linter/linter.js#L1253
		_verifyWithoutProcessors(
			textOrSourceCode: string | SourceCode,
			config: Linter.Config,
			options: Linter.FixOptions,
		): LintMessage[];

		// https://github.com/eslint/eslint/blob/8e8e9f8476d701e4e981b9b4d9957e5d4855e530/lib/linter/linter.js#L1872
		_verifyWithProcessor(
			textOrSourceCode: string | SourceCode,
			config: Linter.Config,
			options: Linter.FixOptions,
		): LintMessage[];

		_verifyWithFlatConfigArray(
			textOrSourceCode: string | SourceCode,
			config: FlatConfigArray,
			options: Linter.FixOptions,
			firstCall: boolean,
		): LintMessage[];
	}

	interface SourceCode {
		parserServices: {
			getDocumentFragment?: () => AST.VDocumentFragment;
		};
	}
}
