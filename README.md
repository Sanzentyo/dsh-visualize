# dsh-visualize

Interactive HTML visualizations rendered **inline in the DSH conversation** — on desktop and on the phone layout.

A tool call writes an HTML fragment to a file; the browser half renders that file in a sandboxed iframe
at the call's own position in the transcript. Charts, simulations, state machines, interface mockups,
maps and timelines become things the user can actually poke at, instead of screenshots.

```
┌──────────────────────────────────────────────┐
│ ▾ cache-hit-rate                    open     │
├──────────────────────────────────────────────┤
│  ( sandboxed iframe, scripts allowed,        │
│    no same-origin, theme tokens injected )   │
└──────────────────────────────────────────────┘
```

## Install

```powershell
dsh plugin --profile <name> add https://github.com/Sanzentyo/dsh-visualize
```

Then reload the browser tab. The plugin ships one bundle (`cordis.patch.yml`), so the tool and its
renderer arrive together.

To remove it:

```powershell
dsh plugin --profile <name> remove dsh-visualize
```

## What it adds

| Half | Registers | Effect |
|---|---|---|
| host | tool `visualize` | validates the fragment, writes it to a file, answers with the path |
| client | `tool.call.toolview` keyed `visualize` | renders that file in an iframe where the call sits |

The HTML **never** travels through the tool result. A visualization is tens of kilobytes, and a tool
result is replayed in every later request, so the tool returns `{ path, title, mode, bytes }` and the
client reads the bytes from `/api/file?path=…`.

## Settings menu

The hamburger lives **outside the sandboxed frame**, in the card, because a sandboxed iframe
cannot produce a trusted activation and the iOS switch that makes Safari vibrate never fires there.
Hovering the card reveals it on desktop; a 500ms hold reveals it on touch. The sections are plain
headers (no accordions) and the panel is 400px wide:

| Section | Contents |
|---|---|
| 表示 | chart / table |
| コピー / ダウンロード | format dropdown, COPY⇄DL switch, run |
| 拡大率 | 50–200%, repaints every chart |
| 文字 | target (title / axis / tick / all), font, size |
| 表示先 | move to the right Sidebar |
| 幅 | content width 40–100% |
| 位置 | menu corner (four options) |
| グラフ | only with charts: target chart, legend, series colour |
| 色 | 対象なし by default — picking a target reveals its colour input |
| リセット | back to defaults |
| スクロール | none / x / y / both |

Colour and text are **per element**, not one blanket switch. The targets are title / axis / tick /
legend / body / dim / surface / accent / border; the blanket text entry is gone because per-element
targets cover it. The menu chrome uses its own `--vzm-*` tokens, so a reader’s content overrides can
never make the menu unreadable.

### Per-element tokens

`viz.chart` reads these from `documentElement`, so an override must go on the root — setting them on
`.vz-content` is invisible to the chart (measured).

| Element | Colour | Size | Font |
|---|---|---|---|
| title | `--vz-title` | `--vz-font-title` | `--vz-font-title-family` |
| axis label | `--vz-axis` | `--vz-font-label` | `--vz-font-label-family` |
| tick | `--vz-tick` | `--vz-font-tick` | `--vz-font-tick-family` |

### Saved settings

Zoom, chart/table, colours, fonts, scroll, width and menu position are reported through
`viz.state({…})` to `/api/visualize/state` and restored on the next render.

## Editing by hand

Anything carrying `data-editable` opens an editor on a mouse double-click or a **double-tap**
(two taps within 300ms; `dblclick` never fires on touch — measured). Entry selects the whole value,
scrolls the element to the centre of the visual viewport and re-centres once after the software
keyboard resizes it. Enter commits, Escape reverts, blur commits, an empty edit restores the original.
Chart titles, axis labels and legend labels carry it already.

## Defaults across Sessions — `visualize_defaults`

`visualize_defaults` reads and writes `<home>/visualize/_defaults.json`, so a default can be changed
once and every later call inherits it. Known keys: `mode`, `card`, `scroll`, `width`, `zoom`,
`fontFamily`, `fontSize`, `fontRole`, `colors`; unknown keys are ignored so a typo never lands in the
defaults.

```
visualize_defaults(action: "get")
visualize_defaults(action: "set", values: { mode: "wide", card: true, zoom: 110 })
visualize_defaults(action: "reset")
```

## Right Sidebar

表示先 → 右側へ移す opens the fragment as a tab in the right column and folds the fence. Its address
is `dsh-resource://visualize/<sessionId>/<title>`.

- `ctx.sidebarRight.openResource` accepts **only** `dsh-resource://`; any other scheme throws (measured).
- `ctx.sidebarRight` and `ctx.layout` are bound through `ctx.inject`, not top-level `inject`: a profile
  without the right Sidebar still boots the plugin that way (measured).
- The tab toolbar offers 編集 / 領域を畳む / 閉じる. 編集 swaps in a source textarea that saves over
  `/api/visualize/file` (GET/PUT, store paths only; Ctrl/Cmd+S works too). 領域を畳む collapses the
  whole column (675px → 0 in the live run). Closing the tab dispatches `dshVizSidebarClosed` and the
  fence returns to the body.
## Tool

```
visualize(
  title: "cache-hit-rate",          # lowercase ASCII slug; becomes the file name
  html:  "<div id=\"viz\">…</div>", # fragment only
  mode:  "regular" | "wide",        # default regular
  path:  ".dsh-visualize/cache-hit-rate.html"   # optional
)
```

Rejected with a clear error:

- a title that is not `^[a-z0-9][a-z0-9-]{0,63}$`
- an empty fragment
- a fragment over 1 MB
- a fragment containing `<!doctype>`, `<html>`, `<head>` or `<body>`
- a `mode` outside `regular` / `wide`

## Sandbox

```
<iframe sandbox="allow-scripts" srcdoc="…">
```

`allow-scripts` without `allow-same-origin` gives the fragment a unique opaque origin: it can run
JavaScript, but it cannot read the host document, its cookies, its storage, or make credentialed
requests. This is the same posture DSH's own HTML document preview uses.

## Theme

The Harness defines its palette as `--dsw-alias-*` custom properties on `:root` and flips
`data-ds-dark-theme` on `<body>` to switch between light and dark. The renderer copies those values
into the frame and exposes short aliases, so a fragment never has to know which alias means "body
text". Use `var(...)`, never a literal colour.

| Purpose | Alias | Host token |
|---|---|---|
| body text | `--vz-text` | `--dsw-alias-label-primary` |
| secondary text | `--vz-dim` | `--dsw-alias-label-primary-dimmed` |
| panel | `--vz-surface` | `--dsw-alias-bg-layer-1` |
| border | `--vz-border` | `--dsw-alias-border-l1` |
| emphasis / link | `--vz-accent` | `--dsw-alias-brand-primary` |
| body size | `--vz-font-size` | `--dsh-content-font-size` |
| body font | `--vz-font` | `--dsh-font-family-text` |
| code | `--vz-font-code` / `--vz-code-bg` | `--dsh-font-family-code` / `--dsw-alias-markdown-code-block` |

The Harness has no chart palette, so the plugin owns `--viz-series-1` … `--viz-series-6` and keeps
two sets — one tuned for a white surface, one for a near-black one — switching them with the theme.
The hue order is fixed, so a series keeps its identity across a switch.

State colours come straight from the Harness: `--dsw-alias-state-error-primary`,
`--dsw-alias-state-success-primary`, `--dsw-alias-state-warn-primary`, and
`--dsw-alias-interactive-bg-hover-accent` for hover surfaces.

A `MutationObserver` on `<html>` and `<body>` plus a `prefers-color-scheme` listener re-render the
frame when the theme changes.

## Height

The frame reports its own content height over `postMessage` and the card follows it, so a
visualization never leaves a fixed-height gap. Fragments should not set a height.

## Mobile

The renderer registers into `conversation.chat.node`'s `tool.call.toolview` seat, which the core chat
flow renders on every layout — the phone shell included. `regular` caps at 780px and `wide` at 100%,
so both fit a phone without a separate code path.

## Skill

`skills/visualize/SKILL.md` teaches the model when a visualization is worth making, the fragment
contract, the theme tokens, and the size rules. Copy it into your skills directory, or point DSH at
this repository's `skills/` folder.

## Layout

```
package.json          bundle manifest (dsh.bundle.patch + dsh.client)
cordis.patch.yml      registers the bundle
index.js              host half: the visualize tool
client.js             browser half: the tool.call.toolview renderer
lib/validate.js       pure validation and path rules (no DSH imports)
tests/                node:test over lib/validate.js
skills/visualize/     the companion skill
```

## Test

```powershell
npm test
```

Covers the validation surface only — the renderer needs a browser.

## Requirements

- A DSH build whose client exposes the `tool.call.toolview` seat and the `api/file` route.
- `@deepseek-ai/dsh-tools` and `@deepseek-ai/cordis` are peer dependencies supplied by the Harness;
  they are declared optional so installing this bundle never pulls a second copy.

## License

MIT
