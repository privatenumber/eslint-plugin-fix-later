import { getProperty } from 'dot-prop';

// eslint-disable-next-line regexp/no-super-linear-backtracking
const handlebarPattern = /\{\{\s*(.+?)\s*\}\}/g;

export const interpolateString = (
	string: string,
	data: Record<string, unknown>,
	onMissingKey: (match: string, key: string) => string,
) => {
	if (!handlebarPattern.test(string)) {
		return string;
	}

	return string.replaceAll(handlebarPattern, (match, key) => {
		const value = getProperty(data, key) as unknown as string | undefined;
		return value ?? onMissingKey(match, key);
	});
};
