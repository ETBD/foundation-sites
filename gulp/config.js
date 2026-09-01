module.exports = {

  // Javascript
  JS_BUNDLE_NAMESPACE: '__FOUNDATION_EXTERNAL__',

  JS_FILES: [
    'js/foundation.core.js',
    'js/foundation.core.utils.js',
    'js/foundation.util.*.js',
    'js/*.js'
  ],

  JS_DEPS: [
    'node_modules/jquery/dist/jquery.js',
    'node_modules/motion-ui/dist/motion-ui.js',
    'node_modules/what-input/dist/what-input.js'
  ],

  JS_DOCS: [
    'node_modules/clipboard/dist/clipboard.js',
    'node_modules/corejs-typeahead/dist/typeahead.bundle.js',
    'node_modules/foundation-docs/js/**/*.js',
    'docs/assets/js/docs.*.js',
    'docs/assets/js/docs.js'
  ],

  // Sass
  //
  // `_vendor/sassy-lists` used to be listed here and copied from node_modules on
  // every build by the `sass:deps` task. It no longer is, and that task is gone:
  // those files are now a *maintained* vendored copy, converted from `@import`
  // to `@use`, and tracked in git.
  //
  // Copying over them silently undid that conversion. Upstream sassy-lists has
  // no `@use` rules, so under the module system a cross-file call such as
  // `sl-remove()` -> `sl-replace()` resolves to a plain CSS function and returns
  // the string `"sl-replace(a b c, b, )"` instead of a list. The only
  // configuration that reaches it is the no-flexbox build, so a single
  // `gulp build` broke `assets/foundation-float.scss` and nothing else. The
  // `flexbox-off` regression fixture covers that path.
  //
  // Re-vendoring after a sassy-lists upgrade is now a deliberate step: copy the
  // files in and convert them, rather than letting a build task do it.
  SASS_DEPS_FILES: [],

  SASS_DOC_PATHS: [
    'scss',
    'node_modules/motion-ui/src',
    'node_modules/foundation-docs/scss'
  ],

  SASS_LINT_FILES: [
    'scss/**/*.scss',
  ],

  // Assets
  ASSETS_FILES: [
    'docs/assets/**/*',
    '!docs/assets/{js,scss}',
    '!docs/assets/{js,scss}/**/*'
  ],

  // Dist
  VERSIONED_FILES: [
    'bower.json',
    'composer.json',
    'docs/pages/installation.md',
    'js/foundation.core.js',
    'meteor-README.md',
    'package.js',
    'package.json',
    'scss/foundation.scss',
    'scss/settings/_settings.scss'
  ],

  DIST_FILES: [
    './_build/assets/css/foundation.css',
    './_build/assets/css/foundation.css.map',
    './_build/assets/css/foundation-float.css',
    './_build/assets/css/foundation-float.css.map',
    './_build/assets/css/foundation-prototype.css',
    './_build/assets/css/foundation-prototype.css.map',
    './_build/assets/css/foundation-rtl.css',
    './_build/assets/css/foundation-rtl.css.map',
    '_build/assets/js/foundation.js',
    '_build/assets/js/foundation.js.map',
    'js/typescript/foundation.d.ts'
  ],

  // Tests
  TEST_JS_FILES: [
    'test/javascript/core/**/*.js',
    'test/javascript/util/**/*.js',
    'test/javascript/components/**/*.js'
  ]
};
