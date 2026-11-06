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
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertHtml, assertMode, assertTitle, destination, MODES } from './lib/validate.js'

/** Stable Loader identity. */
export const name = 'dsh-visualize'

/** Services this plugin needs. */
export const inject = ['tools', 'workingDirectory']

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
      // The Session's working directory, not the server process's: a
      // visualization belongs beside the work it describes, and `api/file`
      // serves paths relative to the same root.
      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const target = destination(cwd, title, args.path)

      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, html, 'utf8')

      return { path: target, title, mode, bytes: Buffer.byteLength(html, 'utf8') }
    },
  }))
}
