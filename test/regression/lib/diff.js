'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// `git diff --no-index` gives a proper unified diff with no diffing dependency,
// and git is already a hard requirement of this repo.
function unifiedDiff(aText, bText, context = 3) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdn-diff-'));
  try {
    const a = path.join(dir, 'baseline.css');
    const b = path.join(dir, 'actual.css');
    fs.writeFileSync(a, aText);
    fs.writeFileSync(b, bText);
    try {
      execFileSync('git', ['diff', '--no-index', `-U${context}`, '--no-color', a, b], {
        encoding: 'utf8',
      });
      return '';
    } catch (err) {
      // git diff exits non-zero when the files differ; stdout holds the diff.
      return (err.stdout || '')
        .split('\n')
        .filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l))
        .join('\n')
        .split(dir)
        .join('')
        .trim();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const countChanges = (diff) =>
  diff ? diff.split('\n').filter((l) => /^[+-]/.test(l)).length : 0;

function truncate(diff, maxLines) {
  const lines = diff.split('\n');
  if (lines.length <= maxLines) return diff;
  return lines.slice(0, maxLines).join('\n') + `\n… ${lines.length - maxLines} more diff line(s)`;
}

module.exports = { unifiedDiff, countChanges, truncate };
