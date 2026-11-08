/**
 * Pure validation and path rules for the `visualize` tool.
 *
 * Kept free of DSH imports so it can be unit-tested without a running
 * Harness, and so the tool body stays a thin shell around it.
 */
import { isAbsolute, resolve } from 'node:path'

/** Largest fragment accepted, matching the inline surface's budget. */
export const MAX_BYTES = 1024 * 1024

/** Width modes the client understands. */
export const MODES = ['regular', 'wide']

/** Scroll modes inside the frame. 'none' fits the content to the width. */
export const SCROLLS = ['none', 'x', 'y', 'both']

/** Where a visualization lands when the caller names no path. */
export const DEFAULT_DIR = 'visualize'

/** A title becomes a file name, so it stays inside a conservative alphabet. */
const TITLE = /^[a-z0-9][a-z0-9-]{0,63}$/

/** Markup that belongs to a document, not to a fragment. */
const DOCUMENT_TAG = /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i

/**
 * Reject a title that cannot be a file name.
 * @param value - caller-supplied title.
 * @returns the trimmed title.
 */
export function assertTitle(value) {
  const title = String(value ?? '').trim()
  if (!TITLE.test(title)) {
    throw new Error('visualize: title must be a lowercase ASCII slug (a-z, 0-9, hyphen), at most 64 characters')
  }
  return title
}

/**
 * Reject an empty, oversized, or document-shaped fragment.
 * @param value - caller-supplied HTML.
 * @returns the fragment unchanged.
 */
export function assertHtml(value) {
  const html = String(value ?? '')
  if (html.trim() === '') throw new Error('visualize: html is empty')
  if (Buffer.byteLength(html, 'utf8') > MAX_BYTES) {
    throw new Error(`visualize: html exceeds ${MAX_BYTES} bytes; aggregate, bin or downsample the data`)
  }
  if (DOCUMENT_TAG.test(html)) {
    throw new Error('visualize: write a fragment only — no doctype, html, head or body element')
  }
  return html
}

/**
 * Reject an unknown width mode.
 * @param value - caller-supplied mode, or undefined.
 * @returns the resolved mode.
 */
export function assertMode(value) {
  const mode = value === undefined ? 'regular' : String(value)
  if (!MODES.includes(mode)) throw new Error(`visualize: mode must be one of ${MODES.join(', ')}`)
  return mode
}

/**
 * Resolve the frame's scroll mode.
 * @param value - caller-supplied scroll, or undefined.
 * @returns the resolved mode; 'none' fits the content to the width.
 */
export function assertScroll(value) {
  const scroll = value === undefined ? 'none' : String(value)
  if (!SCROLLS.includes(scroll)) throw new Error(`visualize: scroll must be one of ${SCROLLS.join(', ')}`)
  return scroll
}

/**
 * Resolve the destination file.
 *
 * Every visualization lands in one store directory, so a workspace does not
 * accumulate a `.dsh-visualize/` per project and one place can be pruned. A
 * caller that names a path still gets exactly that path.
 * @param store - the store directory.
 * @param title - validated slug.
 * @param path - caller-supplied destination, or undefined for the store.
 * @returns an absolute path.
 */
export function destination(store, title, path) {
  if (path === undefined || String(path).trim() === '') {
    return resolve(store, `${title}.html`)
  }
  const requested = String(path)
  return isAbsolute(requested) ? requested : resolve(store, requested)
}
