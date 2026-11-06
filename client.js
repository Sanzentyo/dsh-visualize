/**
 * dsh-visualize — browser half.
 *
 * Registers a `tool.call.toolview` entry for the `visualize` tool. The Tool
 * layer renders a registered view in place of the generic result row, so the
 * visualization appears exactly where the call sits in the conversation —
 * on desktop and on the phone layout alike, because both render the same
 * `conversation.chat.node` seat.
 *
 * The fragment runs in an iframe with `sandbox="allow-scripts"` and no
 * `allow-same-origin`, so it cannot reach the host document, its cookies, or
 * its storage. Theme colours are copied into the frame as CSS custom
 * properties so a visualization follows the light/dark switch without knowing
 * about it.
 */
window.__ModuleLoader__.load({
  id: 'dsh-visualize',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Theme tokens copied into every frame, in the order the host defines them. */
    const THEME_TOKENS = [
      '--background', '--foreground', '--card', '--card-foreground',
      '--popover', '--popover-foreground', '--primary', '--primary-foreground',
      '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
      '--accent', '--accent-foreground', '--destructive', '--border',
      '--input', '--ring', '--blue', '--orange', '--green', '--red',
      '--purple', '--yellow', '--font-size-base',
      '--viz-series-1', '--viz-series-2', '--viz-series-3',
      '--viz-series-4', '--viz-series-5', '--viz-series-6',
    ]

    /** Base rules a fragment may rely on, matching the host's own type scale. */
    const BASE_CSS = `
:root { color-scheme: light dark; }
html, body { margin: 0; }
body {
  background: var(--background, #fff);
  color: var(--foreground, #111);
  font-family: system-ui, -apple-system, "Segoe UI", "Yu Gothic UI", sans-serif;
  font-size: var(--font-size-base, 14px);
  line-height: 1.5;
  padding: 12px;
  box-sizing: border-box;
}
*, *::before, *::after { box-sizing: inherit; }
h1, h2, h3 { margin: 0 0 .5em; font-weight: 500; }
h1 { font-size: 1.15em; }
h2, h3 { font-size: 1em; }
p { margin: 0 0 .75em; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 2px 8px; border-bottom: 1px solid var(--border, #e3e3e3); text-align: right; }
th:first-child, td:first-child { text-align: left; }
.muted { color: var(--muted-foreground, #666); }
.card {
  background: var(--card, transparent);
  border: 1px solid var(--border, #e3e3e3);
  border-radius: 8px;
  padding: 12px;
}
`

    /**
     * Read the host's live theme values.
     * @returns a `:root { … }` block, or an empty string outside a document.
     */
    function themeCss() {
      if (typeof document === 'undefined') return ''
      const style = getComputedStyle(document.documentElement)
      const pairs = []
      for (const token of THEME_TOKENS) {
        const value = style.getPropertyValue(token).trim()
        if (value !== '') pairs.push(`${token}: ${value}`)
      }
      return pairs.length === 0 ? '' : `:root { ${pairs.join('; ')} }`
    }

    /** Watches the document element's class/style so a theme switch re-renders. */
    function useThemeRevision() {
      const [revision, setRevision] = React.useState(0)
      React.useEffect(() => {
        if (typeof MutationObserver === 'undefined') return undefined
        const observer = new MutationObserver(() => setRevision(value => value + 1))
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme'],
        })
        return () => observer.disconnect()
      }, [])
      return revision
    }

    /**
     * Pull the tool's JSON answer out of a settled result.
     * @param block - the settled Tool result node.
     * @returns the parsed payload, or undefined when the result is not ours.
     */
    function payloadOf(block) {
      if (block === undefined || block === null) return undefined
      if (block.isError === true) return undefined
      const content = Array.isArray(block.content) ? block.content : []
      for (const part of content) {
        if (part === null || typeof part !== 'object' || part.type !== 'text') continue
        try {
          const value = JSON.parse(part.text)
          if (value !== null && typeof value === 'object' && typeof value.path === 'string') return value
        } catch {
          // Not our JSON; keep looking.
        }
      }
      return undefined
    }

    /** Build the `api/file` URL for an absolute path, honouring any base path. */
    function fileUrl(path) {
      const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI
      const url = new URL('api/file', base)
      url.searchParams.set('path', path)
      return url.toString()
    }

    /**
     * One visualization: a frame plus its title row.
     * @param props - the Tool view props supplied by the Tool layer.
     */
    function VisualizeView(props) {
      const { block, phase } = props
      const payload = React.useMemo(() => payloadOf(block), [block])
      const revision = useThemeRevision()
      const [html, setHtml] = React.useState(undefined)
      const [failure, setFailure] = React.useState(undefined)
      const [open, setOpen] = React.useState(true)

      React.useEffect(() => {
        if (payload === undefined) return undefined
        let live = true
        setFailure(undefined)
        setHtml(undefined)
        fetch(fileUrl(payload.path))
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.text()
          })
          .then(text => { if (live) setHtml(text) })
          .catch(error => { if (live) setFailure(String(error && error.message ? error.message : error)) })
        return () => { live = false }
      }, [payload === undefined ? '' : payload.path])

      if (phase !== 'result' || payload === undefined) {
        // Preparing / running, or a result we do not own: stay out of the way.
        return null
      }

      const wide = payload.mode === 'wide'
      const height = wide ? 520 : 420
      const source = html === undefined
        ? undefined
        : `<!doctype html><html><head><meta charset="utf-8">`
          + `<meta name="viewport" content="width=device-width, initial-scale=1">`
          + `<style>${themeCss()}</style><style>${BASE_CSS}</style></head><body>${html}</body></html>`

      const header = h('div', {
        key: 'head',
        style: {
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 10px', borderBottom: '1px solid var(--border, #e3e3e3)',
          fontSize: '12px', color: 'var(--muted-foreground, #666)',
        },
      }, [
        h('button', {
          key: 'toggle',
          type: 'button',
          onClick: () => setOpen(value => !value),
          style: {
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'inherit', font: 'inherit',
          },
        }, open ? '▾' : '▸'),
        h('span', { key: 'title', style: { flex: '1 1 auto' } }, payload.title),
        h('a', {
          key: 'open',
          href: fileUrl(payload.path),
          target: '_blank',
          rel: 'noreferrer noopener',
          style: { color: 'inherit' },
        }, 'open'),
      ])

      let body
      if (failure !== undefined) {
        body = h('div', {
          key: 'failure',
          style: { padding: '10px', fontSize: '12px', color: 'var(--destructive, #b3261e)' },
        }, `visualization unavailable: ${failure}`)
      } else if (source === undefined) {
        body = h('div', {
          key: 'loading',
          style: { padding: '10px', fontSize: '12px', color: 'var(--muted-foreground, #666)' },
        }, 'loading…')
      } else {
        body = h('iframe', {
          key: `frame-${revision}`,
          title: payload.title,
          srcDoc: source,
          sandbox: 'allow-scripts',
          style: { width: '100%', height: `${height}px`, border: '0', display: 'block', background: 'transparent' },
        })
      }

      return h('div', {
        'data-dsh-visualize': payload.title,
        style: {
          margin: '8px 0',
          border: '1px solid var(--border, #e3e3e3)',
          borderRadius: '10px',
          overflow: 'hidden',
          maxWidth: wide ? '100%' : '760px',
          background: 'var(--card, transparent)',
        },
      }, [header, open ? body : null])
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'visualize',
        }, VisualizeView))
      },
    }
  },
})
