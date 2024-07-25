import { name } from '../../../package.json';

type RuleOptions = {
	includeWarnings: boolean;
	insertDisableComment: 'above-line' | 'end-of-line';
	disableDirective: '// eslint-disable-line' | '// eslint-disable-next-line';
	commentTemplate: string;
};

// eslint-disable-next-line regexp/no-super-linear-backtracking
export const directiveDescriptionPattern = /--\s*(.*)$/;

export const normalizeOptions = (
	options: RuleOptions | undefined,
): RuleOptions => {
	const insertDisableComment = options?.insertDisableComment ?? 'end-of-line';
	const commentTemplate = options?.commentTemplate ?? 'Fix later';

	if (!commentTemplate) {
		// If there is no description, then it's not discernable from other disable directives
		throw new Error('commentTemplate must include a description (e.g. "Fix later")');
	}

	return {
		includeWarnings: options?.includeWarnings ?? false,
		insertDisableComment,
		disableDirective: (
			insertDisableComment === 'above-line'
				? '// eslint-disable-next-line'
				: '// eslint-disable-line'
		),
		commentTemplate,
	};
};

// Might not work if the rule name is changed via flat config
// So this is updated by `setRuleUsage` below in case it is

// eslint-disable-next-line import-x/no-mutable-exports
export let ruleId = `${name.slice('eslint-config-'.length)}/fix-later`;

// eslint-disable-next-line import-x/no-mutable-exports
export let ruleOptions: RuleOptions | undefined;

export const setRuleUsage = (
	_ruleId: string,
	_ruleOptions: RuleOptions,
) => {
	ruleId = _ruleId;
	ruleOptions = _ruleOptions;
};
