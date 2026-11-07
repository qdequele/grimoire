---
name: decor-artist
description: Draw, redraw or fix a drawn décor (background) of the ambiance screen in src/screen/Places.tsx — church, graveyard, crypt, castle, manor, library, police, forest, harbour, street, or a new place. Use for any change to a place's SVG layers, its lights, or when the keeper reports something wrong in a scene. Runs 5–10 render → critique → fix loops per image and the décor check before calling it done.
---

# Décor artist

The drawn décors are full-screen SVG layers (`far`, `mid`, `near`, light layers) on one 1600×900
frame, drifting sideways at different speeds (parallax, `screen.css`). The keeper looks at them on a
TV for hours: any mismatched join between two shapes (a *faux raccord*) shows. **One pass is never
enough.** Every mistake below was found by the keeper after a scene was called done.

## The loop (5–10 times per image, more if a loop still finds something)

1. **Render** both ends of the drift (where shapes at different depths are furthest apart), with the
   dev server running (`pnpm dev`):
   ```sh
   pnpm decor:shots <place> --clean                 # test-results/decors/<place>-night-a.png / -b.png
   pnpm decor:shots <place> --crop x,y,w,h --clean  # plus a 2× zoom of a region (frame px)
   pnpm decor:shots <place> --time night,dusk,day   # times of day (lights off by day, sun not moon)
   ```
2. **Look**, at the full frame and then at zooms of every join: where a light meets its fixture, where
   a roof meets a wall, a tree the ground, a spar its mast, a window its arch, a shaft its window. Open
   both drift ends side by side and compare the same join in each.
3. **Challenge it** against the checklist below, out loud, item by item. Write down every doubt; a
   "probably fine" is a finding.
4. **Fix**, then go back to 1. Stop only when a full loop finds nothing, and never before 5 loops on
   a new or redrawn place.
5. **Check**: `pnpm e2e:decors` (all places; the dev server or `pnpm dev` must answer on :5173).
6. **Show the before/after**: `pnpm decor:compare [places] [--ref <commit>]` renders the places on
   the ref (default `origin/main`, in a temporary checkout) and here, and writes
   `test-results/decors/compare/index.html`: a slider over each pair, per time of day and drift end.
   Open it in the browser (with `pnpm dev` running it is at
   `/test-results/decors/compare/index.html`) and show it to the keeper. "After" frames alone don't
   show what changed.

## Checklist (every one of these happened)

**Depth (parallax)**
- A light drifts with what it lights or hangs on. Its layer: `lit-far` / `lit` (mid) / `lit-near`, or
  flickering `pulse` (near) / `pulse-mid`. A lamp's glass in `lit` over a post in `near` slid off it.
- A light that spans two depths is split by what it falls on. One moonlight shaft from a window
  (far) to the floor (mid) slid past the window's jambs, so the window looked wider than its arch. Draw
  the glow on the panes in `lit-far`, the pool on the floor in `lit`.
- No shared upright edge or corner between shapes of different depths (a light's side running down
  a frame's jamb, a spill's corner on a sill's corner). Shared horizontal edges are fine: the drift is
  sideways.
- An object resting on another is at the same depth (a book on a desk, a candle on its stand, a
  lantern on its wall, a doorway with the corridor that ends at it).
- Something in front of a light is drawn after it: lights are layers of their own, so a veranda at
  the depth of the lit windows behind it goes in `mid-front` (drifts with mid, drawn after its lights),
  in shadow so it reads against the wall.

**Support**
- Nothing floats: walls go below the ground line, trees and stones are planted on the ridge
  (`ridgeAt`), chimneys, vents and finials start *inside* the roof or dome, a spar starts *on* its
  mast, a rope ends on what holds it.
- Nothing is only partly supported: a tower's foot past the edge of its headland, a ladder leaning
  past the end of the shelves, a hook ending inside a roof. (The automatic check doesn't see these:
  your eyes must.)
- Buildings by the water stand on a quay, never on the sea; a lamp stands on the ground, not in the
  water at the edge of the frame.
- Things in water sit at the waterline: piles stop there (below it only faint reflections), hulls
  float, nothing stands on stilts under a boat.
- No line runs off into bare sky with nothing to hold it: tall straight trunks rising out of the
  frame read as stray lines. Give them a crown, a canopy, or make them firs.

**Shapes**
- Matching widths: an arch as wide as its window, a cap as wide as its post, a roof overhanging both
  sides of its wall.
- Moonlit edges (`.scr-rim`) follow their shape exactly: a rim drawn a few units off (above a dome,
  past a spire's foot) floats. A ring is whole or held at both ends.
- Even rhythms: battlements balanced on both sides of a spire, columns paired about a door (one
  standing in the doorway was the even spacing's fault), stone courses broken at windows and recesses
  (a line through a dark pane reads as a glazing bar).
- No hairlines: two shapes that only share an edge show a light seam between them (anti-aliasing).
  Overlap them by a few units. `P` gives split pieces a thin outline in their own colour for this.
- At the frame's edges: something cut by the edge at one drift end (a cross sliding out, its arm and
  the crow on it left in the air) must be moved inward.
- One path holding several overlapping shapes fills their overlap only if they wind the same way
  (nonzero rule). `P` (in Places.tsx) draws each shape of a plain path as its own element, so use
  `<P>` for silhouettes, never a raw `<path>` with overlapping shapes and opacity or a gradient. Holes
  on purpose: `fillRule="evenodd"`.
- Hard-edged light in open air (shafts through mist) gets the `-soft` blur filter. Its edges are only
  hard where something physical stops it.

**Free on purpose**
- Bats, a will-o'-wisp, the moon and the sun float: mark them `data-free` (the check skips them).
  Anything else that floats is a bug.

**Look and feel** (CLAUDE.md, "Ambiance screen")
- Original drawings only: no recognisable buildings, no names from published games or fiction.
- Colours from the palette variables (`--sil-far`, `--sil-mid`, `--sil-near`, `--lit`, `--moon`,
  `--sun`). No raw colours, so a place goes with every preset and every time of day.
- Only transforms and opacity are animated. Filters and gradients are drawn once.
- Check `?time=day` and `?time=dusk` too: lights off by day (`.scr-glow`, the `lit*` layers dim), sun
  instead of moon, no moonlight shaft by day.

## The automatic check (`e2e/decors.spec.ts`)

It runs four rules on every place, measured on the SVG geometry: lights touch a shape that drifts
with them; no piece floats; no hard light edge lines up with a shape at another depth; no accidental
holes from winding. It catches the gross mistakes and the regressions. It does **not** judge partial
support, matching widths, readability or taste: those are the loop's job. When it flags something
that is truly meant (a new floating creature), mark it `data-free` and say why in a comment. Never
loosen a rule to make a scene pass.

## When you're done

Open the before/after page for the keeper, list what each loop found (place by place), and say what
you're still unsure about.
