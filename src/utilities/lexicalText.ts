/**
 * Convert between Payload's Lexical rich-text JSON and plain text.
 *
 * The Tasks collection stores `description` as richText, but the workboard
 * modal edits it as a textarea. Before these helpers the modal read the field
 * as a string (so rich-text descriptions rendered empty) and wrote a bare
 * string back (so saving from the modal clobbered them). Round-tripping through
 * these keeps both editors working on the same data.
 */

export interface LexicalTextNode {
  type: 'text'
  text: string
  detail: number
  format: number
  mode: 'normal'
  style: string
  version: 1
}

export interface LexicalParagraphNode {
  type: 'paragraph'
  children: LexicalTextNode[]
  direction: 'ltr' | null
  format: ''
  indent: 0
  version: 1
  textFormat?: number
}

export interface LexicalRoot {
  root: {
    type: 'root'
    children: LexicalParagraphNode[]
    direction: 'ltr' | null
    format: ''
    indent: 0
    version: 1
  }
}

function collectText(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return
  const n = node as { type?: string; text?: string; children?: unknown[]; tag?: string }
  if (typeof n.text === 'string') {
    out.push(n.text)
    return
  }
  if (n.type === 'linebreak') {
    out.push('\n')
    return
  }
  if (Array.isArray(n.children)) {
    const isBlock = n.type === 'paragraph' || n.type === 'heading' || n.type === 'listitem' || n.type === 'quote'
    for (const child of n.children) collectText(child, out)
    if (isBlock) out.push('\n')
  }
}

/** Plain text from a Lexical document, a legacy string, or nothing. */
export function lexicalToPlainText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return ''
  const root = (value as { root?: unknown }).root
  if (!root) return ''
  const out: string[] = []
  collectText(root, out)
  // Blocks push a trailing newline; collapse and trim the tail.
  return out.join('').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')
}

function textNode(text: string): LexicalTextNode {
  return { type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }
}

/** Minimal Lexical document: one paragraph per line, empty lines preserved. */
export function plainTextToLexical(text: string): LexicalRoot | null {
  const trimmed = text.replace(/\r\n/g, '\n').replace(/\s+$/, '')
  if (!trimmed) return null
  const paragraphs: LexicalParagraphNode[] = trimmed.split('\n').map((line) => ({
    type: 'paragraph',
    children: line ? [textNode(line)] : [],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
  }))
  return {
    root: { type: 'root', children: paragraphs, direction: 'ltr', format: '', indent: 0, version: 1 },
  }
}
