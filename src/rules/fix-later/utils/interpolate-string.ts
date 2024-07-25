import { getProperty } from 'dot-prop';

// eslint-disable-next-line regexp/no-super-linear-backtracking
const handlebarPattern = /\{\{\s*(.+?)\s*\}\}/g;

export const interpolateString = (
	template: string,
	data: Record<string, unknown>,
	onMissingKey: (match: string, key: string) => string,
) => {
	if (!handlebarPattern.test(template)) {
		return template;
	}

	return template.replaceAll(handlebarPattern, (match, key) => {
		const value = getProperty(data, key) as unknown as string | undefined;
		return value ?? onMissingKey(match, key);
	});
};
