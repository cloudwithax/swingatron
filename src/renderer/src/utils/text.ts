/**
 * decodes html entities in a string
 * handles common entities like &quot; &amp; &lt; &gt; &apos; and numeric entities
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text

  const entities: Record<string, string> = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '\u2026',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122'
  }

  // replace named entities
  let result = text
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char)
  }

  // replace numeric entities (decimal)
  result = result.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10))
  })

  // replace numeric entities (hex)
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16))
  })

  return result
}
