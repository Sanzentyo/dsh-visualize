/**
 * dsh-visualize — host half.
 *
 * Registers one tool, `visualize`. It writes an HTML fragment to a durable
 * file and answers with that file's path; the browser half renders the file in
 * a sandboxed iframe at the tool call's own position in the conversation.
 *
 * The HTML never travels through the tool result. A visualization is tens of
 * kilobytes and the result would sit in every later request, so the tool
 * returns a path and the client reads the bytes through `/api/file`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, sep } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertHtml, assertMode, assertTitle, DEFAULT_DIR, destination, MODES } from './lib/validate.js'

/** Stable Loader identity. */
export const name = 'dsh-visualize'

/** Services this plugin needs. */
export const inject = ['tools', 'connection']

/**
 * The directory one Session owns: the store root, then the Session id, so a
 * thread's visualizations and their assets stay together.
 * @param sessionId - the owning Session.
 * @returns an absolute path under the Harness home.
 */
function storeDir(sessionId) {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, DEFAULT_DIR, sessionId)
}

/**
 * Reject a name that already holds different content.
 *
 * A transcript keeps the absolute path, so reusing a name silently would
 * rewrite what an earlier message shows. Identical content is accepted, which
 * makes a re-run of the same call idempotent.
 * @param path - the destination file.
 * @param html - the new fragment.
 */
async function assertNotReplaced(path, html) {
  let existing
  try {
    existing = await readFile(path, 'utf8')
  } catch {
    return
  }
  if (existing !== html) {
    throw new Error(
      `visualize: "${basename(path)}" already exists with different content; `
      + 'pick another title, because an earlier message renders that file',
    )
  }
}

/**
 * Write one asset beside the visualization.
 * @param dir - the Session's asset directory.
 * @param asset - the declared name and base64 payload.
 * @returns the written path.
 */
async function writeAsset(dir, asset) {
  const name = String(asset.name ?? '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
    throw new Error(`visualize: asset name "${name}" must be a plain file name`)
  }
  const bytes = Buffer.from(String(asset.data ?? ''), 'base64')
  if (bytes.length === 0) throw new Error(`visualize: asset "${name}" is empty`)
  if (bytes.length > MAX_BYTES) throw new Error(`visualize: asset "${name}" exceeds ${MAX_BYTES} bytes`)
  await mkdir(dir, { recursive: true })
  const path = join(dir, name)
  await writeFile(path, bytes)
  return path
}

/**
 * Register the `visualize` tool.
 * @param ctx - context carrying the tool registry.
 */
export function apply(ctx) {
  // The frame has an opaque origin, so it posts its interaction state to the
  // parent page, which relays it here. One route keeps the browser half free of
  // a generated Remote.
  ctx.connection.fetch.register({
    path: '/api/visualize/state',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const root = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), DEFAULT_DIR)
      const statePathOf = (target) => {
        // Only a file this plugin owns may be read or written beside.
        if (!isAbsolute(target) || !target.startsWith(root + sep)) return undefined
        return join(dirname(target), 'state', `${basename(target, '.html')}.json`)
      }
      if (request.method === 'GET') {
        const target = new URL(request.url).searchParams.get('path') ?? ''
        const statePath = statePathOf(target)
        if (statePath === undefined) return new Response('unknown visualization', { status: 400 })
        try {
          return new Response(await readFile(statePath, 'utf8'), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        } catch {
          // Nothing reported yet: the frame starts from its own defaults.
          return new Response('null', { status: 200, headers: { 'content-type': 'application/json' } })
        }
      }
      const body = JSON.parse(new TextDecoder().decode(request.body ?? new Uint8Array()))
      const statePath = statePathOf(String(body.path ?? ''))
      if (statePath === undefined) return new Response('unknown visualization', { status: 400 })
      await mkdir(dirname(statePath), { recursive: true })
      await writeFile(statePath, JSON.stringify(body.state ?? null), 'utf8')
      return new Response('ok', { status: 200 })
    },
  })

  ctx.tools.register(defineTool({
    name: 'visualize_state',
    description: 'Read the interaction state a visualization reported. '
      + 'A visualization calls viz.state({...}) when the reader changes something, and this returns the last snapshot '
      + 'for one title in this Session. Use it when the reader says they picked, filtered, or selected something on a visual. '
      + 'Returns null when nothing was reported.',
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: 'The title the visualization was drawn with.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', required: true },
          state: { type: 'string', required: true, description: 'JSON text, or "null".' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.state }],
    },
    async execute(args, exec) {
      const title = assertTitle(args.title)
      const store = storeDir(String(exec.agent.session.id))
      const statePath = join(store, 'state', `${title}.json`)
      let state = 'null'
      try {
        state = await readFile(statePath, 'utf8')
      } catch {
        // Nothing reported yet.
      }
      return { title, state }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'visualize',
    description: 'Show an interactive HTML visualization inline in the conversation. '
      + 'Call it as the LAST tool call of the turn, immediately before your final message: '
      + 'the card only becomes readable once the response settles, so calling it mid-turn scrolls it out of view. '
      + 'Finish every lookup and calculation first. '
      + 'Use it when the user needs to see or explore something and a picture explains it better than prose: '
      + 'a chart, a simulation, a state machine, an interface mockup, a map, a timeline. '
      + 'Do not use it for a plain table (answer with Markdown), for a static labelled structure (answer with a Mermaid fence), '
      + 'or when the user asked for a standalone file, site, or project change. '
      + 'Write an HTML fragment only: no <!doctype>, <html>, <head> or <body>. '
      + 'Give the root element a unique id and select it with document.getElementById. '
      + 'Inline CSS and JavaScript; never call fetch, XMLHttpRequest or WebSocket. '
      + 'Colours must come from the CSS custom properties the host injects: --vz-text (body), --vz-dim (secondary), '
      + '--vz-surface (panel), --vz-border, --vz-accent, and --viz-series-1 through --viz-series-6 for series. '
      + 'Those switch with the light/dark theme, so never write a literal colour. '
      + 'The frame sizes itself to the content; do not set a fixed height. '
      + 'Keep it under 1 MB. Answer with one short sentence about what the visual shows; do not repeat its data.',
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: 'Lowercase ASCII slug used as the file name, e.g. "cache-hit-rate".',
      },
      html: {
        type: 'string',
        required: true,
        description: 'The HTML fragment. Literal markup, not a JSON-escaped string.',
      },
      mode: {
        type: 'string',
        enum: MODES,
        description: 'Wide for request waterfalls, stack traces, flame charts, month calendars, desktop mockups, '
          + 'or several panels side by side. Regular for a single plot, map, diagram, timeline, dialog or phone screen.',
      },
      path: {
        type: 'string',
        description: 'Destination file. Defaults to the Session store, keyed by the title.',
      },
      assets: {
        type: 'array',
        description: 'Images or data files the fragment references. They land beside the visualization, '
          + 'so the fragment reads them with a relative path such as assets/chart.png.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true, description: 'Plain file name, e.g. "chart.png".' },
            data: { type: 'string', required: true, description: 'Base64-encoded bytes.' },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          title: { type: 'string', required: true },
          mode: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          assets: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const title = assertTitle(args.title)
      const html = assertHtml(args.html)
      const mode = assertMode(args.mode)
      // One store per Session, so a thread's visualizations stay together and no
      // workspace accumulates its own artifact directory. `api/file` needs the
      // absolute path this returns.
      const store = storeDir(String(exec.agent.session.id))
      const target = destination(store, title, args.path)

      await assertNotReplaced(target, html)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, html, 'utf8')

      // Assets live beside the visualization, in the same Session directory, so
      // a fragment can reference them by a relative path and nothing leaks into
      // the workspace. `api/file` still needs the absolute URL, which the
      // fragment builds from the page it was served from.
      const assets = []
      for (const asset of Array.isArray(args.assets) ? args.assets : []) {
        assets.push(await writeAsset(join(store, 'assets'), asset))
      }

      return { path: target, title, mode, bytes: Buffer.byteLength(html, 'utf8'), assets }
    },
  }))
}
