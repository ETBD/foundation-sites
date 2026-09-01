'use strict';

const postcss = require('postcss');

// Canonicalizes compiled CSS so that a text diff only reports *semantic*
// differences.
//
// Neutralized (pure formatting, no effect on rendering):
//   - selector list line-wrapping and internal whitespace
//   - the order of selectors within one comma-separated list
//   - whitespace inside declaration values and at-rule params
//   - comments (the version banner differs between refs)
//
// Preserved (all of it affects the cascade):
//   - rule order, declaration order within a rule
//   - at-rule nesting and params
//   - every property and value

// Split a selector list on top-level commas only: commas inside :not(),
// :is(), attribute strings etc. are part of a single selector.
function splitSelectors(selector) {
  const out = [];
  let depth = 0;
  let quote = null;
  let buf = '';

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];

    if (quote) {
      buf += ch;
      if (ch === quote && selector[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;

    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  out.push(buf);

  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function canonicalSelector(selector) {
  // Sorting is safe: within one rule, selector order carries no meaning.
  return splitSelectors(selector).sort().join(', ');
}

const collapse = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');

function emit(container, indent, lines) {
  const pad = '  '.repeat(indent);

  container.each((node) => {
    if (node.type === 'comment') return;

    if (node.type === 'decl') {
      lines.push(`${pad}${collapse(node.prop)}: ${collapse(node.value)}${node.important ? ' !important' : ''};`);
      return;
    }

    if (node.type === 'rule') {
      lines.push(`${pad}${canonicalSelector(node.selector)} {`);
      emit(node, indent + 1, lines);
      lines.push(`${pad}}`);
      return;
    }

    if (node.type === 'atrule') {
      const head = `@${collapse(node.name)}${node.params ? ' ' + collapse(node.params) : ''}`;
      if (node.nodes) {
        lines.push(`${pad}${head} {`);
        emit(node, indent + 1, lines);
        lines.push(`${pad}}`);
      } else {
        lines.push(`${pad}${head};`);
      }
    }
  });
}

function normalize(css) {
  const root = postcss.parse(css);
  const lines = [];
  emit(root, 0, lines);
  return lines.join('\n') + '\n';
}

module.exports = { normalize, splitSelectors, canonicalSelector };
