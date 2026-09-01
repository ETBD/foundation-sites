'use strict';

// Generates the settings template consumers copy and edit.
//
// Foundation used to ship an `@import`-era settings file: an import list plus
// one plain `$name: value;` assignment per setting. That shape worked only
// because `@import` gave every stylesheet one flat, mutable global scope, so
// assigning `$button-background` before importing Foundation beat the
// framework's `!default`.
//
// Under `@use` there is no such scope. A consumer configures Foundation by
// passing values into the module as it is loaded:
//
//   @use "foundation" with ($button-background: red);
//
// so the template is one `with (...)` block listing every setting, commented
// out, at its framework default. The consumer uncomments the lines they want.
//
// Grouping, group naming, and section order come from sassdoc via octophant's
// `processSassDoc` -- the same data octophant itself uses -- but the file is
// written here rather than by octophant, which emits the `@import` shape and
// calls back before its write stream has flushed.
//
// Two constraints shape the output:
//
//   * A `with (...)` block containing only comments is a *syntax* error
//     ('expected "$"'), so one entry has to stay live. `$global-font-size` is
//     the anchor: the value emitted for it is Foundation's own default, so
//     leaving it uncommented changes nothing.
//
//   * Each value is evaluated in the *consumer's* scope, not Foundation's.
//     Defaults that reference another setting (`$callout-background: $white`)
//     or call a framework function (`rem-calc(1200)`) are shown for reference
//     but cannot be uncommented as-is -- they need a concrete value. They are
//     marked so that is not a surprise at compile time.

const fs = require('fs');
const path = require('path');
const sassdoc = require('sassdoc');
const processSassDoc = require('octophant/lib/processSassDoc');

const ANCHOR = 'global-font-size';

// A default that mentions a `$variable` or calls a function is not
// self-contained, so it cannot be pasted into `with (...)` unchanged.
function isSelfContained(value) {
  return !/\$[\w-]/.test(value) && !/[\w-]\s*\(/.test(value);
}

// Defaults are read out of Foundation's own source, where every cross-module
// reference carries the namespace the *framework* uses internally
// (`config.$light-gray`, `unit.rem-calc(1200)`). Those namespaces do not exist
// in a consumer's stylesheet, and showing them would suggest the consumer needs
// them. Strip them so a derived default reads the way the consumer would write
// it -- `$light-gray`, `rem-calc(1200)`. `sass:` namespaces (`map.get`) are
// left alone, since those are real modules a consumer would `@use` too.
const SASS_BUILTINS = new Set([
  'color', 'list', 'map', 'math', 'meta', 'selector', 'string',
]);

function stripNamespaces(value) {
  return value
    .replace(/\b([a-z][\w-]*)\.\$/g, (m, ns) => (SASS_BUILTINS.has(ns) ? m : '$'))
    .replace(/\b([a-z][\w-]*)\.([\w-]+\s*\()/g, (m, ns, fn) =>
      SASS_BUILTINS.has(ns) ? m : fn
    );
}

function header(title, sections) {
  const lines = [
    `//  ${title}`,
    `//  ${'-'.repeat(title.length)}`,
    '//',
    '//  Copy this file into your own project and edit it there.',
    '//',
    '//  Every setting is listed at its Foundation default and commented out.',
    '//  Uncomment the ones you want to change; anything you leave alone keeps',
    '//  tracking the framework default, including across upgrades.',
    '//',
    '//  Lines marked "derived" reference another setting or call a Foundation',
    '//  function. They are shown so you can see what the default is, but the',
    '//  value is evaluated in your stylesheet, where those names are not in',
    '//  scope -- so replace it with a concrete value if you uncomment one.',
    '//',
    '//  Table of Contents:',
    '//',
  ];
  sections.forEach((name, i) => lines.push(`//  ${i + 1}. ${name}`));
  return lines;
}

// `data` is processSassDoc's output: an ordered map of section name to sassdoc
// variable definitions.
function render(title, data) {
  const sections = Object.keys(data);
  const out = header(title, sections);

  out.push('');
  out.push('@use "foundation" with (');

  sections.forEach((name, i) => {
    const label = `${i + 1}. ${name}`;
    if (i > 0) out.push('');
    out.push(`  // ${label}`);
    out.push(`  // ${'-'.repeat(label.length)}`);

    for (const variable of data[name]) {
      const varName = variable.context.name;
      const value = stripNamespaces(variable.context.value);
      const lines = `$${varName}: ${value},`.split('\n');

      if (varName === ANCHOR) {
        // The one live entry, so the block is never empty. Same as the default.
        out.push(lines.map((l) => `  ${l}`).join('\n'));
      } else {
        const note = isSelfContained(value) ? '' : '  // derived';
        out.push(lines.map((l, n) => `  // ${l}${n === 0 ? note : ''}`).join('\n'));
      }
    }
  });

  out.push(');');
  out.push('');
  return out.join('\n');
}

function countSettings(data) {
  return Object.keys(data).reduce((n, k) => n + data[k].length, 0);
}

/**
 * Parses `src` with sassdoc and writes the settings template to `options.output`.
 *
 * @param {string} src - Directory of Sass to document.
 * @param {object} options - `title`, `output`, and the `groups`/`sort` maps
 *   that octophant's processSassDoc understands.
 * @returns {Promise<number>} Number of settings written.
 */
function generate(src, options) {
  return sassdoc.parse(src).then((tree) => {
    const data = processSassDoc(tree, options.groups || {}, (options.sort || []).slice());
    const anchored = Object.keys(data).some((k) =>
      data[k].some((v) => v.context.name === ANCHOR)
    );
    if (!anchored) {
      throw new Error(
        `settings template: anchor $${ANCHOR} not found, so the with() block ` +
        'would contain only comments and fail to parse.'
      );
    }

    const outputPath = path.resolve(options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, render(options.title, data));
    return countSettings(data);
  });
}

module.exports = { generate, render, isSelfContained, stripNamespaces, ANCHOR };
