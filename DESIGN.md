---

name: murmur
description: The switchboard where a visitor's question is patched to the page that answers it.
colors:
ivory: "#efe7d4"
ivory-deep: "#e4d9c0"
ivory-line: "#d3c5a6"
paper: "#fbf8f1"
bakelite: "#1c1814"
bakelite-2: "#2b251f"
bakelite-ink: "#efe7d4"
bakelite-muted: "#b3a68d"
brass: "#b0843a"
brass-hi: "#dcb469"
brass-ink: "#7a571d"
lamp: "#e9a63a"
cord: "#a3321f"
cord-dark: "#6e2013"
ink: "#1f1a15"
muted: "#5c5145"
typography:
display:
fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
fontSize: "clamp(2.6rem, 4.6vw, 4.4rem)"
fontWeight: 800
lineHeight: 0.95
letterSpacing: "-0.02em"
plate:
fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
fontSize: "clamp(2rem, 3.6vw, 3.2rem)"
fontWeight: 800
lineHeight: 1
letterSpacing: "-0.01em"
designation:
fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
fontSize: "13px"
fontWeight: 600
lineHeight: 1.4
letterSpacing: "0.12em"
body:
fontFamily: "Sofia Sans, ui-sans-serif, system-ui, sans-serif"
fontSize: "17px"
fontWeight: 400
lineHeight: 1.6
letterSpacing: "0em"
code:
fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
fontSize: "14px"
fontWeight: 400
lineHeight: 1.6
letterSpacing: "0em"
rounded:
strip: "4px"
plate: "6px"
control: "10px"
panel: "14px"
pill: "999px"
spacing:
u: "8px"
jack: "48px"
gutter: "clamp(16px, 4vw, 48px)"
section: "96px"
components:
plate:
backgroundColor: "{colors.bakelite}"
textColor: "{colors.bakelite-ink}"
typography: "{typography.plate}"
rounded: "{rounded.plate}"
padding: "16px 48px 18px"
strip:
backgroundColor: "{colors.bakelite}"
textColor: "{colors.bakelite-ink}"
typography: "{typography.designation}"
rounded: "{rounded.strip}"
padding: "6px 16px"
button-copy:
backgroundColor: "{colors.lamp}"
textColor: "{colors.bakelite}"
rounded: "{rounded.control}"
height: "40px"
padding: "0 16px"
button-primary:
backgroundColor: "{colors.bakelite}"
textColor: "{colors.bakelite-ink}"
rounded: "{rounded.control}"
height: "44px"
padding: "0 20px"
input:
backgroundColor: "{colors.paper}"
textColor: "{colors.ink}"
rounded: "{rounded.control}"
height: "44px"
padding: "8px 12px"
prompt-chip:
backgroundColor: "{colors.ivory}"
textColor: "{colors.ink}"
rounded: "{rounded.pill}"
padding: "6px 12px"
---

# Design System: murmur

## Overview

murmur's site is a manual telephone switchboard. A visitor's question is a call; murmur is the operator who patches it to the line that answers it, a page and heading of the site. The page is built on the board itself: an ivory enamel panel, black bakelite rails and plates, brass-ringed jacks, amber call lamps and red braided cords. Nothing is decoration for its own sake: lamps show real state, cords show real citations, the operator log prints what retrieval actually did.

The widget is a guest in other people's pages. It carries the world only in details (the call lamp, citation numbers in brass-style rings, engraved-label typography in the sources) and takes its accent, font and light or dark scheme from the host.

## Colors

### Primary

- **Bakelite** (`#1c1814`): rails, plates, designation strips, code panels, the widget's default accent. It is structure, never a background wash for long text.
- **Ivory** (`#efe7d4`): the panel ground of every page. `ivory-deep` (`#e4d9c0`) for the recessed console and quiet surfaces, `ivory-line` (`#d3c5a6`) for hairlines.

### Secondary

- **Lamp amber** (`#e9a63a`): a lit call lamp, the copy action, the operator log's timestamps. Amber means live: something is on, or something can be taken now.
- **Brass** (`#b0843a`, highlight `#dcb469`): jack rings and plate screws. As text on ivory, `brass-ink` (`#7a571d`) only.

### Tertiary

- **Cord red** (`#a3321f`, sheath `#6e2013`): patch cords, the circuit line, focus rings on the site. Red is a connection, never an error tone on the site.

### Neutral

- **Ink** (`#1f1a15`) for text on ivory; **muted** (`#5c5145`) for secondary text (6.9:1 on ivory). On bakelite, `bakelite-ink` and `bakelite-muted`.
- **Paper** (`#fbf8f1`): the chat panel and form fields, a shade lighter than the panel so they read as inserted.

### Named Rules

- **The Live Lamp Rule.** Amber marks a live state or the one action to take. A lamp that is lit for decoration lies.
- **The Ghost Jack Rule.** Absence is drawn: unused jacks stay as ghost sockets, an unlit lamp says "nothing found here". Never hide the empty state.

## Typography

Sofia Sans Condensed is the engraved voice (headlines, plates, designation strips, buttons); Sofia Sans is the reading voice. Both are self-hosted variable fonts (`site/fonts/`, OFL). Code and data in `ui-monospace`, only where the content is code.

### Hierarchy

- **Display** (800, clamp 2.6–4.4rem, 0.95): the one h1 per page.
- **Plate** (800, clamp 2–3.2rem, 1.0): section headings, engraved on a bakelite plate.
- **Designation** (600, 13px, 0.12em, uppercase): strips that label a panel region; never placed above a heading.
- **Body** (400, 17px, 1.6): prose and controls, measure kept under 72ch.

### Named Rules

- **The Engraving Rule.** Uppercase tracking belongs to designation strips and form legends only. Headings stay in sentence case.

## Layout

One module: `u = 8px`; the jack pitch is `6u`. Spacing is multiples of `u`. The home page's first viewport is the board: console 5fr (headline, live widget, prompts) and jack field 7fr (one row per page, one jack per section, operator log at the foot). Below, each section is a line on the board separated by an ivory hairline, with 12u above and 10u below, content held to 1240px. Below 960px, every two-column composition stacks; below 640px, ghost jacks and secondary nav links hide.

## Elevation & Depth

Flat by default. Two lifts only: plates and the widget panel cast a soft, offset shadow (`0 18px 40px -18px`), as objects mounted on the panel. Cords sit above the jack field. No borders under shadows.

## Shapes

Strips 4px, plates 6px, controls 10px, panels 14px, chips and the launcher fully round. Jacks and lamps are circles.

## Components

### Buttons

- **Copy** (lamp amber on bakelite text, condensed uppercase): the take-it-now action.
- **Primary** (bakelite, ivory text): form submit, "Index it".
- **Quiet** (ivory-deep with a hairline): secondary actions.

### Chips

- **Prompt chips** (ivory, hairline, round): suggested questions under the console; brass hairline on hover.

### Cards / Containers

- **Mode panels**: one bakelite, two ivory-deep, side by side, for the three ways to answer without a key in the page (proxy, in-browser model, visitor's key). The lit lamp marks the ones that need nothing from the visitor. Not a card grid of equal features: each carries its own attribute and link.

### Inputs / Fields

- Paper ground, inset hairline, 2px cord-red inset ring on focus. Labels in condensed uppercase.

### Navigation

- **Top rail**: sticky bakelite bar, wordmark with a lit lamp, condensed links; the language switch is outlined.

### Jack field (signature)

- One `.row` per page: a designation strip, then a grid of sockets (lamp, brass jack, a short engraved name: the heading up to its first pause, at most three words), padded with ghost jacks to the row's 12. On `murmur:state`: retrieved passages blink, cited ones light and get a cord drawn from the console (cubic curve with sag, drawn in 700ms with `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 140ms, the plug fading in as it arrives; instant under reduced motion). Cords alternate red and black and end in a plug drawn over the jack.
- Layers: jacks and their names, then the cords, then the strips and the operator log. Cords are never cut: names keep a soft ivory halo so they read where a cord crosses them.

### Widget (`<murmur-chat>`)

- Launcher pill with a lamp; panel 400×640 max, full screen under 480px; bakelite header; visitor messages in accent bubbles, answers as plain prose with ringed citation numbers and a numbered sources list; settings view drawn from llm-connect's store. Restyled only through `--murmur-accent`, `--murmur-accent-ink`, `--murmur-font`, `--murmur-radius`, `--murmur-lamp`, `--murmur-z`.
- **In-browser model**: offered first in the settings as a raised block (primary button, size and WebGPU note under it), then "or connect a provider with your key"; hidden when the mode leaves no choice. The download is discreet: a raised load bar between the conversation and the question field (label with percent and bytes in the visitor's language, 1,1 Go / 1.1 GB, then "preparing", and a lamp-amber progress bar) while the bubble's lamp blinks; it disappears once the model is ready. Only `preload: consent` shows a raised consent card naming the model and its size. Without WebGPU, a card says why and offers the key when the mode allows one; nothing is downloaded.
- **Citations**: numbered 1, 2, 3 in the order the answer first cites them, in the text and in the sources list alike.
- **Answer rendering**: paragraphs, lists (kept whole across blank lines, numbering resumed), fenced code (inside its list item when indented), tables in a scrollable hairline frame, quotes with a 1px rule, hard breaks. Code and tables that scroll are focusable.

## Do's and Don'ts

### Do:

- Do let every lamp and cord reflect a real event from the widget.
- Do engrave section headings on plates and label panel regions with strips.
- Do keep the widget's world to details so it fits any host.

### Don't:

- Don't put a designation strip, kicker or eyebrow above a heading.
- Don't use amber or cord red as decoration or as an error colour.
- Don't add glows, gradients or textures beyond the brass of jacks and screws.
- Don't load fonts inside the widget; it inherits the host's.
