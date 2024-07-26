'use strict';

var eslint = require('eslint');
var child_process = require('child_process');
var fs = require('node:fs');
var path = require('node:path');
var process$1 = require('node:process');
require('node:fs/promises');
var node_url = require('node:url');
var module$1 = require('module');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const kebabCase = (string) => string.replaceAll(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const kebabKeys = (object) => Object.fromEntries(
  Object.entries(object).map(
    ([key, value]) => [kebabCase(key), value]
  )
);

const getSeverity = (ruleLevel) => {
  switch (ruleLevel) {
    case 2:
    case "error": {
      return 2;
    }
    case 1:
    case "warn": {
      return 1;
    }
    default: {
      return 0;
    }
  }
};

const insertCommentAboveLine = (code, lineStart, comment) => {
  const indentation = code.slice(lineStart).match(/^[\t ]*/)[0];
  return {
    range: [lineStart, lineStart],
    text: `${indentation}${comment}
`
  };
};
const insertCommentSameLine = (code, lineStart, comment) => {
  const nextLineIndex = code.slice(lineStart).indexOf("\n");
  const insertAt = nextLineIndex === -1 ? code.length : lineStart + nextLineIndex;
  return {
    range: [insertAt, insertAt],
    text: ` ${comment}`
  };
};

const stringEncoding = {
  encoding: "utf8"
};
const getGitUser = () => {
  const name = child_process.spawnSync("git", ["config", "user.name"], stringEncoding);
  const email = child_process.spawnSync("git", ["config", "user.email"], stringEncoding);
  return {
    name: name.stdout.trim(),
    email: email.stdout.trim()
  };
};
const parseGitBlameOutput = (stdout) => {
  const lines = stdout.split("\n");
  const blameData = lines.slice(1, 9);
  const data = Object.fromEntries(
    blameData.map((line) => {
      const firstSpace = line.indexOf(" ");
      return [
        line.slice(0, firstSpace),
        line.slice(firstSpace + 1)
      ];
    })
  );
  if (stdout.includes("<not.committed.yet>")) {
    const user = getGitUser();
    if (data["author-mail"] === "<not.committed.yet>") {
      data.author = user.name;
      data["author-mail"] = user.email;
    }
  }
  const authorMail = data["author-mail"];
  if (authorMail.startsWith("<") && authorMail.endsWith(">")) {
    data["author-mail"] = authorMail.slice(1, -1);
  }
  return data;
};
const gitBlame = (filePath, startLine, endLine) => {
  const blame = child_process.spawnSync(
    "git",
    [
      "blame",
      "--porcelain",
      "-L",
      `${startLine},${endLine}`,
      filePath
    ],
    stringEncoding
  );
  if (blame.status !== 0) {
    throw new Error(`Failed to "git blame": ${blame.stderr}`);
  }
  return parseGitBlameOutput(blame.stdout);
};

const toPath = urlOrPath => urlOrPath instanceof URL ? node_url.fileURLToPath(urlOrPath) : urlOrPath;

function findUpSync(name, {
	cwd = process$1.cwd(),
	type = 'file',
	stopAt,
} = {}) {
	let directory = path.resolve(toPath(cwd) ?? '');
	const {root} = path.parse(directory);
	stopAt = path.resolve(directory, toPath(stopAt) ?? root);

	while (directory && directory !== stopAt && directory !== root) {
		const filePath = path.isAbsolute(name) ? name : path.join(directory, name);

		try {
			const stats = fs.statSync(filePath, {throwIfNoEntry: false});
			if ((type === 'file' && stats?.isFile()) || (type === 'directory' && stats?.isDirectory())) {
				return filePath;
			}
		} catch {}

		directory = path.dirname(directory);
	}
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

// A simple implementation of make-array
function makeArray (subject) {
  return Array.isArray(subject)
    ? subject
    : [subject]
}

const EMPTY = '';
const SPACE = ' ';
const ESCAPE = '\\';
const REGEX_TEST_BLANK_LINE = /^\s+$/;
const REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
const REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
const REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
const REGEX_SPLITALL_CRLF = /\r?\n/g;
// /foo,
// ./foo,
// ../foo,
// .
// ..
const REGEX_TEST_INVALID_PATH = /^\.*\/|^\.+$/;

const SLASH = '/';

// Do not use ternary expression here, since "istanbul ignore next" is buggy
let TMP_KEY_IGNORE = 'node-ignore';
/* istanbul ignore else */
if (typeof Symbol !== 'undefined') {
  TMP_KEY_IGNORE = Symbol.for('node-ignore');
}
const KEY_IGNORE = TMP_KEY_IGNORE;

const define = (object, key, value) =>
  Object.defineProperty(object, key, {value});

const REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;

const RETURN_FALSE = () => false;

// Sanitize the range of a regular expression
// The cases are complicated, see test cases for details
const sanitizeRange = range => range.replace(
  REGEX_REGEXP_RANGE,
  (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0)
    ? match
    // Invalid range (out of order) which is ok for gitignore rules but
    //   fatal for JavaScript regular expression, so eliminate it.
    : EMPTY
);

// See fixtures #59
const cleanRangeBackSlash = slashes => {
  const {length} = slashes;
  return slashes.slice(0, length - length % 2)
};

// > If the pattern ends with a slash,
// > it is removed for the purpose of the following description,
// > but it would only find a match with a directory.
// > In other words, foo/ will match a directory foo and paths underneath it,
// > but will not match a regular file or a symbolic link foo
// >  (this is consistent with the way how pathspec works in general in Git).
// '`foo/`' will not match regular file '`foo`' or symbolic link '`foo`'
// -> ignore-rules will not deal with it, because it costs extra `fs.stat` call
//      you could use option `mark: true` with `glob`

// '`foo/`' should not continue with the '`..`'
const REPLACERS = [

  [
    // remove BOM
    // TODO:
    // Other similar zero-width characters?
    /^\uFEFF/,
    () => EMPTY
  ],

  // > Trailing spaces are ignored unless they are quoted with backslash ("\")
  [
    // (a\ ) -> (a )
    // (a  ) -> (a)
    // (a \ ) -> (a  )
    /\\?\s+$/,
    match => match.indexOf('\\') === 0
      ? SPACE
      : EMPTY
  ],

  // replace (\ ) with ' '
  [
    /\\\s/g,
    () => SPACE
  ],

  // Escape metacharacters
  // which is written down by users but means special for regular expressions.

  // > There are 12 characters with special meanings:
  // > - the backslash \,
  // > - the caret ^,
  // > - the dollar sign $,
  // > - the period or dot .,
  // > - the vertical bar or pipe symbol |,
  // > - the question mark ?,
  // > - the asterisk or star *,
  // > - the plus sign +,
  // > - the opening parenthesis (,
  // > - the closing parenthesis ),
  // > - and the opening square bracket [,
  // > - the opening curly brace {,
  // > These special characters are often called "metacharacters".
  [
    /[\\$.|*+(){^]/g,
    match => `\\${match}`
  ],

  [
    // > a question mark (?) matches a single character
    /(?!\\)\?/g,
    () => '[^/]'
  ],

  // leading slash
  [

    // > A leading slash matches the beginning of the pathname.
    // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
    // A leading slash matches the beginning of the pathname
    /^\//,
    () => '^'
  ],

  // replace special metacharacter slash after the leading slash
  [
    /\//g,
    () => '\\/'
  ],

  [
    // > A leading "**" followed by a slash means match in all directories.
    // > For example, "**/foo" matches file or directory "foo" anywhere,
    // > the same as pattern "foo".
    // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
    // >   under directory "foo".
    // Notice that the '*'s have been replaced as '\\*'
    /^\^*\\\*\\\*\\\//,

    // '**/foo' <-> 'foo'
    () => '^(?:.*\\/)?'
  ],

  // starting
  [
    // there will be no leading '/'
    //   (which has been replaced by section "leading slash")
    // If starts with '**', adding a '^' to the regular expression also works
    /^(?=[^^])/,
    function startingReplacer () {
      // If has a slash `/` at the beginning or middle
      return !/\/(?!$)/.test(this)
        // > Prior to 2.22.1
        // > If the pattern does not contain a slash /,
        // >   Git treats it as a shell glob pattern
        // Actually, if there is only a trailing slash,
        //   git also treats it as a shell glob pattern

        // After 2.22.1 (compatible but clearer)
        // > If there is a separator at the beginning or middle (or both)
        // > of the pattern, then the pattern is relative to the directory
        // > level of the particular .gitignore file itself.
        // > Otherwise the pattern may also match at any level below
        // > the .gitignore level.
        ? '(?:^|\\/)'

        // > Otherwise, Git treats the pattern as a shell glob suitable for
        // >   consumption by fnmatch(3)
        : '^'
    }
  ],

  // two globstars
  [
    // Use lookahead assertions so that we could match more than one `'/**'`
    /\\\/\\\*\\\*(?=\\\/|$)/g,

    // Zero, one or several directories
    // should not use '*', or it will be replaced by the next replacer

    // Check if it is not the last `'/**'`
    (_, index, str) => index + 6 < str.length

      // case: /**/
      // > A slash followed by two consecutive asterisks then a slash matches
      // >   zero or more directories.
      // > For example, "a/**/b" matches "a/b", "a/x/b", "a/x/y/b" and so on.
      // '/**/'
      ? '(?:\\/[^\\/]+)*'

      // case: /**
      // > A trailing `"/**"` matches everything inside.

      // #21: everything inside but it should not include the current folder
      : '\\/.+'
  ],

  // normal intermediate wildcards
  [
    // Never replace escaped '*'
    // ignore rule '\*' will match the path '*'

    // 'abc.*/' -> go
    // 'abc.*'  -> skip this rule,
    //    coz trailing single wildcard will be handed by [trailing wildcard]
    /(^|[^\\]+)(\\\*)+(?=.+)/g,

    // '*.js' matches '.js'
    // '*.js' doesn't match 'abc'
    (_, p1, p2) => {
      // 1.
      // > An asterisk "*" matches anything except a slash.
      // 2.
      // > Other consecutive asterisks are considered regular asterisks
      // > and will match according to the previous rules.
      const unescaped = p2.replace(/\\\*/g, '[^\\/]*');
      return p1 + unescaped
    }
  ],

  [
    // unescape, revert step 3 except for back slash
    // For example, if a user escape a '\\*',
    // after step 3, the result will be '\\\\\\*'
    /\\\\\\(?=[$.|*+(){^])/g,
    () => ESCAPE
  ],

  [
    // '\\\\' -> '\\'
    /\\\\/g,
    () => ESCAPE
  ],

  [
    // > The range notation, e.g. [a-zA-Z],
    // > can be used to match one of the characters in a range.

    // `\` is escaped by step 3
    /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
    (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE
      // '\\[bar]' -> '\\\\[bar\\]'
      ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}`
      : close === ']'
        ? endEscape.length % 2 === 0
          // A normal case, and it is a range notation
          // '[bar]'
          // '[bar\\\\]'
          ? `[${sanitizeRange(range)}${endEscape}]`
          // Invalid range notaton
          // '[bar\\]' -> '[bar\\\\]'
          : '[]'
        : '[]'
  ],

  // ending
  [
    // 'js' will not match 'js.'
    // 'ab' will not match 'abc'
    /(?:[^*])$/,

    // WTF!
    // https://git-scm.com/docs/gitignore
    // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
    // which re-fixes #24, #38

    // > If there is a separator at the end of the pattern then the pattern
    // > will only match directories, otherwise the pattern can match both
    // > files and directories.

    // 'js*' will not match 'a.js'
    // 'js/' will not match 'a.js'
    // 'js' will match 'a.js' and 'a.js/'
    match => /\/$/.test(match)
      // foo/ will not match 'foo'
      ? `${match}$`
      // foo matches 'foo' and 'foo/'
      : `${match}(?=$|\\/$)`
  ],

  // trailing wildcard
  [
    /(\^|\\\/)?\\\*$/,
    (_, p1) => {
      const prefix = p1
        // '\^':
        // '/*' does not match EMPTY
        // '/*' does not match everything

        // '\\\/':
        // 'abc/*' does not match 'abc/'
        ? `${p1}[^/]+`

        // 'a*' matches 'a'
        // 'a*' matches 'aa'
        : '[^/]*';

      return `${prefix}(?=$|\\/$)`
    }
  ],
];

// A simple cache, because an ignore rule only has only one certain meaning
const regexCache = Object.create(null);

// @param {pattern}
const makeRegex = (pattern, ignoreCase) => {
  let source = regexCache[pattern];

  if (!source) {
    source = REPLACERS.reduce(
      (prev, current) => prev.replace(current[0], current[1].bind(pattern)),
      pattern
    );
    regexCache[pattern] = source;
  }

  return ignoreCase
    ? new RegExp(source, 'i')
    : new RegExp(source)
};

const isString = subject => typeof subject === 'string';

// > A blank line matches no files, so it can serve as a separator for readability.
const checkPattern = pattern => pattern
  && isString(pattern)
  && !REGEX_TEST_BLANK_LINE.test(pattern)
  && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern)

  // > A line starting with # serves as a comment.
  && pattern.indexOf('#') !== 0;

const splitPattern = pattern => pattern.split(REGEX_SPLITALL_CRLF);

class IgnoreRule {
  constructor (
    origin,
    pattern,
    negative,
    regex
  ) {
    this.origin = origin;
    this.pattern = pattern;
    this.negative = negative;
    this.regex = regex;
  }
}

const createRule = (pattern, ignoreCase) => {
  const origin = pattern;
  let negative = false;

  // > An optional prefix "!" which negates the pattern;
  if (pattern.indexOf('!') === 0) {
    negative = true;
    pattern = pattern.substr(1);
  }

  pattern = pattern
  // > Put a backslash ("\") in front of the first "!" for patterns that
  // >   begin with a literal "!", for example, `"\!important!.txt"`.
  .replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, '!')
  // > Put a backslash ("\") in front of the first hash for patterns that
  // >   begin with a hash.
  .replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, '#');

  const regex = makeRegex(pattern, ignoreCase);

  return new IgnoreRule(
    origin,
    pattern,
    negative,
    regex
  )
};

const throwError = (message, Ctor) => {
  throw new Ctor(message)
};

const checkPath = (path, originalPath, doThrow) => {
  if (!isString(path)) {
    return doThrow(
      `path must be a string, but got \`${originalPath}\``,
      TypeError
    )
  }

  // We don't know if we should ignore EMPTY, so throw
  if (!path) {
    return doThrow(`path must not be empty`, TypeError)
  }

  // Check if it is a relative path
  if (checkPath.isNotRelative(path)) {
    const r = '`path.relative()`d';
    return doThrow(
      `path should be a ${r} string, but got "${originalPath}"`,
      RangeError
    )
  }

  return true
};

const isNotRelative = path => REGEX_TEST_INVALID_PATH.test(path);

checkPath.isNotRelative = isNotRelative;
checkPath.convert = p => p;

class Ignore {
  constructor ({
    ignorecase = true,
    ignoreCase = ignorecase,
    allowRelativePaths = false
  } = {}) {
    define(this, KEY_IGNORE, true);

    this._rules = [];
    this._ignoreCase = ignoreCase;
    this._allowRelativePaths = allowRelativePaths;
    this._initCache();
  }

  _initCache () {
    this._ignoreCache = Object.create(null);
    this._testCache = Object.create(null);
  }

  _addPattern (pattern) {
    // #32
    if (pattern && pattern[KEY_IGNORE]) {
      this._rules = this._rules.concat(pattern._rules);
      this._added = true;
      return
    }

    if (checkPattern(pattern)) {
      const rule = createRule(pattern, this._ignoreCase);
      this._added = true;
      this._rules.push(rule);
    }
  }

  // @param {Array<string> | string | Ignore} pattern
  add (pattern) {
    this._added = false;

    makeArray(
      isString(pattern)
        ? splitPattern(pattern)
        : pattern
    ).forEach(this._addPattern, this);

    // Some rules have just added to the ignore,
    // making the behavior changed.
    if (this._added) {
      this._initCache();
    }

    return this
  }

  // legacy
  addPattern (pattern) {
    return this.add(pattern)
  }

  //          |           ignored : unignored
  // negative |   0:0   |   0:1   |   1:0   |   1:1
  // -------- | ------- | ------- | ------- | --------
  //     0    |  TEST   |  TEST   |  SKIP   |    X
  //     1    |  TESTIF |  SKIP   |  TEST   |    X

  // - SKIP: always skip
  // - TEST: always test
  // - TESTIF: only test if checkUnignored
  // - X: that never happen

  // @param {boolean} whether should check if the path is unignored,
  //   setting `checkUnignored` to `false` could reduce additional
  //   path matching.

  // @returns {TestResult} true if a file is ignored
  _testOne (path, checkUnignored) {
    let ignored = false;
    let unignored = false;

    this._rules.forEach(rule => {
      const {negative} = rule;
      if (
        unignored === negative && ignored !== unignored
        || negative && !ignored && !unignored && !checkUnignored
      ) {
        return
      }

      const matched = rule.regex.test(path);

      if (matched) {
        ignored = !negative;
        unignored = negative;
      }
    });

    return {
      ignored,
      unignored
    }
  }

  // @returns {TestResult}
  _test (originalPath, cache, checkUnignored, slices) {
    const path = originalPath
      // Supports nullable path
      && checkPath.convert(originalPath);

    checkPath(
      path,
      originalPath,
      this._allowRelativePaths
        ? RETURN_FALSE
        : throwError
    );

    return this._t(path, cache, checkUnignored, slices)
  }

  _t (path, cache, checkUnignored, slices) {
    if (path in cache) {
      return cache[path]
    }

    if (!slices) {
      // path/to/a.js
      // ['path', 'to', 'a.js']
      slices = path.split(SLASH);
    }

    slices.pop();

    // If the path has no parent directory, just test it
    if (!slices.length) {
      return cache[path] = this._testOne(path, checkUnignored)
    }

    const parent = this._t(
      slices.join(SLASH) + SLASH,
      cache,
      checkUnignored,
      slices
    );

    // If the path contains a parent directory, check the parent first
    return cache[path] = parent.ignored
      // > It is not possible to re-include a file if a parent directory of
      // >   that file is excluded.
      ? parent
      : this._testOne(path, checkUnignored)
  }

  ignores (path) {
    return this._test(path, this._ignoreCache, false).ignored
  }

  createFilter () {
    return path => !this.ignores(path)
  }

  filter (paths) {
    return makeArray(paths).filter(this.createFilter())
  }

  // @returns {TestResult}
  test (path) {
    return this._test(path, this._testCache, true)
  }
}

const factory = options => new Ignore(options);

const isPathValid = path =>
  checkPath(path && checkPath.convert(path), path, RETURN_FALSE);

factory.isPathValid = isPathValid;

// Fixes typescript
factory.default = factory;

var ignore = factory;

// Windows
// --------------------------------------------------------------
/* istanbul ignore if */
if (
  // Detect `process` so that it can run in browsers.
  typeof process !== 'undefined'
  && (
    process.env && process.env.IGNORE_TEST_WIN32
    || process.platform === 'win32'
  )
) {
  /* eslint no-control-regex: "off" */
  const makePosix = str => /^\\\\\?\\/.test(str)
  || /["<>|\u0000-\u001F]+/u.test(str)
    ? str
    : str.replace(/\\/g, '/');

  checkPath.convert = makePosix;

  // 'C:\\foo'     <- 'C:\\foo' has been converted to 'C:/'
  // 'd:\\foo'
  const REGIX_IS_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
  checkPath.isNotRelative = path =>
    REGIX_IS_WINDOWS_PATH_ABSOLUTE.test(path)
    || isNotRelative(path);
}

var ignore$1 = /*@__PURE__*/getDefaultExportFromCjs(ignore);

const readFileSafe = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
  }
};
const findGitRepo = (fromPath) => {
  const dotGit = findUpSync(".git", {
    cwd: fromPath,
    type: "directory"
  });
  if (dotGit) {
    return path.dirname(dotGit);
  }
};
const cache = /* @__PURE__ */ new Map();
const getCodeOwnerForGitRepo = (repoPath) => {
  const codeOwners = cache.get(repoPath);
  if (codeOwners) {
    return codeOwners;
  }
  const codeOwnersFile = readFileSafe(path.join(repoPath, ".github/CODEOWNERS")) ?? readFileSafe(path.join(repoPath, "CODEOWNERS")) ?? readFileSafe(path.join(repoPath, "docs/CODEOWNERS"));
  if (!codeOwnersFile) {
    return;
  }
  const entries = codeOwnersFile.split("\n").filter((line) => !line.startsWith("#") && line.trim() !== "").map((line) => line.split(/\s+/, 2)).reverse();
  cache.set(repoPath, entries);
  return entries;
};
const getCodeOwner = (filePath) => {
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
    const ig = ignore$1().add(pattern);
    return ig.ignores(relativeFilepath);
  });
  if (foundMatch) {
    return foundMatch[1];
  }
};

const isObject = value => {
	const type = typeof value;
	return value !== null && (type === 'object' || type === 'function');
};

const disallowedKeys = new Set([
	'__proto__',
	'prototype',
	'constructor',
]);

const digits = new Set('0123456789');

function getPathSegments(path) {
	const parts = [];
	let currentSegment = '';
	let currentPart = 'start';
	let isIgnoring = false;

	for (const character of path) {
		switch (character) {
			case '\\': {
				if (currentPart === 'index') {
					throw new Error('Invalid character in an index');
				}

				if (currentPart === 'indexEnd') {
					throw new Error('Invalid character after an index');
				}

				if (isIgnoring) {
					currentSegment += character;
				}

				currentPart = 'property';
				isIgnoring = !isIgnoring;
				break;
			}

			case '.': {
				if (currentPart === 'index') {
					throw new Error('Invalid character in an index');
				}

				if (currentPart === 'indexEnd') {
					currentPart = 'property';
					break;
				}

				if (isIgnoring) {
					isIgnoring = false;
					currentSegment += character;
					break;
				}

				if (disallowedKeys.has(currentSegment)) {
					return [];
				}

				parts.push(currentSegment);
				currentSegment = '';
				currentPart = 'property';
				break;
			}

			case '[': {
				if (currentPart === 'index') {
					throw new Error('Invalid character in an index');
				}

				if (currentPart === 'indexEnd') {
					currentPart = 'index';
					break;
				}

				if (isIgnoring) {
					isIgnoring = false;
					currentSegment += character;
					break;
				}

				if (currentPart === 'property') {
					if (disallowedKeys.has(currentSegment)) {
						return [];
					}

					parts.push(currentSegment);
					currentSegment = '';
				}

				currentPart = 'index';
				break;
			}

			case ']': {
				if (currentPart === 'index') {
					parts.push(Number.parseInt(currentSegment, 10));
					currentSegment = '';
					currentPart = 'indexEnd';
					break;
				}

				if (currentPart === 'indexEnd') {
					throw new Error('Invalid character after an index');
				}

				// Falls through
			}

			default: {
				if (currentPart === 'index' && !digits.has(character)) {
					throw new Error('Invalid character in an index');
				}

				if (currentPart === 'indexEnd') {
					throw new Error('Invalid character after an index');
				}

				if (currentPart === 'start') {
					currentPart = 'property';
				}

				if (isIgnoring) {
					isIgnoring = false;
					currentSegment += '\\';
				}

				currentSegment += character;
			}
		}
	}

	if (isIgnoring) {
		currentSegment += '\\';
	}

	switch (currentPart) {
		case 'property': {
			if (disallowedKeys.has(currentSegment)) {
				return [];
			}

			parts.push(currentSegment);

			break;
		}

		case 'index': {
			throw new Error('Index was not closed');
		}

		case 'start': {
			parts.push('');

			break;
		}
		// No default
	}

	return parts;
}

function isStringIndex(object, key) {
	if (typeof key !== 'number' && Array.isArray(object)) {
		const index = Number.parseInt(key, 10);
		return Number.isInteger(index) && object[index] === object[key];
	}

	return false;
}

function getProperty(object, path, value) {
	if (!isObject(object) || typeof path !== 'string') {
		return value === undefined ? object : value;
	}

	const pathArray = getPathSegments(path);
	if (pathArray.length === 0) {
		return value;
	}

	for (let index = 0; index < pathArray.length; index++) {
		const key = pathArray[index];

		if (isStringIndex(object, key)) {
			object = index === pathArray.length - 1 ? undefined : null;
		} else {
			object = object[key];
		}

		if (object === undefined || object === null) {
			// `object` is either `undefined` or `null` so we want to stop the loop, and
			// if this is not the last bit of the path, and
			// if it didn't return `undefined`
			// it would return `null` if `object` is `null`
			// but we want `get({foo: null}, 'foo.bar')` to equal `undefined`, or the supplied value, not `null`
			if (index !== pathArray.length - 1) {
				return value;
			}

			break;
		}
	}

	return object === undefined ? value : object;
}

const handlebarPattern = /\{\{\s*(.+?)\s*\}\}/g;
const interpolateString = (template, data, onMissingKey) => {
  if (!handlebarPattern.test(template)) {
    return template;
  }
  return template.replaceAll(handlebarPattern, (match, key) => {
    const value = getProperty(data, key);
    return value ?? onMissingKey(match, key);
  });
};

var name = "eslint-plugin-fix-later";

const normalizeOptions = (options) => {
  const insertDisableComment = options?.insertDisableComment ?? "end-of-line";
  const commentTemplate = options?.commentTemplate ?? "Fix later";
  if (!commentTemplate) {
    throw new Error('commentTemplate must include a description (e.g. "Fix later")');
  }
  return {
    includeWarnings: options?.includeWarnings ?? false,
    insertDisableComment,
    disableDirective: insertDisableComment === "above-line" ? "// eslint-disable-next-line" : "// eslint-disable-line",
    commentTemplate
  };
};
let ruleId = `${name.slice("eslint-config-".length)}/fix-later`;
let ruleOptions;
const setRuleUsage = (_ruleId, _ruleOptions) => {
  ruleId = _ruleId;
  ruleOptions = _ruleOptions;
};

var require$1 = (
			false
				? /* @__PURE__ */ module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)))
				: require
		);

const safeRequire = (id) => {
  try {
    return require$1(id);
  } catch {
    return null;
  }
};
const disallowedTypes = /* @__PURE__ */ new Set(["VAttribute", "VIdentifier", "VExpressionContainer", "VDirectiveKey", "VText"]);
const getVueElement = (index, rootNode) => {
  const vueEslintParser = safeRequire("vue-eslint-parser");
  if (!vueEslintParser) {
    return;
  }
  let result;
  let broken = false;
  vueEslintParser.AST.traverseNodes(rootNode, {
    enterNode: (node) => {
      if (broken) {
        return;
      }
      if (!disallowedTypes.has(node.type) && node.range[0] <= index && index < node.range[1]) {
        result = node;
      }
    },
    leaveNode: (node) => {
      if (!broken && node === result) {
        broken = true;
      }
    }
  });
  return result;
};

const allowedErrorPattern = /^Definition for rule '[^']+' was not found\.$/;
const getRuleIds = (lintMessages) => {
  const ruleIds = [];
  for (const message of lintMessages) {
    if (message.ruleId && !ruleIds.includes(message.ruleId)) {
      ruleIds.push(message.ruleId);
    }
  }
  return ruleIds;
};
const suppressFileErrors = (code, sourceCode, extractedConfig, messages, { fix, filename }) => {
  if (!ruleId || !ruleOptions) {
    return messages;
  }
  const ruleConfig = extractedConfig?.rules?.[ruleId];
  if (!ruleConfig) {
    return messages;
  }
  const ruleLevel = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;
  const ruleSeverity = getSeverity(ruleLevel);
  let processMessages = messages.filter((message) => (
    // Errors like parsing errors don't have rule IDs
    message.ruleId && message.ruleId !== ruleId && !allowedErrorPattern.test(message.message) && (!("suppressions" in message) || message.suppressions.length === 0)
  ));
  if (!ruleOptions.includeWarnings) {
    processMessages = processMessages.filter(({ severity }) => severity > 1);
  }
  if (fix) {
    processMessages = processMessages.filter((message) => !message.fix);
  } else {
    const suppressableMessages = processMessages.filter((message) => !message.fix);
    if (suppressableMessages.length > 0) {
      messages.push({
        ruleId,
        severity: ruleSeverity,
        message: `${suppressableMessages.length} suppressable errors (suppress with --fix)`,
        line: 0,
        column: 0
      });
    }
    return messages;
  }
  if (processMessages.length === 0) {
    return messages;
  }
  const { commentTemplate } = ruleOptions;
  const groupedByLine = {};
  const addMessage = (key, type, message) => {
    if (!groupedByLine[key]) {
      groupedByLine[key] = {
        line: [],
        start: [],
        end: []
      };
    }
    groupedByLine[key][type].push(message);
  };
  for (const message of processMessages) {
    const reportedIndex = sourceCode.getIndexFromLoc({
      line: message.line,
      column: message.column - 1
    });
    const reportedNode = sourceCode.getNodeByRangeIndex(reportedIndex);
    if (reportedNode) {
      addMessage(message.line, "line", message);
    } else {
      const vueDocumentFragment = sourceCode.parserServices.getDocumentFragment?.();
      const templateNode = getVueElement(reportedIndex, vueDocumentFragment);
      if (templateNode) {
        addMessage(templateNode.loc.start.line, "start", message);
        addMessage(templateNode.loc.end.line + 1, "end", message);
      }
    }
  }
  const getLineComment = (message) => {
    let blameData;
    const comment = interpolateString(
      commentTemplate,
      {
        get blame() {
          if (filename && !blameData) {
            blameData = gitBlame(filename, message.line, message.endLine ?? message.line);
          }
          return blameData;
        },
        get codeowner() {
          if (filename) {
            return getCodeOwner(filename);
          }
        }
      },
      (_match, key) => {
        throw new Error(`Can't find key: ${key}`);
      }
    );
    return comment;
  };
  for (const key in groupedByLine) {
    if (!Object.hasOwn(groupedByLine, key)) {
      continue;
    }
    const groupedMessages = groupedByLine[key];
    const comments = [];
    if (groupedMessages.line.length > 0) {
      const rulesToDisable = getRuleIds(groupedMessages.line).join(", ");
      comments.push(`${ruleOptions.disableDirective} ${rulesToDisable} -- ${getLineComment(groupedMessages.line[0])}`);
    }
    if (groupedMessages.start.length > 0) {
      const rulesToDisable = getRuleIds(groupedMessages.start).join(", ");
      comments.push(`<!-- eslint-disable ${rulesToDisable} -- ${getLineComment(groupedMessages.start[0])} -->`);
    }
    if (groupedMessages.end.length > 0) {
      const rulesToDisable = getRuleIds(groupedMessages.end).join(", ");
      comments.push(`<!-- eslint-enable ${rulesToDisable} -->`);
    }
    const lineStartIndex = sourceCode.getIndexFromLoc({
      line: Number(key),
      column: 0
    });
    const comment = comments.join("\n");
    messages.push({
      ruleId,
      severity: ruleSeverity,
      message: "Suppressing errors",
      line: 0,
      column: 0,
      fix: ruleOptions.insertDisableComment === "above-line" || groupedMessages.start.length > 0 || groupedMessages.end.length > 0 ? insertCommentAboveLine(
        code,
        lineStartIndex,
        comment
      ) : insertCommentSameLine(
        code,
        lineStartIndex,
        comment
      )
    });
  }
  return messages;
};
const {
  _verifyWithoutProcessors,
  _verifyWithProcessor
} = eslint.Linter.prototype;
eslint.Linter.prototype._verifyWithoutProcessors = function(textOrSourceCode, config, options) {
  const messages = Reflect.apply(
    _verifyWithoutProcessors,
    this,
    arguments
  );
  if (options.postprocess) {
    return messages;
  }
  return suppressFileErrors(
    textOrSourceCode,
    this.getSourceCode(),
    config,
    messages,
    options
  );
};
eslint.Linter.prototype._verifyWithProcessor = function(textOrSourceCode, config, options) {
  const messages = Reflect.apply(
    _verifyWithProcessor,
    this,
    arguments
  );
  return suppressFileErrors(
    textOrSourceCode,
    this.getSourceCode(),
    config,
    messages,
    options
  );
};

const escapeRegExp = (string) => string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const fixLater = {
  meta: {
    fixable: "code",
    messages: {
      remindToFix: "[REMINDER] {{ description }}"
    },
    schema: [
      {
        type: "object",
        properties: {
          includeWarnings: {
            type: "boolean"
          },
          insertDisableComment: {
            enum: [
              "above-line",
              "end-of-line"
            ]
          },
          commentTemplate: {
            type: "string"
          }
        },
        additionalProperties: false
      }
    ],
    type: "problem"
  },
  create: (context) => {
    const options = normalizeOptions(context.options[0]);
    setRuleUsage(context.id, options);
    const descriptionDelimiter = " -- ";
    const wildCard = Math.random().toString(36).slice(2);
    const template = interpolateString(
      options.commentTemplate,
      {},
      () => wildCard
    );
    const suppressCommentPattern = new RegExp(`^${escapeRegExp(template).replaceAll(wildCard, ".+?")}$`);
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const comments = sourceCode.getAllComments();
    const reportCommentDescription = (commentString, commentLocation) => {
      const descriptionIndex = commentString.indexOf(descriptionDelimiter);
      if (descriptionIndex === -1) {
        return;
      }
      const description = commentString.slice(descriptionIndex + descriptionDelimiter.length);
      if (!suppressCommentPattern.test(description)) {
        return;
      }
      context.report({
        loc: commentLocation,
        messageId: "remindToFix",
        data: {
          description
        }
      });
    };
    for (const comment of comments) {
      const commentString = sourceCode.text.slice(comment.range[0] + 2, comment.range[1]).trim();
      if (commentString.startsWith("eslint-disable-")) {
        reportCommentDescription(commentString, comment.loc);
      }
    }
    const vueDocument = sourceCode.parserServices.getDocumentFragment?.();
    if (vueDocument) {
      for (const comment of vueDocument.comments) {
        const commentText = comment.value.trim();
        if (commentText.startsWith("eslint-disable")) {
          reportCommentDescription(commentText, comment.loc);
        }
      }
    }
    return {};
  }
};

var fixLater$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	fixLater: fixLater
});

const rules = kebabKeys({
  ...fixLater$1
});

const plugin = {
  rules
};

module.exports = plugin;
