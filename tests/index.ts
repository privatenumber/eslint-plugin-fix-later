import { describe } from 'manten';

describe('suppress errors', ({ runTestSuite }) => {
	runTestSuite(import('./specs/basic-usage.js'));
	runTestSuite(import('./specs/insert-disable-comment/index.js'));
});
