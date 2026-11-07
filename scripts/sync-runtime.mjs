/**
 * Vendor the frame runtime from the Harness source into client.js, then
 * deploy the plugin into the running profile.
 *
 * The plugin used to require('@deepseek-ai/dsh-client-ui-primitives') and read
 * the runtime from there. That made the tool card depend on the *running* web
 * bundle: when the bundle predated the export, the injected script was
 * `undefined`, `viz` was never defined, and every JS-drawn chart silently
 * vanished while the static HTML around it still rendered.
 *
 * So the plugin carries its own copy, generated from the same source, and this
 * script also deploys the result — plugin files into the profile's
 * node_modules, the skill into ~/.dsh/skills — so one command takes a source
 * edit to a running harness.
 *
 * Usage:
 *   node scripts/sync-runtime.mjs           regenerate + deploy
 *   node scripts/sync-runtime.mjs --check   fail when anything is out of sync
 */
import { execFileSync, execSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(here, '..')

/** Harness source of truth. Override with DSH_SOURCE when the checkout moves. */
const HARNESS = process.env.DSH_SOURCE
  ?? 'D:/git/deepseek-harness'
const RUNTIME_TS = join(HARNESS, 'packages/client/ui-primitives/src/markdown/visualize-runtime.ts')

/** The profile this session's harness serves. DSH_PROFILE may be a bare
 * profile name (reveng) or an absolute path; resolve a name under ~/.dsh. */
const profileName = process.env.DSH_PROFILE ?? 'reveng'
const home = process.env.USERPROFILE ?? process.env.HOME
const PROFILE = isAbsolute(profileName) ? profileName : join(home, '.dsh', 'profiles', profileName)
const PROFILE_PLUGIN_DIR = join(PROFILE, 'node_modules', 'dsh-visualize')
const USER_SKILLS = process.env.DSH_SKILLS
  ? (isAbsolute(process.env.DSH_SKILLS) ? process.env.DSH_SKILLS : join(home, '.dsh', 'skills'))
  : join(home, '.dsh', 'skills')

/** client.js locations, by role. */
const CLIENT = join(pluginRoot, 'client.js')
const PLUGIN_FILES = ['client.js', 'index.js', 'lib/csv.js']

const BEGIN = '    // <generated:frame-runtime>'
const END = '    // </generated:frame-runtime>'

/** Names the plugin needs, in the order they are emitted. */
const NAMES = ['VISUALIZE_CSS', 'VISUALIZE_RUNTIME', 'VISUALIZE_CHART', 'VISUALIZE_CARD_CSS']

/** Local names inside client.js. */
const LOCAL = {
  VISUALIZE_CSS: 'FRAME_CSS',
  VISUALIZE_RUNTIME: 'FRAME_RUNTIME',
  VISUALIZE_CHART: 'FRAME_CHART',
  VISUALIZE_CARD_CSS: 'FRAME_CARD_CSS',
}

/**
 * The Harness commit the runtime was vendored from, so a drift between the
 * two repos is attributable.
 * @returns the short commit hash, or 'unknown' outside a git checkout.
 */
function harnessRev() {
  try {
    return execFileSync('git', ['-C', HARNESS, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Pull one template literal out of the runtime module.
 * @param text - the module source.
 * @param name - the exported const name.
 * @returns the literal's body.
 */
function extract(text, name) {
  const marker = `export const ${name} = \``
  const start = text.indexOf(marker)
  if (start < 0) throw new Error(`sync-runtime: ${name} not found in ${RUNTIME_TS}`)
  const from = start + marker.length
  const end = text.indexOf('\n`', from)
  if (end < 0) throw new Error(`sync-runtime: ${name} is not a closed template literal`)
  return text.slice(from, end)
}

/**
 * Build the generated block.
 * @param source - the runtime module's source text.
 * @returns the lines that replace everything between the markers.
 */
function buildBlock(source) {
  const rev = harnessRev()
  const parts = [
    `    // Vendored from deepseek-harness@${rev} (${RUNTIME_TS}).`,
    '    // Regenerate with `node scripts/sync-runtime.mjs` — do not edit by hand.',
  ]
  for (const name of NAMES) {
    const body = extract(source, name)
    if (body.includes('`')) throw new Error(`sync-runtime: ${name} contains a backtick; escape it before vendoring`)
    parts.push(`    const ${LOCAL[name]} = \`${body}\``)
  }
  parts.push('')
  parts.push('    /** The script runtime in document order, ready to inline before a fragment. */')
  parts.push("    const FRAME_SCRIPT = FRAME_RUNTIME + ';\\n' + FRAME_CHART")
  return parts.join('\n')
}

const runtimeTs = readFileSync(RUNTIME_TS, 'utf8')
const block = buildBlock(runtimeTs)

const client = readFileSync(CLIENT, 'utf8')
const beginAt = client.indexOf(BEGIN)
const endAt = client.indexOf(END)
if (beginAt < 0 || endAt < 0 || endAt < beginAt) {
  throw new Error(`sync-runtime: markers missing from ${CLIENT}`)
}

const next = client.slice(0, beginAt + BEGIN.length) + '\n' + block + '\n' + client.slice(endAt)

/**
 * Deploy the plugin files into the running profile.
 */
function deploy() {
  for (const file of PLUGIN_FILES) {
    copyFileSync(join(pluginRoot, file), join(PROFILE_PLUGIN_DIR, file))
  }
  copyFileSync(join(pluginRoot, 'skills/visualize/SKILL.md'), join(USER_SKILLS, 'visualize/SKILL.md'))
}

if (process.argv.includes('--check')) {
  if (next !== client) {
    console.error('sync-runtime: client.js is stale — run `node scripts/sync-runtime.mjs`')
    process.exit(1)
  }
  console.log('sync-runtime: client.js is up to date')
  process.exit(0)
}

writeFileSync(CLIENT, next, 'utf8')
deploy()
console.log(`sync-runtime: wrote ${NAMES.length} literals from ${RUNTIME_TS}`)
console.log(`sync-runtime: vendored from deepseek-harness@${harnessRev()}`)
console.log(`sync-runtime: deployed ${PLUGIN_FILES.length} plugin files to ${PROFILE}`)
