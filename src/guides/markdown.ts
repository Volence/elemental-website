/**
 * The tiny subset of markdown guide bodies use: paragraphs, **bold**, `code`,
 * "- " bullets, "1. " numbered steps and [label](href). Parsed to a block
 * tree so the renderer never touches innerHTML.
 */
export type Inline = { type: 'text'; text: string } | { type: 'bold'; text: string } | { type: 'code'; text: string } | { type: 'link'; text: string; href: string }
export type Block =
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

export function parseInlines(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) })
    const tok = m[0]
    if (tok.startsWith('**')) out.push({ type: 'bold', text: tok.slice(2, -2) })
    else if (tok.startsWith('`')) out.push({ type: 'code', text: tok.slice(1, -1) })
    else {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      if (mm) out.push({ type: 'link', text: mm[1], href: mm[2] })
    }
    last = start + tok.length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}

export function parseBlocks(body: string | null | undefined): Block[] {
  const lines = (body ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: Inline[][] } | null = null

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', inlines: parseInlines(para.join(' ')) })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ...list })
    list = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushPara(); flushList(); continue }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      flushPara()
      const ordered = Boolean(numbered)
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push(parseInlines((bullet ?? numbered)![1]))
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return blocks
}
