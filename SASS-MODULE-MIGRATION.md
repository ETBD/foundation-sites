# Sass module migration — config module implementation plan

Status: **plan, not yet implemented.** Branch: `feature/dart-sass`.

## Why this is needed

The branch converts Foundation from `@import` to `@use`/`@forward`. The
conversion was done mechanically, file by file: imports became `@use`, and
function and variable references were namespaced. It compiles with zero errors.

What was *not* converted is Foundation's configuration architecture, and that
architecture is built on the one thing `@use` removes — `@import`'s single flat,
mutable, global scope. Two consequences:

**Circular dependencies were broken by duplicating settings.** `_global.scss`
needs functions from `util/*`; `util/*` needs variables from `_global.scss`.
`@import` did not care; `@use` forbids it. Rather than extract a shared module,
the cycle was cut by copying variable defaults into the util layer — see the
comment "Local defaults matching _global.scss to avoid circular dependency" in
`scss/util/_color.scss`. One logical setting now has two values, and only one is
reachable by configuration.

The failure is silent. With `$global-font-size: 62.5%`:

```css
html { font-size: 62.5%; }              /* global's copy — honored */
.grid-container { max-width: 75rem; }   /* rem-calc(1200) — should be 120rem */
```

`rem-calc()` reads `util/_unit.scss`'s private copy, stuck at `100%`. Every rem
length in the framework is off by 1.6x while the root font-size does change.

RTL is the same bug, and it produces two contradictory answers in one compile:

```css
.a              { justify-content: flex-end; }    /* flex.flex-align(right) — stale LTR */
.c-globalmodule { justify-content: flex-start; }  /* global.$zf-flex-justify — correct RTL */
```

**The settings API no longer exists.** `scss/foundation.scss` forwards exactly
one module (`@forward "global"`), so every util- and component-level setting is
unreachable:

```
@use "foundation" with ($breakpoints: (...))      → Error: not declared with !default
@use "foundation" with ($button-background: red)  → Error: not declared with !default
```

`$breakpoints` — the most-configured setting in Foundation — moved into
`scss/util/_breakpoint.scss` and cannot be customized at all. And
`scss/settings/_settings.scss`, the 916-line file every consumer copies and
edits, is now inert: it declares plain non-`!default` variables in its own
private namespace, nothing reads them, and both references to it in
`foundation.scss` are commented out.

## Verified constraints

Four spikes, run against this tree's Sass 1.99. Each one is load-bearing for the
design below; re-run them before deviating from it.

1. **Configuration propagates through a `@forward` chain into a leaf module.**
   `@use "fdn" with ($global-font-size: 62.5%)` where `fdn` forwards `cfg` and
   `cfg` forwards `core`: a util that `@use`s `core` sees 62.5%. Returned
   `120rem`, not `75rem`. This is the entire fix.
2. **Derived settings stay independently overridable.** `$width: u.rem(1200)
   !default` in the config layer can still be set directly at the entry point.
3. **Loading a util before configuring is a hard error** — "This module was
   already loaded, so it can't be configured using with." Loud, not silent, but
   it constrains the public API. See Risks.
4. **Two forwarded modules defining the same name is a hard error** — "Two
   forwarded modules both define a variable named $x." Deduplication is
   therefore a prerequisite, not a cleanup.

## Target layering

```
_core-settings.scss   leaf: literal settings the util layer reads. @use "sass:*" only.
        ↑
   util/*.scss        functions/mixins. @use "../core-settings". No local copies.
        ↑
_config.scss          @forward "core-settings" + settings that need util functions
        ↑
_global.scss, components/*, forms/*, grid/*, xy-grid/*   @use "../config"
        ↑
foundation.scss       @forward "config" + @forward each settings-bearing module
```

The cycle that forced the duplication breaks because every setting the util layer
reads is a **literal** — `$breakpoints`, `$foundation-palette`, the grey ramp,
`$global-font-size`. Verified: none of them call a function. Only
`$global-width: rem-calc(1200)` and `$zf-flex-justify` are function-derived, and
those sit one layer up in `_config.scss`.

## Scale

| area | `!default` settings |
|---|---|
| `components/` | 261 |
| `forms/` | 71 |
| `typography/` | 60 |
| `prototype/` | 32 |
| `_global.scss` | 25 |
| `xy-grid/` | 14 |
| `grid/` | 11 |
| **total** | **492** |

517 distinct top-level variable names. 24 of them are declared in more than one
module, across 57 declaration sites. 70 files currently `@use "global"`.

## Phases

### Phase 0 — unblock verification

Independent of the config work, but until these are fixed the regression harness
cannot show a clean signal for the default build.

- **Three trailing-comma list corruptions.** A formatter pass turned
  `(base size gutters)` into `(base size gutters,)`, which in Sass is a
  1-element *comma* list whose sole element is the space-separated list. So
  `list.index($output, base)` returns `null`, every branch in `xy-cell` is
  skipped, and the mixin emits nothing. The `.cell` base rule — the fundamental
  XY-grid primitive — is missing from the stock build, and the regression is
  already committed into `dist/css/foundation.css`.
  Sites: `scss/xy-grid/_cell.scss:265`, `scss/xy-grid/_classes.scss:164`
  and `:182`.
- **`$grid-column-count` shadow.** `scss/grid/_row.scss:18` declares
  `$grid-column-count: null` as scratch space for `grid-context`'s `!global`
  mutation, but `scss/grid/_classes.scss:114` reads *that* rather than the real
  `vars.$grid-column-count: 12`, so the float grid cannot compile at all
  (`null is not a number`). `grid-context` is also incoherent: it saves
  `vars.$grid-column-count` and restores into `row.$grid-column-count`.

Expected: `default` and `grid-float` go green.

### Phase 1 — `scss/_core-settings.scss`

Create the leaf module with the ~16 settings the util layer reads:
`$global-font-size`, `$global-text-direction`, `$global-flexbox`,
`$foundation-palette`, `$black`, `$white`, `$light-gray`, `$medium-gray`,
`$dark-gray`, `$global-color-pick-contrast-tolerance`, `$contrast-warnings`,
`$unit-warnings`, `$breakpoints`, `$breakpoints-hidpi`, `$print-breakpoint`,
`$breakpoint-classes`.

Then delete the local copies from `util/_unit.scss`, `_color.scss`, `_flex.scss`,
`_mixins.scss` and `_breakpoint.scss` and point them at it.

This alone fixes the entire silent-divergence class.

While here: with `$foundation-palette` in a leaf module, `$primary-color` and
friends become plain `!default` derivations in `util/_color.scss` and the
`!global` mutation in `add-foundation-colors` disappears. Keep the mixin as a
deprecated no-op for back-compatibility.

Expected: `global-font-size`, `text-direction-rtl`, `colors-greys` go green.

### Phase 2 — deduplicate 24 names across 57 sites

Blocks Phase 4 (constraint 4: hard error). Pattern: one module owns the
declaration, everyone else `@use`s it.

- `$form-spacing` — **9** sites across `forms/`. Needs a new `forms/_vars.scss`.
- `grid/_grid.scss` vs `grid/_vars.scss` — `_vars.scss` owns.
- `xy-grid/_xy-grid.scss` vs `xy-grid/_vars.scss` — `_vars.scss` owns.
- The `_global.scss`/util overlaps resolve themselves in Phase 1.

### Phase 3 — `scss/_config.scss`

Forwards `core-settings`, `@use`s the util layer freely, and holds the settings
that need functions — `$global-width`, `$zf-flex-justify`, and the rest of
`_global.scss`'s 25. `_global.scss` keeps only `foundation-global-styles` and
`@use`s config. The 70 files that `@use "global"` mostly repoint to `config`.

### Phase 4 — entry point aggregation

`scss/foundation.scss` gains a `@forward` per settings-bearing module. This is
what makes the remaining 467 component settings reachable.

Expected: `breakpoints`, `component-vars`, `grid-flex`, `xy-grid-gutters`,
`global-misc` go green.

### Phase 5 — `scss/settings/_settings.scss`

Rewrite as the `@use "foundation" with (...)` template consumers copy, and
repoint the octophant generator at `gulp/tasks/deploy.js:146` to emit that shape.

### Phase 6 — mutable `!global` state

`$zf-size` (`util/_breakpoint.scss:18`), `$zf-bp-value`
(`util/_mixins.scss:25`), the off-canvas z-indexes. These are module-*private*
scratch state and legal under `@use`. The one that warrants attention is the
cross-module setter mixin at `util/_breakpoint.scss:236`, added because other
modules "need to update `$zf-size` ... without direct !global access."

**Recommendation: leave these, document them, revisit separately.** Folding a
mutable-state redesign into the config refactor doubles the blast radius for no
test-visible gain.

### Phase 7 — tests

- **Required harness change.** `test/regression/lib/render.js` emits probe `@use`
  lines *before* `@use 'foundation' with (...)`, which trips the Phase-1 ordering
  error (constraint 3). Emit the foundation `@use` first.
- Migrate `test/sass/`. Only `_color.scss` was converted; `_breakpoint`,
  `_components`, `_selector`, `_unit` and `_value` still use `@import` and old
  names, so the suite aborts during load rather than failing a test. It is
  blocked on the same public/private naming decisions this refactor makes
  (`-zf-bp-serialize` → `zf-bp-serialize`).
- Widen the `component-vars` fixture once Phase 4 lands. It currently fails on
  the first setting it tries, so broader coverage adds no signal until then.

## Risks

**The ordering constraint is a public API change.** After Phase 1, a consumer who
`@use`s any Foundation submodule before configuring `foundation` gets a hard
error. This is inherent to the module system rather than to this design, but it
needs release-note treatment.

**492 settings is a large mechanical surface.** Phases 1 and 2 carry the design
risk; 3 and 4 are repetitive but wide. The harness gates each phase, which is why
Phase 0 comes first.

**sassdoc grouping shifts** when settings change files, affecting the docs build.

## Verification

`yarn test:regression` after each phase — see `test/regression/README.md`.

| after | expected green |
|---|---|
| Phase 0 | `default`, `grid-float`, `prototype`, `palette` |
| Phase 1 | `+ global-font-size`, `text-direction-rtl`, `colors-greys` |
| Phase 4 | `+ breakpoints`, `component-vars`, `grid-flex`, `xy-grid-gutters`, `global-misc` |

All 12 green means the migration produces byte-identical CSS to `develop` across
every configuration tested. That is the bar for shipping this.

The Sass unit suite (`yarn test:sass`) is not a substitute: it exercises util
functions in isolation with default settings, so it would pass green while every
bug described above was live.
