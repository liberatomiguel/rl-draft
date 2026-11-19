# Rocket Draft: design direction

Read this before any UI work. It is the direction; the anti-slop rulebook
(github.com/miqdadbadjuber/anti-slop) is only the filter applied on top of it.
Decision record: `docs/DESIGN-DECISIONS.md` #173 to #177.

## Design read

A game hub, a draft flow and a career mode for RLCS fans. Premium with a few
loud moments: an esports desk that raises its voice for the title of a
section and for the two modes, and is quiet everywhere else.
Dial: ENERGY 2, with two ENERGY 3 moments per screen at most / RHYTHM 2 / MOTION 2.

**The card is the reference object.** The draft cards are the best-looking
thing in the game, so the interface is cut from the same stock: their
night-blue body, their hairline frame, their corner, their diagonal texture.
A screen is right when a card sitting on it looks like it belongs there.

The test for every screen: put a card next to the panel. Same material? Then
cover the logo. Does it still read as this game?

## Personality

Calm, exact, confident. It lets the cards, the rank art and the cosmetics be
the loud things. Never "tech product", never a poster.

## Colour

| Token | Value | Role |
|---|---|---|
| `--bg` | `#070a11` | The floor: the cards' night blue, one step under a card's body. |
| `--bg-raised` | `#0a0e17` | Bars that sit on the floor (header, sticky bars). |
| `--surface` / `--surface-strong` | `#0d1322` / `#121a2c` | The two tones of a common card's body. |
| `--line` / `--line-strong` | grey-blue at 13% / 26% | Hairlines, in the grey of a common card's frame. |
| `--ink` / `--sub` / `--faint` | `#e9eef8` / `#8d9ab3` / `#7c8aa3` | Text, three steps. |
| `--orange` | `#ff6a1a` | The one action on a screen, the section tick, half the wordmark. |
| `--blue-bright` | `#7aa5ff` | Information and links. |
| `--good` / `--bad` | `#34d399` / `#f87171` | Win and loss, gain and cost. Function only. |

Rules:
- Colour is rare in the chrome. A screen shows orange in its one action and
  in the chip after a section title. Frames, rank art, flags and cards carry
  the rest.
- **Solids** (`.solid`, `.solid-orange`, `.solid-blue`): a solid block in one
  side's colour is allowed for a thing the player enters, which today means
  the two modes on the Home (draft on orange, career on blue). It is finished
  like a card (14px corner, the card's sheen and diagonal texture, a slow
  tone shift) so it reads as printed stock, not as a flat fill. The action on
  a solid is its inverse (dark on orange, paper on blue). Never as a highlight.
- **Paper** (`--paper #f3efe6`, text `--paper-ink`): the white of a
  lower-third. Used for the section-title slab and for the one figure that
  matters on a screen (the season rating on the Home). Nowhere else.
- No tinted glass, no gradient as decoration, no glow in the chrome. Glow
  belongs to card rarity and rewards (trophies, titles, champion saves).
- Dark is the theme on purpose: the cards, rank art and banners were drawn for
  it. There is no light theme.
- Contrast: body text 4.5:1 or better on its own surface.

## Type

**Display face: Industry (Fort Foundry), Miguel's pick.** A commercial font.
The files in hand are the trial set (personal-use licence, 66 characters), so
nothing of it is in the repo: the fonts and their stylesheet sit in the
git-ignored `public/fonts-trial/`, and `layout.tsx` links that stylesheet in
development only. It ships only as a licensed webfont with the full character
set. Until then **staging and production show Barlow Condensed**, the stand-in,
which is also the fallback for every character the trial lacks.

| Role | Face | Weight |
|---|---|---|
| Titles, buttons, key figures | Industry (stand-in: Barlow Condensed) | Bold (700 to 800), upright, caps |
| Labels, tags, nav | same | Demi (600), upright, caps |
| Quiet labels | same | Medium (500) |
| Home wordmark only | same | Black italic |
| Text | Barlow | 400, with 600 for emphasis |
| Mono | Geist Mono | Only for seeds and codes a player may copy |

### Weight

- The heaviest upright weight is Bold. Black and Ultra are not loaded, and
  synthetic bold is off, so nothing can go heavier by accident.
- Bold is for titles, buttons and the key figure of a block. A paragraph is
  never bold; a phrase inside one may be 600.
- **Italic is the Home wordmark's alone.** The header logo, titles, labels and
  numbers are upright.
- Caps are for titles, labels and buttons, with 0.02em to 0.06em tracking.
  Sentences are written as sentences.

## Material and shape

- **Board** (`.panel`): the common card's body gradient, opaque, inside a 1px
  hairline, corner 12px (a card's is 14px). No blur, no shadow.
- **State** is a coloured hairline: the selected option and the live series
  turn their border orange or blue. Never a bar on the top edge, never a halo.
- **Radius scale**: tag 3, button 7, board 12, card 14. No pills.
- **Texture**: the card's diagonal hairlines (`.card-texture`), only on a
  board that is itself a card.
- **The highlight** (`.title-slab`): a section title sits in dark Bold on a
  paper slab with a slanted end, followed by a slanted orange chip. It is the
  one slanted shape in the chrome and it belongs to section titles only (one
  per section, never on a card title, a button or a tab).
- **Button**: one filled button per screen, flat orange with dark text
  (inverted when it sits on a solid). All others are a hairline outline or
  plain text.
- **Tag**: flat tint, Medium caps, names a real state.

## Icons

- One set: `src/components/ui/icons.tsx`. Line icons, 1.8 stroke, `h-4 w-4`
  inline with text and `h-5 w-5` standing alone.
- An icon denotes the thing it sits beside (a trophy for titles, a lock for
  locked). If no icon denotes it, there is none. No sparkles, stars or bolts as
  ornament, no unicode glyphs standing in for icons, no emoji.
- Never an icon in a tinted rounded tile in front of every list item.

## Composition

- One focal point per screen. Whitespace does the separating; a box is drawn
  only around things that are one object.
- Sections on one page do not share a template: a pair of cards, a list, a
  strip of figures.
- Numbers are set as numbers: a large figure with a quiet label under it.
- A label above a title is used only when it says what the title does not;
  otherwise the line goes under the title as a sentence.

## Motion

- Motion belongs to events: a card is drafted, a series ends, a rank changes,
  a reward opens. Rarity effects on cards and cosmetics stay.
- The chrome does not loop, pulse or float.
- Everything non-essential stops under reduced motion (`reduce-fx`, `lite-fx`).

## Copy

- Say what happened or what the button does. No slogans in buttons.
- No em dash. Use a comma, a colon, a full stop or brackets.
- No status words for things that are not a status ("Live" is for a series
  being played).
- Arrows only on a link that leaves the page it is on.

## Never

- Frosted panels, ambient glows, glow on buttons or borders.
- A coloured bar on the top or left edge of a panel.
- A solid used as a highlight, or more than the two modes' worth of solids on
  one screen. Flat fills with no card finish.
- Slanted buttons, slanted tabs, stripe fills, a slab on anything but a
  section title.
- Black or Ultra weights; italic outside the Home wordmark; bold paragraphs.
- Blurred colour orbs behind a panel; a glow on a state (selected, live, win).
- A tiny wide-tracked caps label above a title that repeats the title.
- A grid of identical boxes as the default answer to "show several things".
- Inter, Geist, Space Grotesk as the text face.
