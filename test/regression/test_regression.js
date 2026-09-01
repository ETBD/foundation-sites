'use strict';

// Mocha wrapper around the CSS-output regression harness, so it can run
// alongside the other suites:
//
//   npx mocha test/regression/test_regression.js
//
// Requires a baseline. Generate one with:
//   yarn test:regression:baseline

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fixtures = require('./fixtures');
const { compileFixture, detectDialect } = require('./lib/render');
const { normalize } = require('./lib/normalize');
const { unifiedDiff, countChanges, truncate } = require('./lib/diff');

const REPO = path.resolve(__dirname, '..', '..');
const BASE = path.join(__dirname, 'baseline');

const manifestPath = path.join(BASE, 'manifest.json');
const hasBaseline = fs.existsSync(manifestPath);

describe('CSS output regression', function () {
  // Compiling the whole framework a dozen times is not fast.
  this.timeout(120000);

  if (!hasBaseline) {
    it('has a baseline', function () {
      assert.fail(
        'No baseline in test/regression/baseline/. Run: yarn test:regression:baseline'
      );
    });
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const dialect = detectDialect(REPO);

  for (const fixture of fixtures) {
    it(fixture.name, function () {
      const cssPath = path.join(BASE, `${fixture.name}.css`);
      const errPath = path.join(BASE, `${fixture.name}.err`);
      const baselineOk = fs.existsSync(cssPath);

      assert.ok(
        baselineOk || fs.existsSync(errPath),
        `no baseline for "${fixture.name}" — regenerate with yarn test:regression:baseline`
      );

      const actual = compileFixture(fixture, REPO, dialect);

      if (baselineOk) {
        assert.ok(
          actual.ok,
          `compiles on ${manifest.ref} but fails now:\n${actual.error}\n\n` +
          `${fixture.doc || ''}`
        );
        // Not assert.strictEqual: mocha's diff on a 150KB string is unreadable.
        // Report a real unified diff, capped, plus the command to see all of it.
        const diff = unifiedDiff(fs.readFileSync(cssPath, 'utf8'), normalize(actual.css));
        if (diff) {
          assert.fail(
            `CSS output differs from ${manifest.ref} ` +
            `(${countChanges(diff)} changed line(s)).\n` +
            `${fixture.doc || ''}\n\n${truncate(diff, 40)}\n\n` +
            `Full diff: node test/regression/compare.js --only ${fixture.name} --diff`
          );
        }
      } else {
        // Baseline itself failed to compile; assert the failure is unchanged.
        assert.ok(!actual.ok, `now compiles, but did not on ${manifest.ref} — update the baseline`);
        assert.strictEqual(actual.error + '\n', fs.readFileSync(errPath, 'utf8'));
      }
    });
  }
});
