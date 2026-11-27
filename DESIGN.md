# Rocket Draft: design direction

Read this before any UI work. It is the direction; the anti-slop rulebook
(github.com/miqdadbadjuber/anti-slop) is only the filter applied on top of it.
Decision record: `docs/DESIGN-DECISIONS.md` #173 to #177 (the redesign's first four were #164 to #167 before the merge with main v2.0.33); the rc.9 type and spacing system is #209 to #219.

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

**Display face: Industry (Fort Foundry)**, licensed, files in `src/app/fonts/`
(Medium, Demi, Bold, Bold Italic; Barlow Condensed is the fallback for glyphs
it lacks). **Chakra Petch** (OFL) is loaded on demand as the candidate face:
on staging and dev, Settings has a "Display typeface" switch, or `?type=chakra`
/ `?type=industry` (#213). Text face: Barlow. Mono: Geist Mono, only for seeds
and codes a player may copy.

The ladder is a set of variables in `globals.css` (`--w-*`, `--tr-*`,
`--text-*`, `--sp-*`), tuned per face under `html[data-type]`. The role rules
apply it to the weight utilities the screens already carry (#209 to #212), so
write the role, not the number.

| Role | Weight | Case and tracking | Size |
|---|---|---|---|
| The one title of a screen (`h1`), the key figure of a block (display 24px+) | Bold 700 | caps title 0.03em, or a number | 24 to 40 |
| Section title (`.title-slab`), card title (`.card-title`, `h2`, `h3`) | Demi 600 | caps (slab 0.03em; card title 16px at 0.05em) | 16 to 24 |
| Buttons, names, small figures in a row (display `font-bold`) | Demi 600 | buttons caps, names mixed | 13 to 17 |
| Nav, tabs, tags, labels (`.kicker`, display `font-semibold`) | Medium 500 | caps 0.05em to 0.08em | 11 to 13 |
| Body text | Barlow 400 (600 for a phrase) | sentences | 15px / 1.55 desktop, 14 phone |
| Secondary text | Barlow 400 | sentences | 13px |

- Nothing renders at 800: Black is not loaded and synthetic bold is off. The
  Home wordmark is the one italic.
- Caps are for titles (screen, section and card titles: Miguel, 27/11), tabs,
  tags, buttons and labels. Option names, player and org names, dates and
  news headlines are mixed case.
  Never caps at 0 to 0.02em.
- Display line height 1.1 to 1.15; figures are tabular.
- Three text steps on purpose: `--ink` the value or the name, `--sub` what
  explains it, `--faint` the label. A block of all-ink bold lines is a defect.
- Short labels and headings carry no full stop. No blurb under a title that
  restates it.

### Spacing

Scale 4 / 8 / 12 / 16 / 24 / 32 / 48 (`--sp-*`). A board's padding is
`--panel-pad` (16 phone, 24 desktop; a board written `p-4`/`p-5` gets it).
Inside a block 12 to 16 (`--block-gap`, `.stack-block`); between sections 32
to 40 (`--section-gap`, `.stack-sections`); between boards in a column 24 to 32.

### Hierarchy recipes

- **Figure with label:** the number in display Bold, 24px+, `--ink` (or
  `--good`/`--bad` for a signed delta, which says against what); the label
  under it as a `.kicker` or 12px `--faint`. One per block is the figure; the
  others are 15px Demi.
- **Row:** a name in display Demi mixed case 15px, under it one `--faint` 12px
  line (role, age, state); values right-aligned and tabular; the row's action
  last and quiet. Rows sit under hairlines in one board; a column head is a
  `.kicker`.
- **Section header:** `SectionTitle` (the slab) once per screen section, with
  its one figure, tag or link on the right. Nothing above it.
- **Card title:** `.card-title` in a `.card-head`, Demi caps 16px; the right side
  holds one figure, tag or link, never a sentence.
- **Tag:** `Badge`, Medium caps 11px, names a real state; at most two on a row.
- **When a box is drawn:** around one object the player acts on (a squad, a
  contract list, a coach). A list is rows in one board, not a box per item;
  never a box inside a box; a quiet fact is a line, not a board.

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

## Phone (under 640px)

The phone is designed, not shrunk (decisions #178 to #182, R148). Desktop
rules above still hold; these are added.

- **The first screen is the screen's job and its one action.** A returning
  player acts without scrolling. The action sits in the thumb zone, docked
  over the bottom bar when the screen is long (`.action-dock`).
- **One bar on top, one on the bottom, about 110px together.** Never two
  navigations. A run hides the site nav; the career swaps it for its own tabs
  and keeps a way back to the menu in its top bar.
- **Rows, not boxes.** A list is one board of rows under hairlines
  (`.phone-rows`); a row of view buttons is a strip of underlined tabs
  (`.phone-tabs`). Three figures side by side become three rows (`.stat-trio`).
- **A summary screen shows figures, the tab shows the block.** HQ on a phone
  is the day, the inbox, a board of one figure per subject (two to a row) and
  the headline; each figure opens its tab. Blocks are not folded shut in the
  career: Miguel played folded sections and refused them (24/11).
- **A long list shows its start and a key for the rest** ("Show all 22"), or
  opens by group where the groups are the content (achievements).
- **Cards stay cards.** Challenges and the album are grids on a phone too
  (two and three to a row); only the card's detail moves to the sheet it opens.
- **The floor is global:** no label under 11px, no control under 44px
  (`globals.css`, "The phone floor"). Screens are designed on top of it.
- Checked at 375 x 812 and 320 x 640 before it ships; no page-level sideways
  scroll at either.

## Never

- Frosted panels, ambient glows, glow on buttons or borders.
- A coloured bar on the top or left edge of a panel.
- A solid used as a highlight, or more than the two modes' worth of solids on
  one screen. Flat fills with no card finish.
- Slanted buttons, slanted tabs, stripe fills, a slab on anything but a
  section title.
- Black or Ultra weights; italic outside the Home wordmark; bold paragraphs.
- Bold caps stacked on bold caps (a title, its tabs and its figures all in
  the same voice); caps names; caps tracked tighter than 0.03em.
- Blurred colour orbs behind a panel; a glow on a state (selected, live, win).
- A tiny wide-tracked caps label above a title that repeats the title.
- A grid of identical boxes as the default answer to "show several things".
- Inter, Geist, Space Grotesk as the text face.
