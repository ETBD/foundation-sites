#!/usr/bin/env node
'use strict';

// Generates the CSS-output baseline from a known-good git ref.
//
//   node test/regression/baseline.js                # from `develop`
//   node test/regression/baseline.js --ref v6.9.0
//   node test/regression/baseline.js --ref HEAD     # accept current output
//
// The ref is checked out into a throwaway worktree and compiled with *this*
// checkout's Sass binary, so the baseline differs from the current tree only
// by the stylesheets themselves — never by compiler version.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const fixtures = require('./fixtures');
const { compileFixture, detectDialect } = require('./lib/render');
const { normalize } = require('./lib/normalize');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'baseline');

function git(args, opts = {}) {
  const out = execFileSync('git', args, { cwd: REPO, encoding: 'utf8', ...opts });
  return typeof out === 'string' ? out.trim() : '';
}

function parseArgs(argv) {
  const out = { ref: 'develop' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') out.ref = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node test/regression/baseline.js [--ref <git-ref>]');
    return;
  }

  const sha = git(['rev-parse', args.ref]);
  // realpath matters: on macOS os.tmpdir() is /var/... while git resolves it to
  // /private/var/..., and `git worktree remove` then cannot match the path,
  // leaving a stale worktree registered behind every run.
  const worktree = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'fdn-baseline-'))
  );
  let root = worktree;
  let usedWorktree = false;

  // A clean working tree at the requested ref needs no worktree at all.
  const headSha = git(['rev-parse', 'HEAD']);
  const dirty = git(['status', '--porcelain']).length > 0;
  if (sha === headSha && !dirty) {
    root = REPO;
    fs.rmSync(worktree, { recursive: true, force: true });
  } else {
    git(['worktree', 'add', '--detach', worktree, sha], { stdio: 'ignore' });
    usedWorktree = true;
  }

  try {
    const dialect = detectDialect(root);
    console.log(`Baseline ref : ${args.ref} (${sha.slice(0, 9)})`);
    console.log(`Dialect      : ${dialect}`);
    console.log(`Fixtures     : ${fixtures.length}\n`);

    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });

    const manifest = { ref: args.ref, sha, dialect, fixtures: {} };
    let failed = 0;

    for (const fixture of fixtures) {
      const result = compileFixture(fixture, root, dialect);

      if (result.ok) {
        fs.writeFileSync(path.join(OUT, `${fixture.name}.css`), normalize(result.css));
        manifest.fixtures[fixture.name] = { status: 'ok' };
        console.log(`  ok     ${fixture.name}`);
      } else {
        fs.writeFileSync(path.join(OUT, `${fixture.name}.err`), result.error + '\n');
        manifest.fixtures[fixture.name] = { status: 'error' };
        failed++;
        console.log(`  ERROR  ${fixture.name}`);
        console.log(`         ${result.error.split('\n')[0]}`);
      }
    }

    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    console.log(`\nWrote ${fixtures.length} baselines to test/regression/baseline/`);
    if (failed) {
      console.log(
        `\n${failed} fixture(s) do not compile on the baseline ref itself. ` +
        `Those record the error text as the baseline, so a *change* in behaviour ` +
        `still shows up — but consider fixing the fixture instead.`
      );
    }
  } finally {
    if (usedWorktree) {
      try {
        git(['worktree', 'remove', '--force', worktree], { stdio: 'ignore' });
      } catch (e) {
        fs.rmSync(worktree, { recursive: true, force: true });
        try { git(['worktree', 'prune']); } catch (e2) { /* best effort */ }
      }
    }
  }
}

main();
