import path from 'path';
import fs from 'fs/promises';
import { name } from '../../package.json';

const selfPackagePath = process.cwd();

export const installSelfPackage = async (
	cwd: string,
) => {
	const packageInstallPath = path.join(cwd, 'node_modules', name);
	const packageInstalled = await fs.lstat(packageInstallPath).then(() => true, () => false);
	if (packageInstalled) {
		const symlinkedPath = await fs.readlink(packageInstallPath);
		if (symlinkedPath === selfPackagePath) {
			return;
		}
	}

	await fs.mkdir(path.dirname(packageInstallPath), { recursive: true });
	try {
		await fs.symlink(
			selfPackagePath,
			packageInstallPath,
		);
	} catch {}
};
