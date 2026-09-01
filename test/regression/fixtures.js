'use strict';

// CSS-output regression fixtures.
//
// Each fixture describes a *configuration* of Foundation, not a syntax. The
// harness renders it into whichever dialect the checked-out tree speaks
// (`@import` + plain assignments, or `@use ... with (...)`), compiles it, and
// normalizes the result. Baselines are generated from a known-good ref, so a
// fixture proves that a given setting still reaches the CSS it is supposed to.
//
// `vars`  - settings to configure before/while loading Foundation.
// `args`  - arguments passed to the `foundation-everything` mixin.
// `probes`- extra declarations appended after Foundation, asserting values that
//           Foundation itself never emits (e.g. a function's return value, or a
//           map that only internal code reads). Written as
//           [selector, property, logical-fn, [args]]; `lib/render.js` owns the
//           per-dialect spelling of each logical-fn.

module.exports = [
  {
    name: 'default',
    doc: 'Stock build. Any diff here is an unintended change to default output.',
  },

  {
    name: 'global-font-size',
    doc:
      'The 62.5%/10px-root idiom. Must change BOTH the emitted root font-size ' +
      'and every rem-calc()-derived length. Catches a util-layer copy of ' +
      '$global-font-size that configuration never reaches.',
    vars: { 'global-font-size': '62.5%' },
    probes: [
      ['.probe-rem-calc-1200', 'width', 'rem-calc', [1200]],
      ['.probe-rem-calc-16', 'width', 'rem-calc', [16]],
    ],
  },

  {
    name: 'breakpoints',
    doc:
      'Custom breakpoint map + classes. Every media query and every ' +
      '.small-/.medium-/.large- class set must follow.',
    vars: {
      breakpoints: '(small: 0, medium: 600px, large: 900px, xlarge: 1300px, xxlarge: 1600px)',
      'breakpoint-classes': '(small medium large xlarge)',
      'print-breakpoint': 'medium',
    },
  },

  {
    name: 'text-direction-rtl',
    doc:
      'RTL build. Every left/right pair flips, and the flex justify maps must ' +
      'agree with each other. Catches a util-layer copy of ' +
      '$global-text-direction that leaves flex helpers stuck in LTR.',
    vars: { 'global-text-direction': 'rtl' },
    probes: [
      ['.probe-justify-global-right', 'justify-content', 'flex-justify-global', ['right']],
      ['.probe-justify-util-right', 'justify-content', 'flex-justify-util', ['right']],
      ['.probe-justify-global-left', 'justify-content', 'flex-justify-global', ['left']],
      ['.probe-justify-util-left', 'justify-content', 'flex-justify-util', ['left']],
    ],
  },

  {
    name: 'palette',
    doc:
      'Custom palette. $primary-color and friends are derived from it by a ' +
      'mixin using !global, so this exercises cross-module mutation.',
    vars: {
      'foundation-palette': [
        '(',
        '  primary: #ff0000,',
        '  secondary: #00ff00,',
        '  success: #0000ff,',
        '  warning: #ff00ff,',
        '  alert: #00ffff',
        ')',
      ].join('\n'),
    },
    probes: [
      ['.probe-get-color-primary', 'color', 'get-color', ['primary']],
      ['.probe-get-color-alert', 'color', 'get-color', ['alert']],
    ],
  },

  {
    name: 'global-misc',
    doc: 'Assorted global settings that components derive spacing/shape from.',
    vars: {
      'global-width': '62.5rem',
      'global-margin': '1.5rem',
      'global-padding': '0.75rem',
      'global-radius': '4px',
      'global-lineheight': '1.4',
      'global-weight-bold': '700',
      'body-font-family': '"Inter", sans-serif',
      'body-background': '#f4f4f4',
      'body-font-color': '#222222',
    },
  },

  {
    name: 'colors-greys',
    doc: 'The grey ramp and black/white, which the util layer also copies.',
    vars: {
      black: '#111111',
      white: '#fafafa',
      'light-gray': '#eeeeee',
      'medium-gray': '#bbbbbb',
      'dark-gray': '#777777',
    },
  },

  {
    name: 'component-vars',
    doc:
      'Per-component settings — the bulk of _settings.scss. Under @import ' +
      'these are plain globals; under the module system they must be reachable ' +
      'through the public entry point.',
    vars: {
      'button-background': '#ff0000',
      'button-radius': '6px',
      'callout-background': '#eeddcc',
      'callout-padding': '2rem',
      'accordion-background': '#fff8f0',
      'card-padding': '1.25rem',
      'table-striped-background': '#f0f0f0',
      'tooltip-background-color': '#333333',
      'reveal-background': '#fdfdfd',
      'menu-item-padding': '0.5rem 1.5rem',
    },
  },

  {
    name: 'grid-flex',
    doc: 'Flex grid (xy-grid off) with a non-default column count.',
    vars: {
      'grid-column-count': '16',
      'grid-row-width': '87.5rem',
    },
    args: { 'xy-grid': 'false' },
  },

  {
    name: 'grid-float',
    doc: 'Legacy float grid.',
    args: { flex: 'false' },
  },

  {
    name: 'xy-grid-gutters',
    doc: 'XY grid with custom gutters and margin/padding gutter split.',
    vars: {
      'grid-margin-gutters': '(small: 10px, medium: 40px)',
      'grid-padding-gutters': '(small: 10px, medium: 40px)',
      'grid-container-padding': '(small: 10px, medium: 40px)',
    },
  },

  {
    name: 'prototype',
    doc: 'Prototype utility classes enabled.',
    args: { prototype: 'true' },
    vars: { 'global-prototype-breakpoints': 'true' },
  },
];
