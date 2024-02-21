export const kebabCase = (
	string: string,
) => string.replaceAll(/[A-Z]/g, match => `-${match.toLowerCase()}`);

export const kebabKeys = <CamelKeys extends Record<string, unknown>>(
	object: CamelKeys,
) => Object.fromEntries(
		Object.entries(object).map(
			([key, value]) => [kebabCase(key), value],
		),
	) as CamelKeys;
