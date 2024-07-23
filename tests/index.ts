import { describe } from 'manten';
import { eslintVersions } from './utils/eslint-versions.js';

for (const eslint of eslintVersions) {
	describe('suppress errors', ({ runTestSuite }) => {
		runTestSuite(import('./specs/basic-usage.js'), eslint);
		// runTestSuite(import('./specs/insert-disable-comment/index.js'), eslint);
	});
}
