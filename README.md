# 📌 eslint-plugin-fix-later

This plugin automatically suppresses ESLint errors with "fix later" comments, turning them into warnings for future resolution.

<br>

<table>
<tr>
<th align="center">
Before
</th>
<th align="center">
After auto-fix
</th>
</tr>
<tr>
<td>

```js
console.log(data)
```
<p align="center">

❌ **Error** `no-console Unexpected console statement`
</p>
</td>
<td>

```js
// eslint-disable-next-line no-console -- Fix later
console.log(data)
```
<p align="center">

⚠️ **Warning** `[REMINDER] Fix later`
</p>
</td>
</tr>
</table>

<br>

> [!TIP]
> Use the `git blame` feature documented below to tag the author in the "fix later" comment.


## Why?

In large projects with many developers, ESLint helps keep code consistent and high-quality. But, updating the ESLint config with new rules can be challenging when it surfaces many new errors. This would be too much for one dev to fix, and potentially risky if it's outside of their familiarity.

This plugin solves this by temporarily suppressing these errors into "fix later" warnings, allowing the right dev to address them when ready. This keeps the project moving forward without sacrificing code quality.

## Install
```
pnpm i -D eslint-plugin-fix-later
```

## Setup

In your ESLint config:

```json5
{
    plugins: [
        // ...
        'fix-later',
    ],
    rules: {
        // ...
        'fix-later/fix-later': ['warn', {
            // Options...
        }]
    }
}
```

### Recommended workflow

1. **Activate this plugin**

	Set up the `fix-later` rule to emit a _warning_ (as opposed to `errors`).

2. **Automate linting on commit**

	Use [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) & [lint-staged](https://github.com/lint-staged/lint-staged) to auto-lint changed files when committing

3. **Disallow linting warnings on commit**

	Configure your commit hook to reject warnings: `eslint --max-warnings=0`

	This encourages devs working in the file to address outstanding warnings if they can. If not, they can commit with `--no-verify`.

4. **Disallow linting errors on CI**

	On CI, run ESLint with warnings allowed: `eslint .`

	This approach prevents errors from slipping through while accommodating "fix later" notes.

## Options

### includeWarnings

Type: `boolean`

Default: `false`

Whether to suppress warnings in addition to errors.

### insertDisableComment

Type: `'above-line' | 'end-of-line'`

Default: `'end-of-line'`

Whether to put the `eslint-disable` comment on the same line or on the line above.

### commentTemplate

Type: string

Default: `'// {{ eslint-disable }} -- Fix later'`

The template for the `eslint-disable` comment. The `{{ eslint-disable }}` handlebar is required to interpolate the `eslint-disable` type into.

#### Git blame

You can also `git blame` the errorneous code and leave a TODO for the author:
```
// {{ eslint-disable }} -- Please fix: {{ blame.author }} <{{ blame.author-mail }}>
```

Which will create the following comment:
```
// eslint-disable-line -- Please fix: John Doe <john@doe.org>
```

All properties from `git blame` are available:

```json5
{
    "author": "John Doe",
    "author-mail": "john@doe.org",
    "author-time": "1708498454",
    "author-tz": "+0100",
    "committer": "John Doe",
    "committer-mail": "<john@doe.org>",
    "committer-time": "1708498454",
    "committer-tz": "+0100"
}
```
