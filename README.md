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

The host copies its live CSS custom properties into the frame, so a visualization follows the
light/dark switch without knowing it exists. Use `var(...)`, never literal colours.

| Purpose | Tokens |
|---|---|
| surface / text | `--background` `--foreground` |
| panels | `--card` `--card-foreground` `--popover` `--muted` `--muted-foreground` |
| emphasis | `--primary` `--primary-foreground` `--accent` `--destructive` |
| lines | `--border` `--input` `--ring` |
| series | `--viz-series-1` … `--viz-series-6` |
| scale | `--font-size-base` |

A `MutationObserver` on `document.documentElement` re-renders the frame when the theme class changes.

## Mobile

The renderer registers into `conversation.chat.node`'s `tool.call.toolview` seat, which the core chat
flow renders on every layout — the phone shell included. `regular` caps at 760px and `wide` at 100%,
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
