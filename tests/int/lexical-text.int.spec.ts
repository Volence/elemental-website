import { describe, it, expect } from 'vitest'
import { lexicalToPlainText, plainTextToLexical } from '@/utilities/lexicalText'

describe('lexicalToPlainText', () => {
  it('passes strings through and returns empty for nothing', () => {
    expect(lexicalToPlainText('hello')).toBe('hello')
    expect(lexicalToPlainText(null)).toBe('')
    expect(lexicalToPlainText(undefined)).toBe('')
    expect(lexicalToPlainText(42)).toBe('')
  })

  it('flattens paragraphs and inline formatting from a Lexical document', () => {
    const doc = {
      root: {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'Make the ' }, { type: 'text', text: 'banner', format: 1 }, { type: 'text', text: ' pink.' }] },
          { type: 'paragraph', children: [] },
          { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Sizes' }] },
          { type: 'list', children: [{ type: 'listitem', children: [{ type: 'text', text: '1920x1080' }] }] },
        ],
      },
    }
    expect(lexicalToPlainText(doc)).toBe('Make the banner pink.\n\nSizes\n1920x1080')
  })
})

describe('plainTextToLexical', () => {
  it('returns null for blank input so the field is cleared rather than saved as an empty doc', () => {
    expect(plainTextToLexical('')).toBeNull()
    expect(plainTextToLexical('   \n')).toBeNull()
  })

  it('creates one paragraph per line and round-trips', () => {
    const doc = plainTextToLexical('line one\n\nline three')!
    expect(doc.root.children).toHaveLength(3)
    expect(doc.root.children[1].children).toHaveLength(0)
    expect(lexicalToPlainText(doc)).toBe('line one\n\nline three')
  })
})
