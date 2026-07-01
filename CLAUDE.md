# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing site for **사이間 영성심리 연구소** (Sai-Gan Spiritual Psychology Research Institute), the counseling practice of 김윤희 Ph.D. Content is in Korean. There is **no build step, no framework, and no dependencies** — everything is hand-authored HTML/CSS/JS.

## Files

- `index.html` (~2000 lines) — the entire site. Inline `<style>` block (lines ~117–1425) and inline `<script>` (lines ~1973–2051). All content, CSS, and JS live here.
- `404.html` — branded not-found page, self-contained.
- `README.md` — Korean-language description of page sections, design tokens, and contact info.

## Develop / preview

```sh
open index.html                 # open directly in a browser
python3 -m http.server 8000     # or serve statically, then visit localhost:8000
```

There is nothing to build, lint, or test. Changes to `index.html` are the deliverable.

## Deploy

Auto-deployed to **GitHub Pages** from the root of `main`. Push to `main` and it goes live in 1–2 minutes at the canonical URL in the `<link rel="canonical">` tag. No CI/CD workflow — the git push _is_ the deploy, so treat `main` pushes as publishing.

## Architecture & conventions

Because it's one file, the "architecture" is a set of consistent patterns to preserve when editing:

- **Design tokens** live in `:root` (line ~118) as CSS custom properties — the moss/terra/paper palette (`--moss`, `--moss-deep`, `--terra`, `--paper`, `--bg`, etc.). Style with these variables, never hardcoded hex. Comments in `:root` record _why_ a value was chosen (e.g. `--muted` was darkened to pass WCAG AA).
- **Typography** — three families: Noto Serif KR (`.serif`), Cormorant Garamond (`.latin`, italic accents), Noto Sans KR (body default). Google Fonts request is trimmed to only the weights actually used; if you use a new weight, update the fonts `<link>`.
- **Page sections** are `<section id="…">` inside `<main>`: `about`, `services`, `location`, `contact`. Nav links, the active-link scroll logic, and smooth-scroll all key off these IDs — **if you add/rename/remove a section, update the `sections` array in the JS (line ~2030) and the nav links together.**
- **JS is vanilla, no libraries.** It handles: nav scrolled-state, smooth-scroll offset by real nav height, procedural tree silhouettes, `.reveal` scroll-in via IntersectionObserver, and active-nav-link driven by scroll position (deliberately _not_ IntersectionObserver — see the comment explaining why).
- **Responsive** — two breakpoints only: `@media (max-width: 980px)` and `@media (max-width: 640px)`.

## Accessibility is a first-class concern

Recent work centers on accessibility — the git history shows repeated fixes for WCAG AA contrast, zoom/large-text users (titles use `clamp()`/fluid sizing so they don't overflow when zoomed), semantic landmarks (`<main>`, `aria-label` on nav), and hiding decorative elements from screen readers (`aria-hidden`, `<span aria-hidden>` for dots). When editing, keep contrast AA-compliant against the token palette, keep decorative SVG/glyphs hidden from assistive tech, and verify titles still fit at browser zoom.
