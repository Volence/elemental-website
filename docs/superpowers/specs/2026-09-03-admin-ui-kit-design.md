# Admin UI Kit (P3) - Design

**Date:** 2026-09-03
**Program:** Admin UX cohesion (see `docs/superpowers/audits/2026-09-02-admin-ux-audit.md`, Part 3 item P3)
**Status:** draft for review

## 1. Problem

The admin panel has one nominal styling system (51 SCSS partials behind `custom.scss`) and four actual ones: 110 components with inline `style={{}}`, 17 with CSS-in-template-string `<style>` tags, 8 with styled-jsx, and 11 with Tailwind classes that render nothing because Tailwind is not loaded in the admin bundle. Design tokens exist only as SCSS variables, which TSX cannot read, so colours are hard-coded hundreds of times and have drifted. There is no shared tab bar (13 hand-rolled), page header (8 treatments), page width (11 values), stat card (4 React + 10 SCSS), empty state (8), table (11 class roots), modal (13 shells, one with Escape), or search input (34 variants). Dates render in 26 formats, "no value" in 5 glyphs, person names via 13 resolvers.

Every later UX sub-project (P4 to P10) either builds on shared primitives or re-invents them a 14th time. P3 is the foundation.

## 2. Goals

1. One set of design tokens reachable from both SCSS and TSX.
2. A small set of admin primitives that cover what every dashboard needs: page shell, header, tabs, modal, table, badge, stat card, empty and loading and error states, search input, avatar.
3. One formatter module for dates, numbers, records, person labels and the empty placeholder.
4. Accessibility built into the primitives once: tab semantics with arrow keys, modal focus trap and Escape and scroll lock, right-aligned numeric columns, scroll wrappers on tables, contrast-safe text tokens.
5. Delete the dead styling layer and stop the Tailwind-in-admin confusion.
6. Prove the kit by migrating the PUG dashboard (the worst offender) to it.

## 3. Non-goals

- No visual redesign. The kit codifies the existing "Clean Glow" dark look; it does not invent a new one.
- No changes to Payload's own list or edit views, only to custom views.
- No touching People, auth, Access Review rules, or the person editors (identity program, steps 2 and 3).
- No sidebar or URL scheme changes (P4a, P4b).
- No light mode for the admin.

## 4. Decisions already made

- **Tailwind is stripped from the admin** (user decision). Dead Tailwind class strings in the 11 admin files are removed or replaced with kit classes. `components.json` is fixed to point at `tailwind.config.mjs` so shadcn generation stops mis-signalling that frontend components are usable in admin.
- **Green means terminal success only** (complete, win, healthy). Priority uses a neutral-to-red ramp, PUG "open for queue" uses info blue, tier bands use `tierColors` only.
- **Empty placeholder is the hyphen** `-` (the project forbids em dashes anywhere).
- **Mobile matters.** The kit's layout primitives collapse at 1024 and 768 and never rely on inline `gridTemplateColumns`.

## 5. Design

### 5.1 Tokens

`src/app/(payload)/styles/_variables.scss` stays the source of truth. A new partial `_tokens-css.scss`, imported right after `_variables`, emits every token as a CSS custom property on `:root` with the prefix `--elmt-`:

```
--elmt-accent-primary / -success / -warning / -error / -info
--elmt-tier-masters ... --elmt-tier-below
--elmt-bg-base / -elevated / -surface / -card / -hover
--elmt-border-subtle / -default / -strong
--elmt-text-primary / -secondary / -muted / -disabled
--elmt-space-xs ... -3xl
--elmt-font-xs ... -3xl
--elmt-radius-xs ... -full
--elmt-elevation-1 / -2 / -3
--elmt-container-xs ... -2xl
--elmt-z-dropdown / -sticky / -modal / -tooltip
```

Two token changes ride along, because the audit measured them as the dominant accessibility failure:

- `$admin-text-muted` rises from 50% to 60% white and `$admin-text-disabled` from 30% to 45%, putting both above 4.5:1 on the card background. Everything already using these tokens gets the fix for free.
- A new `$font-size-2xs: 0.6875rem` (11px) is added as the floor for labels; content text never goes below `$font-size-xs` (12px).

A TypeScript mirror `src/admin-kit/tokens.ts` exports the same names as `var(--elmt-...)` strings for the rare inline style that must remain (chart SVG fills, dynamic widths). It contains no hex values.

### 5.2 Primitives

All live in `src/admin-kit/` with one SCSS partial each under `src/app/(payload)/styles/kit/`, imported by the barrel. Class prefix `kit-`. Every primitive is a client component with no data fetching.

| Primitive | Props (essentials) | Notes |
|---|---|---|
| `AdminPage` | `width: 'narrow' \| 'default' \| 'wide' \| 'full'`, `children` | Maps to `--elmt-container-md / -lg / -xl / 100%`. Centered. Owns page padding (24px, 16px below 768). Sets `overflow-x: auto` on itself so wide content scrolls instead of being clipped (fixes the `overflow-x: hidden` on `main` found in `_base.scss`). |
| `AdminPageHeader` | `title`, `subtitle?`, `actions?`, `breadcrumbs?: {label, href?}[]`, `icon?` | Renders the one h1 treatment (gradient underline via the existing mixin). Calls `useStepNav` with the breadcrumbs and sets `document.title` to `"<title> - Elemental Admin"`. |
| `AdminTabs` | `tabs: {id, label, icon?, hidden?}[]`, `active`, `onChange`, `mode: 'url' \| 'state'`, `param?` (default `tab`) | `mode='url'` reads and writes `?tab=` via `router.replace` so back button and deep links work. Renders `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`; Left and Right arrow keys move focus, Home and End jump. Styled from the existing `dashboard-tabs` mixins with the accent passed as a prop (default info). Horizontal scroll on overflow. |
| `AdminModal` | `open`, `onClose`, `title`, `children`, `footer?`, `size: 'sm' \| 'md' \| 'lg'`, `closeOnBackdrop=true` | Portal to body. `role="dialog"`, `aria-modal`, labelled by the title. Escape closes. Focus moves to the panel on open, is trapped inside, and returns to the opener on close. Body scroll locked while open. `ConfirmDialogProvider` is rebuilt on top of it so its 21 consumers gain Escape and scroll lock without changes. |
| `AdminTable` | `columns: {key, header, align?: 'left' \| 'right', width?, render?(row), sortable?}[]`, `rows`, `rowKey`, `sort?`, `onSort?`, `onRowClick?`, `rowHref?(row)`, `emptyMessage`, `loading`, `footer?` | Wrapped in a scroll container. Sticky header. Numeric columns declare `align: 'right'` and get `font-variant-numeric: tabular-nums`. Row click renders a real `<a>` when `rowHref` is given (middle click works); otherwise a `<tr role="button" tabIndex=0>` with Enter handling. Renders `EmptyState` or skeleton rows itself. No pagination inside; pair with `AdminPagination`. |
| `AdminPagination` | `page`, `pageSize`, `total`, `onPage` | Standard "1 to 25 of 912" plus prev and next. Default page size 25. |
| `Badge` | `tone: 'neutral' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'accent'`, `size?`, `dot?` | Semantic only. Feature code maps its enum to a tone through a `LABELS` and `TONES` map; it never passes a colour. |
| `StatCard` | `label`, `value`, `hint?`, `tone?`, `href?`, `icon?` | Replaces `ScrimShared.StatCard`, the two local `StatCard`s in `ScrimMapDetail`, `MiniStatCard`, and the SCSS families over time. |
| `EmptyState` | `title`, `hint?`, `action?`, `icon?` | Copy convention: title in the form "No X yet" for onboarding, "No X match" for filtered results. Replaces the existing unused `components/EmptyState` (deleted). |
| `LoadingState` | `rows?: number` | Skeleton lines; the one loading treatment. `ScrimShared.LoadingCard` becomes a re-export. |
| `ErrorState` | `message`, `onRetry?` | `role="alert"`. `ScrimShared.ErrorCard` becomes a re-export. |
| `SearchInput` | `value`, `onChange`, `placeholder`, `debounceMs=300`, `autoFocus?` | `type="search"`, clear button, debounced `onChange`, Escape clears, `/` focuses it when no input is focused (opt-in via `hotkey` prop). |
| `Avatar` | `src?`, `name`, `size: 20 \| 24 \| 32 \| 40` | Two-letter initials fallback, `?size=` appended to Discord CDN URLs, `width` and `height` set, `loading="lazy"`, `alt` = name. |
| `SectionCard` | `title?`, `actions?`, `children` | The generic panel with the Clean Glow border. Replaces `.ps-card`, `.profile-card`, `.ar-stat`, `.scrim-card` over time. |

`useUrlParamState` moves from `ScrimShared` to `src/admin-kit/hooks.ts` unchanged; `AdminTabs` uses it.

### 5.3 Formatters

`src/admin-kit/format.ts`, all pure and unit tested:

| Function | Output |
|---|---|
| `formatDate(iso)` | `Aug 30, 2026` |
| `formatDateTime(iso)` | `Aug 30, 2026, 7:10 PM EDT` (always with timezone) |
| `formatTime(iso)` | `7:10 PM EDT` |
| `formatRelative(iso, now?)` | `just now`, `5m ago`, `3h ago`, `2d ago`, `Aug 30` beyond 30 days, `not recorded` for null |
| `formatNumber(n)` | thousands separators, no decimals |
| `formatPercent(ratio)` | integer 0 to 100 with `%` |
| `formatCompact(n)` | `1.2k` lowercase above 1000 |
| `formatRecord({w,l,d})` | `3-1-1` (column sublabel `W-L-D`) |
| `getPersonLabel(ref)` | `name`, else `email`, else `Unnamed person`. Never exposes ids. |
| `EMPTY` | the string `-` |

`utilities/formatDateTime.ts` keeps its exports but delegates to these so its 7 consumers do not change. `ScrimShared/tokens.ts` `RANGE_OPTIONS` is deleted (dead); `RangeFilter` keeps the live copy.

### 5.4 Deletions and repairs bundled with the kit

- Delete `styles/admin.scss` (byte-identical duplicate), `custom.scss.backup`, `_utility-classes.scss`, `components/SectionWrapper.tsx`, `components/EmptyState`, `components/PageRange`, `components/Pagination` and `components/ui/pagination.tsx`, `components/SkeletonLoader`, `components/UsersListRedirect`, the five PUG `ListRoute.tsx` files and `SettingsGenerator/Route.tsx`.
- Remove dead Tailwind class strings from: `BeforeDashboard/DataConsistencyCheck/*`, `SeedButton`, `FixStaffButton`, `MatchesSearchBar`, `RecruitmentFields/TeamRelationshipField`, `PugInviteGenerator`, `LiveChannelsClient`, `ParticleBackground` (admin usage only). Where the classes carried meaning (status pills), replace with `Badge`.
- Fix `components.json` `tailwind.config` path.
- Remove `FixDatePickerIcons` and its MutationObserver; move the date-picker fix to `_forms.scss`.
- Move `SectionThemeApplicator` from `beforeDashboard` to `providers` so section theming applies on every route, and add the missing `pugs`, `competitive`, `scouting` sections. (Or delete it if, once it actually runs, the team dislikes per-section colouring. Decide during implementation by turning it on in dev.)
- Fix `_base.scss` `overflow-x: hidden` on `main` to `overflow-x: auto`.
- Add `@import '../variables'` to the 18 partials that rely on barrel order.
- Reconcile `REFACTOR_SUMMARY.md` and the `admin.scss` header claim about `!important` counts (delete the summary; the audit doc is the record).

### 5.5 Proof: PUG dashboard on the kit

The PUG dashboard becomes the reference implementation:

- `PugDashboard/index.tsx` wraps everything in `AdminPage width="default"`, `AdminPageHeader title="PUG Dashboard"`, and `AdminTabs mode="url"`. Tab content no longer changes width or alignment between tabs.
- Every tab drops `PUG_ADMIN_CSS` and `.settings-gen__*` and inline panels in favour of `SectionCard`, `Badge`, `StatCard`, `EmptyState`, `LoadingState`, `SearchInput`.
- Players tab becomes an `AdminTable` with search, tier and region and banned filters, a battletag column, and a rating column joined from `pug-leaderboard` for the active season. Row click opens the edit view. (The Prisma-backed Matches and Leaderboard rebuild is P5; P3 only restyles what exists and removes the dead back-button targets.)
- Invite status pills become `Badge` tones (fixes the dead Tailwind bug).
- Moderation gets a page header like the other tabs.

Acceptance: switching between all nine tabs at 1280px and at 768px with the sidebar open produces no horizontal page scroll and no content clipping; the browser back button returns to the previous tab; every `<h1>` and `<h2>` on the dashboard is white with the gradient underline.

### 5.6 Rollout slices (each independently deployable)

1. Tokens partial + `tokens.ts` + contrast token bump + `overflow-x` fix + dead layer deletion + Tailwind strip + `components.json`. No component changes. Visual diff limited to slightly brighter muted text.
2. Formatters + tests. No consumers yet except `utilities/formatDateTime.ts` delegating.
3. `AdminModal` + `ConfirmDialogProvider` rebuilt on it. 21 consumers gain Escape and scroll lock.
4. `AdminTabs`, `AdminPage`, `AdminPageHeader`, `SectionCard`, `Badge`, `StatCard`, `EmptyState`, `LoadingState`, `ErrorState`, `SearchInput`, `Avatar`, `AdminTable`, `AdminPagination`. `ScrimShared` re-exports the overlapping ones.
5. PUG dashboard migration (proof).
6. System Health hub moves to `AdminTabs` and `AdminPage` (small, second consumer, validates `mode='url'` against its existing `?tab=` contract).

Later sub-projects (P5 to P8) each migrate their own surfaces.

## 6. Testing

- Vitest unit tests for every formatter and for `normalizeTabParam`, `getPersonLabel`, tone maps.
- React Testing Library tests (jsdom is already the vitest environment) for `AdminTabs` keyboard behaviour and ARIA, `AdminModal` Escape, focus return and scroll lock, `SearchInput` debounce and clear, `AdminTable` right alignment and `rowHref` anchors.
- A stylelint-free guard: a vitest test that greps `src/components/**` for `className="[^"]*\b(text-|bg-|border-|p-\d|mt-\d)` inside files under the admin tree and fails on new Tailwind usage, with an allowlist that shrinks to zero over the slices.
- Visual check on the dev server at 1280 and 768 for the PUG dashboard and System Health.

## 7. Risks

- **Scope creep into P5.** The Players tab table is in scope; rebuilding Matches and Leaderboard on Prisma is not. Hold the line.
- **Contrast bump changes every muted label at once.** It is the intended outcome, but ship slice 1 alone so any complaint is easy to attribute and revert.
- **`SectionThemeApplicator` has never actually run outside the dashboard.** Turning it on may reveal colouring nobody wants. Evaluate in dev before committing to keeping it.
- **`ConfirmDialog` rebuild touches 21 call sites indirectly.** Keep the hook API identical; test the three variants.

## 8. Open questions

None blocking. The one judgement call left to implementation is whether section theming stays (5.4).
