export const escapeRegExp = (
	string: string,
) => string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
