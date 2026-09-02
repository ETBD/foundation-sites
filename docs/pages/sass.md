---
title: Sass
description: Foundation is written in Sass, which allows us to make the codebase customizable and flexible.
video: mYiyunVQdMY
---

<!-- <div class="callout training-callout">
  <p>Get trained up on Foundation's Sass with our online webinar training. Sass allows you to write dramatically more efficient code. We'll go over things like how to install and start compiling Sass, nesting mixins and functions, and writing fully semantic CSS using Foundation mixins for insanely maintainable code.</p>
  <a href="https://zurb.com/university/advanced-foundation-training" target="_blank">Reserve your spot →</a>
</div> -->

<div class="primary callout">
  <p>Not familiar with Sass? The [official tutorial](https://sass-lang.com/guide) on sass-lang.com is a great place to start.</p>
</div>

## Compatibility

<img src="assets/img/logos/sass-logo.svg" alt="Sass logo" class="float-right" style="width: 150px; height: 150px; margin-left: 1rem;">

**Foundation for Sites requires [Dart Sass](https://sass-lang.com/dart-sass/) 1.90.0 or newer.** Either distribution works:

- [`sass`](https://www.npmjs.com/package/sass) **1.90.0+**
- [`sass-embedded`](https://www.npmjs.com/package/sass-embedded) **1.90.0+** — faster, and what Foundation's own build and test suite use

```bash
npm install --save-dev sass-embedded
```

<div class="warning callout">
  <p><strong>Ruby Sass, node-sass and LibSass cannot compile Foundation.</strong> All three are discontinued, and none implements the Sass module system (<code>@use</code> / <code>@forward</code>) that Foundation is built on. If you are still on one of them, migrating to Dart Sass is a prerequisite, not an option.</p>
</div>

The 1.90.0 floor is specific, and worth knowing why. Foundation's entry point
forwards its settings modules so you can configure them, and versions before
1.90.0 reject that arrangement with *"This module was already loaded, so it
can't be configured using `with`"* even when nothing is actually being
reconfigured. 1.89.2 and earlier will not build Foundation.

### Autoprefixer Required

We don't include vendor prefixes in our Sass files&mdash;instead, we let [Autoprefixer](https://github.com/postcss/autoprefixer) handle it for us. Our build process uses [gulp-postcss](https://github.com/postcss/gulp-postcss) with Autoprefixer, but there are [other versions](https://github.com/postcss/autoprefixer#usage) that work with Grunt, Rails, Brunch, and more.

Autoprefixer reads its browser targets from a [Browserslist](https://github.com/browserslist/browserslist) config rather than from options passed in code. Add a `.browserslistrc` to your project root — these are the targets Foundation itself is built against:

```
last 2 versions
> 1%
```

---

## Loading the Framework

If you're using the CLI to create a project, the Sass compilation process is already set up for you. If not, you can compile our Sass files yourself, or drop in a pre-built CSS file.

To get started, first install the framework files using your favorite package manager like npm or yarn.

```bash
npm install foundation-sites --save
```

### Compiling Manually

Next, add the framework files as a load path. How you do this depends on your build process, but the path is the same regardless: `packages_folder/foundation-sites/scss`

Here's an example using the Sass CLI:

```bash
sass --load-path=node_modules/foundation-sites/scss src/app.scss dist/app.css
```

...and one using the JavaScript API:

```js
const sass = require('sass-embedded');

sass.compile('src/app.scss', {
  loadPaths: ['node_modules/foundation-sites/scss'],
});
```

Finally, add a `@use` rule to the top of your primary Sass file. Refer to [Adjusting CSS Output](#adjusting-css-output) below to learn how to control the CSS output of the framework.

```scss
@use 'foundation';

@include foundation.foundation-everything;
```

`@use` namespaces everything Foundation provides under the name of the file you
loaded — `foundation` here — so every mixin and function is reached through it:
`foundation.foundation-everything`, `foundation.rem-calc(16)`,
`foundation.get-color(primary)`. You can pick a shorter name with `as`:

```scss
@use 'foundation' as f;

@include f.foundation-everything;
```

<div class="primary callout">
  <p>If you skip the load path and prefer to reference the package directly, <code>@use 'foundation-sites/scss/foundation'</code> works too — but a load path keeps your own stylesheets shorter and makes them portable.</p>
</div>

### Configuring Foundation

Every setting in Foundation is declared with `!default`, which means you supply
your own values when you load the framework, in a `with (...)` clause:

```scss
@use 'foundation' with (
  $global-font-size: 62.5%,
  $button-radius: 4px,
  $breakpoints: (small: 0, medium: 640px, large: 1024px, xlarge: 1200px, xxlarge: 1440px)
);

@include foundation.foundation-everything;
```

Settings passed this way reach everything derived from them. Setting
`$global-font-size: 62.5%` above changes the root font size *and* rescales every
`rem` length in the framework, because `rem-calc()` reads the same value you set.

A value containing a comma is a Sass list, and a bare comma inside `with (...)`
reads as the next argument — so wrap list and map values in parentheses, as
`$breakpoints` is above.

<div class="warning callout">
  <p><strong>Load Foundation before anything that reaches into it.</strong> A module can only be configured the first time it is loaded, so <code>@use 'foundation' with (...)</code> must come before any <code>@use</code> of a Foundation submodule — directly, or through one of your own partials. Get the order wrong and Sass stops with <em>"This module was already loaded, so it can't be configured using <code>with</code>"</em>.</p>
</div>

```scss
// Wrong — loading a submodule first freezes Foundation at its defaults
@use 'util/unit' as unit;
@use 'foundation' with ($global-font-size: 62.5%);   // Error
```

```scss
// Right — configure first
@use 'foundation' with ($global-font-size: 62.5%);
@use 'util/unit' as unit;
```

In practice you rarely need the second line at all: `@use 'foundation'` already
re-exports the util layer, so `foundation.rem-calc()` and
`foundation.breakpoint()` are available without loading anything else.

### Using Compiled CSS

The Foundation for Sites npm package includes pre-compiled CSS files, in minified (compressed) and unminified flavors. If you're interested in editing the framework CSS directly, use the unminified file. For production, use the minified version.

```html
<link rel="stylesheet" href="node_modules/foundation-sites/dist/css/foundation.css">

<link rel="stylesheet" href="node_modules/foundation-sites/dist/css/foundation.min.css">
```

Pre-built variants are included alongside it: `foundation-float.css` (the legacy
float grid, flexbox off), `foundation-rtl.css` (right-to-left), and
`foundation-prototype.css` (with the prototyping utilities).

---

## Adjusting CSS Output

Foundation outputs many classes for its various components. These help developers get up and running quickly. However, when you move to production, you may wish to build your grid semantically, replace our pre-built classes with your own, or remove components entirely.

Each component has an **export mixin** which prints out the CSS for that component. If you're cool with having everything, you just need one line of code:

```scss
@include foundation.foundation-everything;
```

`foundation-everything` takes three arguments, so you can switch grid modes and
turn on the prototyping utilities without listing components by hand:

```scss
@include foundation.foundation-everything(
  $flex: true,        // false for the legacy float grid
  $prototype: false,  // true to add the prototyping utility classes
  $xy-grid: true      // false for the older flex grid
);
```

Our [starter projects](starter-projects.html) include the full list of includes, making it easy to comment out the components you don't need. A full list is also included below.

```scss
@use 'foundation';

// Global styles
@include foundation.foundation-global-styles;
@include foundation.foundation-forms;
@include foundation.foundation-typography;

// Grids (choose one)
@include foundation.foundation-xy-grid-classes;
// @include foundation.foundation-grid;
// @include foundation.foundation-flex-grid;

// Generic components
@include foundation.foundation-button;
@include foundation.foundation-button-group;
@include foundation.foundation-close-button;
@include foundation.foundation-label;
@include foundation.foundation-progress-bar;
@include foundation.foundation-slider;
@include foundation.foundation-switch;
@include foundation.foundation-table;
// Basic components
@include foundation.foundation-badge;
@include foundation.foundation-breadcrumbs;
@include foundation.foundation-callout;
@include foundation.foundation-card;
@include foundation.foundation-dropdown;
@include foundation.foundation-pagination;
@include foundation.foundation-tooltip;

// Containers
@include foundation.foundation-accordion;
@include foundation.foundation-media-object;
@include foundation.foundation-orbit;
@include foundation.foundation-responsive-embed;
@include foundation.foundation-tabs;
@include foundation.foundation-thumbnail;
// Menu-based containers
@include foundation.foundation-menu;
@include foundation.foundation-menu-icon;
@include foundation.foundation-accordion-menu;
@include foundation.foundation-drilldown-menu;
@include foundation.foundation-dropdown-menu;

// Layout components
@include foundation.foundation-off-canvas;
@include foundation.foundation-reveal;
@include foundation.foundation-sticky;
@include foundation.foundation-title-bar;
@include foundation.foundation-top-bar;

// Helpers
@include foundation.foundation-float-classes;
// @include foundation.foundation-flex-classes;
@include foundation.foundation-visibility-classes;
// @include foundation.foundation-prototype-classes;
```

### Using Foundation's Functions and Mixins

The same namespace gives you the util layer, so you can build your own styles on
Foundation's breakpoints, colors and units:

```scss
@use 'foundation' with ($global-font-size: 62.5%);

@include foundation.foundation-everything;

.hero {
  padding: foundation.rem-calc(40);
  color: foundation.get-color(primary);

  @include foundation.breakpoint(medium) {
    padding: foundation.rem-calc(80);
  }
}
```

See [Sass Functions](sass-functions.html) and [Sass Mixins](sass-mixins.html) for the full list.

---

## The Settings File

All Foundation projects include a settings file, named `_settings.scss`. If you're using the CLI to create a Foundation for Sites project, you can find the settings file under scss/ (basic template) or src/assets/scss/ (ZURB template). If you're installing the framework standalone using npm, there's a settings file included in this package, which you can move into your own Sass files to work with.

**[Download the latest settings file here](https://raw.githubusercontent.com/foundation/foundation-sites/develop/scss/settings/_settings.scss)**, add it to your project as `_settings.scss`, and edit it there.

The file is one big `with (...)` clause listing every setting Foundation has, at
its default, commented out. Uncomment the ones you want to change:

```scss
// _settings.scss
@use 'foundation' with (
  // 1. Global
  // ---------
  $global-font-size: 100%,
  // $global-lineheight: 1.5,
  $global-radius: 4px,          // <- uncommented and changed
  // ...
);
```

Because the settings file is what loads Foundation, `@use` it *before* Foundation
in your main stylesheet:

```scss
// app.scss
@use 'settings';
@use 'foundation';

@include foundation.foundation-everything;
```

Both rules resolve to the same module instance, so the settings you set are the
ones Foundation compiles with. Anything you leave commented out keeps tracking
the framework default, including across upgrades.

<div class="callout">
  <p>Settings whose defaults are marked <em>derived</em> in the file reference another setting (<code>$callout-background: $white</code>) or call a Foundation function (<code>$global-width: rem-calc(1200)</code>). They are listed so you can see what the default is, but those names are not in scope in your stylesheet — replace the value with a concrete one if you uncomment the line.</p>
</div>

<div class="callout warning">
  <p>Once you've set up a new project, your settings file can't be automatically updated when new versions change, add, or remove variables. Keep tabs on new <a href="https://github.com/foundation/foundation-sites/releases">Foundation releases</a> so you know when things change.</p>
</div>

Every component includes a set of variables that modify core structural or visual styles. If there's something you can't customize with a variable, you can just write your own CSS to add it. Here's an example set of settings, which change the default styling of [buttons](button.html):

```scss
@use 'foundation' with (
  $button-padding: 0.85em 1em,
  $button-margin: 0 0 1rem 0,
  $button-fill: solid,
  $button-background: #1779ba,
  $button-color: #fff,
  $button-color-alt: #000,
  $button-radius: 4px,
  $button-border: 1px solid transparent,
  $button-sizes: (tiny: 0.7, small: 0.8, medium: 1, large: 1.3),
  $button-opacity-disabled: 0.25
);
```

---

## Upgrading from `@import`

Earlier versions of Foundation were loaded with `@import` and configured by
assigning variables before it:

```scss
// The old way
$button-radius: 4px;
@import 'foundation';
@include foundation-everything;
```

**This still works**, so existing projects keep compiling — but it relies on
`@import`, which Dart Sass has deprecated and will remove. The module syntax is
the supported path forward. Converting is mechanical:

1. Replace `@import 'foundation'` with `@use 'foundation'`.
2. Move the variable assignments above it into a `with (...)` clause, dropping
   the trailing semicolons for commas.
3. Prefix Foundation's mixins and functions with the namespace —
   `foundation-everything` becomes `foundation.foundation-everything`, and
   `rem-calc(16)` becomes `foundation.rem-calc(16)`.
4. Make sure the `@use` of Foundation comes before anything that loads a
   Foundation submodule. See the ordering note in [Configuring
   Foundation](#configuring-foundation).

Two API changes come with the move:

- **`add-foundation-colors()` is deprecated and does nothing.** `$primary-color`
  and its siblings are now derived from `$foundation-palette` automatically, so
  setting the palette is enough. The mixin is kept as a no-op so existing
  settings files still compile; you can delete the call.
- **`-zf-to-rem()` is now `zf-to-rem()`.** Names with a leading hyphen are
  private to their module under `@use` and cannot be reached from outside, so
  the internal helpers the test suite and advanced users reach for lost the
  prefix.

[The Sass module system](https://sass-lang.com/blog/the-module-system-is-launched/) has more on `@use` and `@forward` generally.
