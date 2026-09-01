# CSS output regression harness

Compiles Foundation under a set of **configurations**, normalizes the CSS, and
diffs it against a baseline generated from a known-good git ref.

It exists because the existing Sass suite (`test/sass/`) tests util functions in
isolation with default settings. That leaves the framework's most important
contract untested: *a setting the user changes must reach the CSS*. The Sass
module migration breaks that contract in several places while still compiling
without a single error, so a green `yarn test:sass` proves nothing about it.

## Usage

```bash
# 1. Record what correct output looks like (once, from a good ref)
yarn test:regression:baseline              # from `develop`
yarn test:regression:baseline --ref v6.9.0

# 2. Compare the working tree against it
yarn test:regression                       # summary; exit 1 on any drift
yarn test:regression:diff                  # summary + unified diffs

# Narrow down while iterating
node test/regression/compare.js --only rtl,grid --diff --context 6
node test/regression/compare.js --write-actual   # dump actual/ to eyeball
```

As a mocha suite (for CI):

```bash
npx mocha test/regression/test_regression.js
```

It is deliberately **not** wired into `yarn test` yet, because every fixture
currently fails on the migration branch. Add `test:regression` to `test` and
`test:ci` once the migration is green, so it guards future changes.

## How it handles two dialects

The baseline ref speaks `@import`; the migration branch speaks `@use`. A fixture
therefore describes a *configuration*, never syntax, and the harness renders it
into whichever dialect the tree under test speaks:

| | baseline (`import`) | migrated (`use`) |
|---|---|---|
| settings | `$global-font-size: 62.5%;` before `@import 'foundation'` | `@use 'foundation' with ($global-font-size: 62.5%)` |
| mixin | `@include foundation-everything(...)` | `@include foundation.foundation-everything(...)` |

Dialect detection is a `@use`/`@forward` check on `scss/foundation.scss`
(`lib/render.js`). Both sides compile with the *same* Sass binary — the one in
this checkout — so a diff can never be a compiler-version artifact.

## Normalization

`lib/normalize.js` parses the CSS with PostCSS and re-emits a canonical form.

Neutralized, because none of it affects rendering:

- selector-list line wrapping and internal whitespace
- **the order of selectors within one comma-separated list** (the single largest
  source of false positives — Sass orders `@extend`-generated lists differently
  across versions)
- whitespace in declaration values and at-rule params
- comments (the version banner differs per ref)

Preserved, because all of it affects the cascade: rule order, declaration order
within a rule, at-rule nesting and params, every property and value.

The payoff: on this branch the stock `default` fixture reports 58 changed lines
and **every one is a real defect**. No filtering by hand.

## Fixtures

`fixtures.js`. Each entry is:

```js
{
  name: 'global-font-size',
  doc:   'why this matters — printed with the diff',
  vars:  { 'global-font-size': '62.5%' },   // settings to configure
  args:  { 'xy-grid': 'false' },            // foundation-everything() args
  probes: [['.probe-x', 'width', 'rem-calc', [1200]]],
}
```

Values in `vars`/`args` must be **dialect-neutral literals**. `rem-calc(1000)`
works before an `@import` but not inside `@use ... with (...)`, so write
`62.5rem`. Comma-containing values are auto-parenthesized (`listSafe`), because
a bare comma would otherwise be read as another argument.

### Probes

Some regressions never show up in emitted CSS — a function's return value, or a
map only internal code reads. A probe appends a declaration that forces the
value into the output.

Probes name a *logical* thing to measure; `PROBES` in `lib/render.js` owns the
per-dialect spelling. That table is the one place that records API renames
(`-zf-bp-serialize` → `zf-bp-serialize`) and where a symbol now lives.

`flex-justify-global` vs `flex-justify-util` is the pattern worth copying: it
reads *the same logical setting* through two different modules. On a correct
build they agree; when configuration only reaches one of two duplicated copies,
they disagree and the diff names both.

## Verdicts

| verdict | meaning |
|---|---|
| `match` | normalized CSS is byte-identical to baseline |
| `DRIFT` | compiles, but output changed |
| `BROKE` | compiled on the baseline ref, fails to compile now |
| `fixed`  | failed on the baseline ref, compiles now |
| `missing`| no baseline recorded — regenerate |

`BROKE` is usually the more damning of the two: it means a setting that used to
be configurable no longer is, or a code path was lost entirely.

## Adding a fixture

1. Add an entry to `fixtures.js` with a `doc` explaining what breakage it catches.
2. `yarn test:regression:baseline` — confirm it compiles on the good ref. A new
   fixture that is `BROKE` on the baseline is a bug in the fixture, not a finding.
3. `yarn test:regression` — see whether the working tree still matches.

Baselines are committed. Regenerate them deliberately, in their own commit, and
never to make a red run go green — that is the one move that turns this harness
back into decoration.
