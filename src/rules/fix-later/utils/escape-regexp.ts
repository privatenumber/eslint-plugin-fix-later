export const escapeRegExp = (
	string: string,
) => string.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
