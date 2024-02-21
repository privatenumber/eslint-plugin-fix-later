import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'child_process';

const stringEncoding: SpawnSyncOptionsWithStringEncoding = {
	encoding: 'utf8',
};

const getGitUser = () => {
	const name = spawnSync('git', ['config', 'user.name'], stringEncoding);
	const email = spawnSync('git', ['config', 'user.email'], stringEncoding);
	return {
		name: name.stdout.trim(),
		email: email.stdout.trim(),
	};
};

export type GitBlame = {
	author: string;
	'author-mail': string;
};

const parseGitBlameOutput = (
	stdout: string,
) => {
	const lines = stdout.split('\n');
	const blameData = lines.slice(1, 9);
	const data = Object.fromEntries(
		blameData.map((line) => {
			const firstSpace = line.indexOf(' ');

			return [
				line.slice(0, firstSpace),
				line.slice(firstSpace + 1),
			];
		}),
	) as GitBlame;

	if (stdout.includes('<not.committed.yet>')) {
		const user = getGitUser();
		if (data['author-mail'] === '<not.committed.yet>') {
			data.author = user.name;
			data['author-mail'] = user.email;
		}
	}

	// Sometimes, the email is wrapped in <>
	const authorMail = data['author-mail'];
	if (
		authorMail.startsWith('<')
		&& authorMail.endsWith('>')
	) {
		data['author-mail'] = authorMail.slice(1, -1);
	}

	return data;
};

export const gitBlame = (
	filePath: string,
	startLine: number,
	endLine: number,
) => {
	const blame = spawnSync(
		'git',
		[
			'blame',
			'--porcelain',
			'-L',
			`${startLine},${endLine}`,
			filePath,
		],
		stringEncoding,
	);

	if (blame.status !== 0) {
		throw new Error(`Failed to "git blame": ${blame.stderr}`);
	}

	return parseGitBlameOutput(blame.stdout);
};
