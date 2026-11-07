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
import { mkdir, readdir, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertHtml, assertMode, assertTitle, DEFAULT_DIR, destination, MODES } from './lib/validate.js'

/** Stable Loader identity. */
export const name = 'dsh-visualize'

/** Services this plugin needs. */
export const inject = ['tools']

/** Visualizations older than this are pruned on the next write. */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The one directory every visualization lands in: the store root, then one
 * directory per Session, so a thread's visualizations stay together and the
 * root never becomes a flat pile.
 * @param sessionId - the owning Session.
 * @returns an absolute path under the Harness home.
 */
function storeDir(sessionId) {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, DEFAULT_DIR, sessionId)
}

/**
 * Delete stale visualizations so the store does not grow without bound.
 *
 * Walks the store root one level down, because each Session owns a directory
 * and an old Session's files would otherwise never be reached. Best effort: a
 * file that cannot be removed is left for the next write.
 * @param root - the store root.
 */
async function prune(root) {
  let sessions
  try {
    sessions = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  const cutoff = Date.now() - RETENTION_MS
  for (const session of sessions) {
    if (!session.isDirectory()) continue
    const dir = join(root, session.name)
    let names
    try {
      names = await readdir(dir)
    } catch {
      continue
    }
    let kept = 0
    for (const entry of names) {
      if (!entry.endsWith('.html')) continue
      const path = join(dir, entry)
      try {
        const info = await stat(path)
        if (info.mtimeMs < cutoff) await rm(path, { force: true })
        else kept += 1
      } catch {
        kept += 1
      }
    }
    // A Session whose files have all aged out leaves an empty directory behind.
    if (kept === 0) {
      try {
        await rmdir(dir)
      } catch {
        // Not empty after all, or another writer is active.
      }
    }
  }
}

/**
 * Register the `visualize` tool.
 * @param ctx - context carrying the tool registry.
 */
export function apply(ctx) {
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
        description: 'Destination file, relative to the working directory. Defaults to .dsh-visualize/<title>.html.',
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

      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, html, 'utf8')
      await prune(join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), DEFAULT_DIR))

      return { path: target, title, mode, bytes: Buffer.byteLength(html, 'utf8') }
    },
  }))
}
