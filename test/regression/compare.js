#!/usr/bin/env node
'use strict';

// Compiles every fixture against the working tree and compares the normalized
// CSS to the committed baseline.
//
//   node test/regression/compare.js                 # summary, exit 1 on drift
//   node test/regression/compare.js --diff          # + unified diffs
//   node test/regression/compare.js --only rtl,grid # filter by name substring
//   node test/regression/compare.js --context 6     # diff context lines
//   node test/regression/compare.js --write-actual  # dump actual/ for inspection

const fs = require('fs');
const path = require('path');

const fixtures = require('./fixtures');
const { compileFixture, detectDialect } = require('./lib/render');
const { normalize } = require('./lib/normalize');
const { unifiedDiff, countChanges } = require('./lib/diff');

const REPO = path.resolve(__dirname, '..', '..');
const BASE = path.join(__dirname, 'baseline');
const ACTUAL = path.join(__dirname, 'actual');

function parseArgs(argv) {
  const out = { diff: false, context: 3, only: null, writeActual: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diff') out.diff = true;
    else if (a === '--context') out.context = parseInt(argv[++i], 10);
    else if (a === '--only') out.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--write-actual') out.writeActual = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function readBaseline(name) {
  const css = path.join(BASE, `${name}.css`);
  const err = path.join(BASE, `${name}.err`);
  if (fs.existsSync(css)) return { status: 'ok', text: fs.readFileSync(css, 'utf8') };
  if (fs.existsSync(err)) return { status: 'error', text: fs.readFileSync(err, 'utf8') };
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node test/regression/compare.js [--diff] [--context N] ' +
      '[--only a,b] [--write-actual]'
    );
    return;
  }

  if (!fs.existsSync(path.join(BASE, 'manifest.json'))) {
    console.error(
      'No baseline found. Generate one first:\n' +
      '  node test/regression/baseline.js --ref develop'
    );
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(BASE, 'manifest.json'), 'utf8'));
  const dialect = detectDialect(REPO);
  const selected = fixtures.filter(
    (f) => !args.only || args.only.some((s) => f.name.includes(s))
  );

  console.log(`Baseline : ${manifest.ref} (${manifest.sha.slice(0, 9)}), dialect "${manifest.dialect}"`);
  console.log(`Current  : working tree, dialect "${dialect}"`);
  console.log(`Fixtures : ${selected.length}${args.only ? ` (filtered)` : ''}\n`);

  if (args.writeActual) {
    fs.rmSync(ACTUAL, { recursive: true, force: true });
    fs.mkdirSync(ACTUAL, { recursive: true });
  }

  const results = [];

  for (const fixture of selected) {
    const baseline = readBaseline(fixture.name);
    if (!baseline) {
      results.push({ fixture, verdict: 'missing' });
      continue;
    }

    const actual = compileFixture(fixture, REPO, dialect);
    const actualText = actual.ok ? normalize(actual.css) : actual.error + '\n';

    if (args.writeActual) {
      fs.writeFileSync(
        path.join(ACTUAL, `${fixture.name}.${actual.ok ? 'css' : 'err'}`),
        actualText
      );
    }

    const actualStatus = actual.ok ? 'ok' : 'error';

    if (baseline.status === 'ok' && actualStatus === 'error') {
      results.push({ fixture, verdict: 'broke', error: actual.error });
      continue;
    }
    if (baseline.status === 'error' && actualStatus === 'ok') {
      results.push({ fixture, verdict: 'fixed' });
      continue;
    }

    const diff = unifiedDiff(baseline.text, actualText, args.context);
    results.push({
      fixture,
      verdict: diff ? 'drift' : 'match',
      diff,
      changes: countChanges(diff),
    });
  }

  const pad = Math.max(...selected.map((f) => f.name.length));
  const LABEL = {
    match: 'match  ',
    drift: 'DRIFT  ',
    broke: 'BROKE  ',
    fixed: 'fixed  ',
    missing: 'missing',
  };

  for (const r of results) {
    let detail = '';
    if (r.verdict === 'drift') detail = `${r.changes} changed line(s)`;
    if (r.verdict === 'broke') detail = 'compiled on baseline, fails now';
    if (r.verdict === 'fixed') detail = 'failed on baseline, compiles now';
    if (r.verdict === 'missing') detail = 'no baseline — regenerate';
    console.log(`  ${LABEL[r.verdict]} ${r.fixture.name.padEnd(pad)}  ${detail}`);
  }

  const bad = results.filter((r) => r.verdict === 'drift' || r.verdict === 'broke' || r.verdict === 'missing');

  if (bad.length) {
    console.log('');
    for (const r of bad) {
      console.log('─'.repeat(78));
      console.log(`${r.fixture.name}  [${r.verdict}]`);
      if (r.fixture.doc) console.log(`\n${r.fixture.doc}\n`);

      if (r.verdict === 'broke') {
        console.log(r.error.split('\n').map((l) => '  ' + l).join('\n'));
      } else if (r.verdict === 'drift' && args.diff) {
        console.log(r.diff);
      } else if (r.verdict === 'drift') {
        console.log(`  ${r.changes} changed line(s). Re-run with --diff to see them.`);
      }
      console.log('');
    }
  }

  const summary = results.reduce((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] || 0) + 1;
    return acc;
  }, {});
  console.log('─'.repeat(78));
  console.log(
    Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(', ') || 'nothing to do'
  );

  process.exit(bad.length ? 1 : 0);
}

main();
