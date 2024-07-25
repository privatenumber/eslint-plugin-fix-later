import type { SourceCode } from 'eslint';
import type { AST } from 'vue-eslint-parser';

declare module 'eslint' {

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
	}


	interface SourceCode {
		parserServices: {
			getDocumentFragment?: () => AST.VDocumentFragment;
		};
	}
}
