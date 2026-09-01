'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const sass = require('sass-embedded');

// Renders a neutral fixture into a concrete entry stylesheet for whichever
// dialect a given Foundation tree speaks, then compiles it.
//
// `import` dialect (Foundation <= 6.9): settings are plain global assignments
//   made *before* `@import 'foundation'`, where they beat the framework's
//   `!default`s.
// `use` dialect (the module-system migration): settings are passed as
//   `@use 'foundation' with (...)`.

// All dialect-specific knowledge lives in this table. Each probe names a
// logical thing to measure; the templates say how to reach it in each dialect.
// `uses` lists extra modules the `use` dialect needs, as [url, namespace].
const PROBES = {
  'rem-calc': {
    import: (a) => `rem-calc(${a.join(', ')})`,
    use: (a) => `probe-unit.rem-calc(${a.join(', ')})`,
    uses: [['util/unit', 'probe-unit']],
  },
  'get-color': {
    import: (a) => `get-color(${a.join(', ')})`,
    use: (a) => `probe-color.get-color(${a.join(', ')})`,
    uses: [['util/color', 'probe-color']],
  },
  // The flex justify map as the *global/settings* layer sees it...
  'flex-justify-global': {
    import: (a) => `map-get($-zf-flex-justify, ${a.join(', ')})`,
    use: (a) => `probe-map.get(foundation.$zf-flex-justify, ${a.join(', ')})`,
    uses: [['sass:map', 'probe-map']],
  },
  // ...and as the flex *utility* layer sees it. On a correct build these are
  // the same map; if they disagree, alignment helpers and grid classes will
  // contradict each other in the same stylesheet.
  'flex-justify-util': {
    import: (a) => `map-get($-zf-flex-justify, ${a.join(', ')})`,
    use: (a) => `probe-map.get(probe-flex.$zf-flex-justify, ${a.join(', ')})`,
    uses: [['sass:map', 'probe-map'], ['util/flex', 'probe-flex']],
  },
};

function detectDialect(root) {
  const entry = path.join(root, 'scss', 'foundation.scss');
  const src = fs.readFileSync(entry, 'utf8');
  return /^\s*@(use|forward)\s/m.test(src) ? 'use' : 'import';
}

// A value containing a top-level comma is a Sass list. Bare, it would be
// parsed as another argument in `@use ... with (...)` or in a mixin call, so it
// has to be parenthesized. `(a, b)` and `a, b` are the same list, so doing this
// unconditionally keeps both dialects byte-identical.
function listSafe(value) {
  const v = String(value).trim();
  let depth = 0;
  let quote = null;
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (quote) {
      if (ch === quote && v[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) return `(${v})`;
  }
  return v;
}

function mixinArgs(args) {
  if (!args) return '';
  const parts = Object.entries(args).map(([k, v]) => `$${k}: ${listSafe(v)}`);
  return parts.length ? `(${parts.join(', ')})` : '';
}

function probeLines(fixture, dialect) {
  if (!fixture.probes || !fixture.probes.length) return { uses: [], rules: [] };

  const uses = [];
  const rules = [];

  for (const [selector, prop, fn, args = []] of fixture.probes) {
    const spec = PROBES[fn];
    if (!spec) throw new Error(`Unknown probe function "${fn}" in fixture "${fixture.name}"`);

    if (dialect === 'use') {
      for (const u of spec.uses || []) {
        if (!uses.some((e) => e[0] === u[0] && e[1] === u[1])) uses.push(u);
      }
    }
    rules.push(`${selector} { ${prop}: ${spec[dialect](args.map(String))}; }`);
  }

  return { uses, rules };
}

function renderEntry(fixture, dialect) {
  const vars = fixture.vars || {};
  const varNames = Object.keys(vars);
  const { uses, rules } = probeLines(fixture, dialect);
  const args = mixinArgs(fixture.args);
  const out = [];

  if (dialect === 'import') {
    for (const name of varNames) out.push(`$${name}: ${listSafe(vars[name])};`);
    out.push(`@import 'foundation';`);
    out.push(`@include foundation-everything${args};`);
  } else {
    // `@use 'foundation' with (...)` must come FIRST. Configuration only
    // applies to a module that has not been loaded yet, and a probe's `@use`
    // of e.g. `util/unit` loads Foundation's settings modules transitively --
    // so emitting probes first makes every configured fixture a hard
    // "module was already loaded" error.
    if (varNames.length) {
      const withList = varNames.map((n) => `  $${n}: ${listSafe(vars[n])}`).join(',\n');
      out.push(`@use 'foundation' with (\n${withList}\n);`);
    } else {
      out.push(`@use 'foundation';`);
    }
    for (const [url, ns] of uses) out.push(`@use '${url}' as ${ns};`);
    out.push(`@include foundation.foundation-everything${args};`);
  }

  out.push(...rules);
  return out.join('\n') + '\n';
}

// Compiles a fixture against the tree at `root`.
// Never throws for Sass errors: a fixture that fails to compile is itself a
// result worth recording and diffing, since it usually means a setting that
// used to be configurable no longer is.
function compileFixture(fixture, root, dialect = detectDialect(root)) {
  const source = renderEntry(fixture, dialect);
  const loadPaths = [
    path.join(root, 'scss'),
    root,
    path.join(root, 'node_modules'),
    path.join(__dirname, '..', '..', '..', 'node_modules'),
  ].filter((p) => fs.existsSync(p));

  try {
    const result = sass.compileString(source, {
      loadPaths,
      // Relative resolution base; the file need not exist.
      url: pathToFileURL(path.join(root, 'test', 'regression', '__fixture.scss')),
      style: 'expanded',
      logger: sass.Logger.silent,
    });
    return { ok: true, css: result.css, source, dialect };
  } catch (err) {
    return {
      ok: false,
      error: (err && err.sassMessage) || (err && err.message) || String(err),
      source,
      dialect,
    };
  }
}

module.exports = { detectDialect, renderEntry, compileFixture, listSafe, PROBES };
