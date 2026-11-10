import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

// Parse the output the way a browser would, so assertions look at real
// elements and attributes instead of matching strings.
function render(source: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = renderMarkdown(source)
  return root
}

describe('renderMarkdown', () => {
  describe('formatting that must keep working', () => {
    it('renders bold, lists and inline code', () => {
      const root = render('**bold**\n\n- one\n- two\n\n`code`')

      expect(root.querySelector('strong')?.textContent).toBe('bold')
      expect(root.querySelectorAll('li')).toHaveLength(2)
      expect(root.querySelector('code')?.textContent).toBe('code')
    })

    it('renders task-list checkboxes as disabled inputs', () => {
      const root = render('- [x] done\n- [ ] todo')
      const boxes = root.querySelectorAll('input[type="checkbox"]')

      expect(boxes).toHaveLength(2)
      expect(boxes[0].hasAttribute('checked')).toBe(true)
      expect(boxes[0].hasAttribute('disabled')).toBe(true)
    })
  })

  describe('hostile input is rendered inert', () => {
    it('drops <img> and its onerror handler', () => {
      const root = render('<img src=x onerror=alert(1)>')

      expect(root.querySelector('img')).toBeNull()
      expect(root.innerHTML).not.toContain('onerror')
    })

    it('removes <script> tags', () => {
      const root = render('hi <script>alert(1)</script>')

      expect(root.querySelector('script')).toBeNull()
      expect(root.innerHTML).not.toContain('alert(1)')
    })

    it('removes <iframe> and inline style', () => {
      const root = render('<iframe src="https://evil.example"></iframe>\n\n<p style="position:fixed">x</p>')

      expect(root.querySelector('iframe')).toBeNull()
      expect(root.querySelector('[style]')).toBeNull()
    })

    it('strips event-handler attributes from allowed tags', () => {
      const root = render('<p onclick="alert(1)">text</p>')

      expect(root.querySelector('p')?.textContent).toBe('text')
      expect(root.querySelector('[onclick]')).toBeNull()
    })

    it('neutralises javascript: links', () => {
      const root = render('[click](javascript:alert(1))')
      const href = root.querySelector('a')?.getAttribute('href') ?? ''

      expect(href.toLowerCase()).not.toContain('javascript:')
    })
  })

  describe('links', () => {
    it('opens in a new tab without leaking window.opener', () => {
      const a = render('[docs](https://example.com)').querySelector('a')

      expect(a?.getAttribute('href')).toBe('https://example.com')
      expect(a?.getAttribute('target')).toBe('_blank')
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('overrides a rel/target the author tried to set', () => {
      const a = render('<a href="https://example.com" target="_self" rel="opener">x</a>').querySelector('a')

      expect(a?.getAttribute('target')).toBe('_blank')
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })
})
