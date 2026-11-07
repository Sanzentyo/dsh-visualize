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
 * its storage. Every colour it uses is a `--dsw-alias-*` value copied in from
 * the host, plus a series palette this plugin owns, so a visualization follows
 * the light/dark switch without knowing it exists.
 */
window.__ModuleLoader__.load({
  id: 'dsh-visualize',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * Host tokens copied into every frame.
     *
     * These are the Harness's own design aliases (`--dsw-alias-*`), not a
     * generic design-system vocabulary: the client defines them on `:root` and
     * flips `data-ds-dark-theme` on `<body>` to switch palettes.
     */
    const HOST_TOKENS = [
      '--dsw-alias-label-primary',
      '--dsw-alias-label-primary-dimmed',
      '--dsw-alias-label-primary-inverted',
      '--dsw-alias-label-primary-foreground',
      '--dsw-alias-bg-base',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-layer-3',
      '--dsw-alias-bg-overlay',
      '--dsw-alias-border-l1',
      '--dsw-alias-border-l2',
      '--dsw-alias-border-l3',
      '--dsw-alias-border-l4',
      '--dsw-alias-brand-primary',
      '--dsw-alias-brand-text',
      '--dsw-alias-link',
      '--dsw-alias-state-error-primary',
      '--dsw-alias-state-success-primary',
      '--dsw-alias-state-warn-primary',
      '--dsw-alias-markdown-code-block',
      '--dsw-alias-markdown-inline-code',
      '--dsw-alias-interactive-bg-hover-accent',
      '--dsh-content-font-size',
      '--dsh-content-font-size-secondary',
      '--dsh-font-family-text',
      '--dsh-font-family-code',
    ]

    /**
     * Series colours. The Harness has no chart palette, so the plugin owns one
     * and switches it with the theme: the light set is tuned for a white
     * surface, the dark set for a near-black one. Both keep the same hue order,
     * so a series keeps its identity across a theme switch.
     */
    const SERIES_LIGHT = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']
    const SERIES_DARK = ['#60a5fa', '#fbbf24', '#34d399', '#a78bfa', '#f87171', '#22d3ee']

    /** Fallbacks used only when a host token is missing (a bare document). */
    const FALLBACK = {
      light: {
        text: '#1a1a1a',
        dim: '#6b6b6b',
        surface: '#ffffff',
        border: '#e3e3e3',
        accent: '#3b82f6',
      },
      dark: {
        text: '#e8e8e8',
        dim: '#9a9a9a',
        surface: '#1c1c1f',
        border: '#313136',
        accent: '#60a5fa',
      },
    }

    /**
     * The frame's own stylesheet. Structure only: every colour resolves through
     * a custom property, so a fragment cannot pin itself to one theme.
     */
    const BASE_CSS = `
html, body { margin: 0; background: transparent; }
body {
  color: var(--vz-text);
  font-family: var(--vz-font, system-ui, sans-serif);
  font-size: var(--vz-font-size, 14px);
  line-height: 1.55;
  padding: 14px 16px 16px;
  -webkit-text-size-adjust: 100%;
  font-variant-numeric: tabular-nums;
}
h1, h2, h3 { margin: 0 0 .45em; font-weight: 500; letter-spacing: -.005em; }
h1 { font-size: 1.05em; }
h2, h3 { font-size: .95em; }
p { margin: 0 0 .7em; }
p:last-child, table:last-child, svg:last-child { margin-bottom: 0; }
a { color: var(--vz-accent); text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 3px 10px; border-bottom: 1px solid var(--vz-border); text-align: right; }
th { color: var(--vz-dim); font-weight: 500; }
th:first-child, td:first-child { text-align: left; }
tr:last-child td { border-bottom: 0; }
.muted { color: var(--vz-dim); }
.card {
  background: var(--vz-surface);
  border: 1px solid var(--vz-border);
  border-radius: 10px;
  padding: 12px 14px;
}
code, pre {
  font-family: var(--vz-font-code, ui-monospace, monospace);
  background: var(--vz-code-bg, transparent);
  border-radius: 4px;
}
svg { display: block; max-width: 100%; height: auto; }
`

    /** True when the Harness is showing its dark palette. */
    function hostIsDark() {
      if (typeof document === 'undefined') return false
      if (document.body !== null && document.body.hasAttribute('data-ds-dark-theme')) return true
      return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    }

    /**
     * Read the host's live theme values and build the frame's variable block.
     * @returns a `:root { … }` block, or '' outside a document.
     */
    function themeCss() {
      if (typeof document === 'undefined') return ''
      const style = getComputedStyle(document.documentElement)
      const bodyStyle = document.body === null ? style : getComputedStyle(document.body)
      const dark = hostIsDark()
      const fallback = dark ? FALLBACK.dark : FALLBACK.light

      const read = token => {
        const fromRoot = style.getPropertyValue(token).trim()
        return fromRoot !== '' ? fromRoot : bodyStyle.getPropertyValue(token).trim()
      }

      const pairs = []
      for (const token of HOST_TOKENS) {
        const value = read(token)
        if (value !== '') pairs.push(`${token}: ${value}`)
      }

      // Derived aliases the fragment and BASE_CSS both use, so a fragment never
      // has to know which `--dsw-alias-*` name means "body text".
      const text = read('--dsw-alias-label-primary') || fallback.text
      const dim = read('--dsw-alias-label-primary-dimmed') || fallback.dim
      const surface = read('--dsw-alias-bg-layer-1') || read('--dsw-alias-bg-base') || fallback.surface
      const border = read('--dsw-alias-border-l1') || fallback.border
      const accent = read('--dsw-alias-brand-primary') || read('--dsw-alias-link') || fallback.accent
      const fontSize = read('--dsh-content-font-size') || '14px'
      const fontFamily = read('--dsh-font-family-text')
      const fontCode = read('--dsh-font-family-code')
      const codeBg = read('--dsw-alias-markdown-code-block')

      pairs.push(`--vz-text: ${text}`)
      pairs.push(`--vz-dim: ${dim}`)
      pairs.push(`--vz-surface: ${surface}`)
      pairs.push(`--vz-border: ${border}`)
      pairs.push(`--vz-accent: ${accent}`)
      pairs.push(`--vz-font-size: ${fontSize}`)
      if (fontFamily !== '') pairs.push(`--vz-font: ${fontFamily}`)
      if (fontCode !== '') pairs.push(`--vz-font-code: ${fontCode}`)
      if (codeBg !== '') pairs.push(`--vz-code-bg: ${codeBg}`)

      const series = dark ? SERIES_DARK : SERIES_LIGHT
      series.forEach((colour, index) => pairs.push(`--viz-series-${index + 1}: ${colour}`))

      pairs.push(`color-scheme: ${dark ? 'dark' : 'light'}`)
      return `:root { ${pairs.join('; ')} }`
    }

    /** Watches the theme attribute and the palette so a switch re-renders. */
    function useThemeRevision() {
      const [revision, setRevision] = React.useState(0)
      React.useEffect(() => {
        if (typeof MutationObserver === 'undefined') return undefined
        const bump = () => setRevision(value => value + 1)
        const observer = new MutationObserver(bump)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
        if (document.body !== null) {
          observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class', 'style'] })
        }
        const media = typeof matchMedia === 'undefined' ? undefined : matchMedia('(prefers-color-scheme: dark)')
        if (media !== undefined && typeof media.addEventListener === 'function') media.addEventListener('change', bump)
        return () => {
          observer.disconnect()
          if (media !== undefined && typeof media.removeEventListener === 'function') media.removeEventListener('change', bump)
        }
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
     * Report the frame's content height to the host, so the card hugs its
     * content instead of leaving a fixed-height gap.
     * @param nonce - correlation value the host listens for.
     * @returns an inline script for the frame.
     */
    function heightReporter(nonce) {
      return `<script>(function(){
  var NONCE = ${JSON.stringify(nonce)};
  function report() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height > 0) parent.postMessage({ dshVisualize: NONCE, height: height }, '*');
  }
  report();
  if (typeof ResizeObserver === 'function') new ResizeObserver(report).observe(document.documentElement);
  addEventListener('load', report);
  addEventListener('resize', report);
  setTimeout(report, 120);
})()</script>`
    }

    /** A chevron that points down when open and right when closed. */
    function Chevron({ open }) {
      return h('svg', {
        width: 12,
        height: 12,
        viewBox: '0 0 12 12',
        'aria-hidden': 'true',
        style: {
          flex: '0 0 auto',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform .15s ease',
        },
      }, h('path', {
        d: 'M2.5 4.5 L6 8 L9.5 4.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    /**
     * One visualization: a disclosure header over a sandboxed frame.
     * @param props - the Tool view props supplied by the Tool layer.
     */
    function VisualizeView(props) {
      const { block, phase } = props
      const payload = React.useMemo(() => payloadOf(block), [block])
      const revision = useThemeRevision()
      const [html, setHtml] = React.useState(undefined)
      const [failure, setFailure] = React.useState(undefined)
      const [open, setOpen] = React.useState(true)
      const [hover, setHover] = React.useState(false)
      const [height, setHeight] = React.useState(undefined)
      const nonce = React.useMemo(() => Math.random().toString(36).slice(2), [])
      const frameRef = React.useRef(null)

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

      React.useEffect(() => {
        if (typeof window === 'undefined') return undefined
        const onMessage = event => {
          const data = event.data
          if (data === null || typeof data !== 'object' || data.dshVisualize !== nonce) return
          if (frameRef.current !== null && event.source !== frameRef.current.contentWindow) return
          if (typeof data.height === 'number' && data.height > 0) {
            setHeight(Math.min(1200, Math.ceil(data.height)))
          }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [nonce])

      if (phase !== 'result' || payload === undefined) {
        // Preparing / running, or a result we do not own: stay out of the way.
        return null
      }

      const wide = payload.mode === 'wide'
      const source = html === undefined
        ? undefined
        : `<!doctype html><html><head><meta charset="utf-8">`
          + `<meta name="viewport" content="width=device-width, initial-scale=1">`
          + `<style>${themeCss()}</style><style>${BASE_CSS}</style></head><body>`
          + html + heightReporter(nonce) + `</body></html>`

      // A full-width button, so the whole header is a hit target on a phone.
      const header = h('button', {
        key: 'head',
        type: 'button',
        'aria-expanded': open,
        onClick: () => setOpen(value => !value),
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '9px 12px',
          margin: 0,
          border: 0,
          cursor: 'pointer',
          background: hover ? 'var(--dsw-alias-interactive-bg-hover-accent)' : 'transparent',
          color: 'var(--dsw-alias-label-primary-dimmed)',
          font: 'inherit',
          fontSize: '12px',
          lineHeight: 1.4,
          textAlign: 'left',
          transition: 'background .12s ease',
        },
      }, [
        h(Chevron, { key: 'chev', open }),
        h('span', {
          key: 'title',
          style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, payload.title),
        h('a', {
          key: 'open',
          href: fileUrl(payload.path),
          target: '_blank',
          rel: 'noreferrer noopener',
          onClick: event => event.stopPropagation(),
          style: { flex: '0 0 auto', color: 'inherit', opacity: 0.8, textDecoration: 'none' },
        }, 'open'),
      ])

      let body
      if (failure !== undefined) {
        body = h('div', {
          key: 'failure',
          style: {
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--dsw-alias-state-error-primary)',
            borderTop: '1px solid var(--dsw-alias-border-l1)',
          },
        }, `visualization unavailable: ${failure}`)
      } else if (source === undefined) {
        body = h('div', {
          key: 'loading',
          style: {
            padding: '12px 14px',
            fontSize: '12px',
            color: 'var(--dsw-alias-label-primary-dimmed)',
            borderTop: '1px solid var(--dsw-alias-border-l1)',
          },
        }, 'loading…')
      } else {
        body = h('iframe', {
          key: `frame-${revision}`,
          ref: frameRef,
          title: payload.title,
          srcDoc: source,
          sandbox: 'allow-scripts',
          style: {
            width: '100%',
            height: `${height === undefined ? (wide ? 420 : 360) : height}px`,
            border: '0',
            display: 'block',
            background: 'transparent',
            borderTop: '1px solid var(--dsw-alias-border-l1)',
            transition: 'height .12s ease',
          },
        })
      }

      return h('div', {
        'data-dsh-visualize': payload.title,
        style: {
          margin: '10px 0',
          border: '1px solid var(--dsw-alias-border-l1)',
          borderRadius: '12px',
          overflow: 'hidden',
          maxWidth: wide ? '100%' : '780px',
          background: 'var(--dsw-alias-bg-layer-1)',
          color: 'var(--dsw-alias-label-primary)',
        },
      }, [header, open ? body : null])
    }

    /**
     * Relay a visualization's interaction state to the host.
     *
     * The frame cannot reach the host itself (opaque origin), so it posts to
     * this window. Only a message carrying the marker is forwarded, and the
     * host re-checks that the path belongs to its own store.
     */
    function relayState() {
      if (typeof window === 'undefined') return
      window.addEventListener('message', event => {
        const data = event.data
        if (data === null || typeof data !== 'object' || typeof data.dshVizState !== 'string') return
        if (data.dshVizState === '') return
        const url = new URL('api/visualize/state', document.baseURI)
        void fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: data.dshVizState, state: data.state ?? null }),
        }).catch(() => {})
      })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        relayState()
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'visualize',
        }, VisualizeView))
      },
    }
  },
})
