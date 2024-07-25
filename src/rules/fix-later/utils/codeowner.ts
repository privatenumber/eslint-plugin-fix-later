import fs from 'node:fs';
import path from 'node:path';
import { findUpSync } from 'find-up-simple';
import ignore from 'ignore';

const readFileSafe = (filePath: string) => {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch {}
};

const findGitRepo = (
	fromPath: string,
) => {
	const dotGit = findUpSync('.git', {
		cwd: fromPath,
		type: 'directory',
	});
	if (dotGit) {
		return path.dirname(dotGit);
	}
};

const cache = new Map<string, string[][]>();

const getCodeOwnerForGitRepo = (
	repoPath: string,
) => {
	const codeOwners = cache.get(repoPath);
	if (codeOwners) {
		return codeOwners;
	}

	// https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners#codeowners-file-location
	const codeOwnersFile = (
		readFileSafe(path.join(repoPath, '.github/CODEOWNERS'))
		?? readFileSafe(path.join(repoPath, 'CODEOWNERS'))
		?? readFileSafe(path.join(repoPath, 'docs/CODEOWNERS'))
	);
	if (!codeOwnersFile) {
		return;
	}

	const entries = codeOwnersFile
		.split('\n')
		.filter(line => !line.startsWith('#') && line.trim() !== '')
		.map(line => line.split(/\s+/, 2))
		.reverse(); // Latest match takes precedence

	cache.set(repoPath, entries);
	return entries;
};

export const getCodeOwner = (
	filePath: string,
) => {
	const gitRepo = findGitRepo(filePath);
	if (!gitRepo) {
		return;
	}

	const codeOwners = getCodeOwnerForGitRepo(gitRepo);
	if (!codeOwners) {
		return;
	}

	const relativeFilepath = path.relative(gitRepo, filePath);
	const foundMatch = codeOwners.find(([pattern]) => {
		const ig = ignore().add(pattern);
		return ig.ignores(relativeFilepath);
	});

	if (foundMatch) {
		return foundMatch[1];
	}
};
