// SVG pictures drawn by the keeper's chat model (MCP save_image), made safe to store and show.
//
// The file is served from Storage as image/svg+xml: shown through <img> or a CSS url() it can't run
// scripts, but anyone opening its (signed) address directly gets a full SVG document in the Storage
// origin. So nothing active may get through: the source is parsed with a strict, minimal XML parser,
// every element and attribute must be on an allowlist, links may only point inside the file (#id),
// and the file is written back from the parsed tree (no comment, CDATA, entity or declaration left
// for another parser to read differently). When in doubt it refuses, with a message the model can act
// on, rather than quietly dropping what it doesn't like.
//
// Pure TypeScript, no Deno or browser APIs: used by the mcp Edge Function and unit-tested with Vitest.

export const SVG_LIMITS = {
  /** Source size, in bytes (UTF-8). */
  bytes: 300 * 1024,
  /** Elements in the file. */
  elements: 20_000,
  /** Nesting depth. */
  depth: 48,
  /** Elements drawn once every <use> is expanded (guards against exponential <use> chains). */
  rendered: 100_000,
} as const

/** A refused SVG: the message says what is wrong and where. */
export class SvgError extends Error {}

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

const FILTER_PRIMITIVES = [
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
]

/** Everything a picture needs: shapes, text, paint servers, clipping, masks, markers and filters. */
export const SVG_ELEMENTS: ReadonlySet<string> = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'style',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath',
  'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'marker', 'filter',
  ...FILTER_PRIMITIVES,
])

/** Elements refused on purpose, with the reason the model is told. */
const REFUSED: Record<string, string> = {
  script: 'scripts are not allowed',
  foreignObject: 'foreignObject (embedded HTML) is not allowed',
  image: 'external or embedded raster images are not allowed: draw everything with shapes',
  feImage: 'feImage is not allowed: it loads images',
  a: 'links are not allowed',
  iframe: 'iframes are not allowed',
  embed: 'embedded content is not allowed',
  object: 'embedded content is not allowed',
  audio: 'media is not allowed',
  video: 'media is not allowed',
  animate: 'animation elements are not allowed (the ambiance screen animates the picture itself)',
  animateMotion: 'animation elements are not allowed (the ambiance screen animates the picture itself)',
  animateTransform: 'animation elements are not allowed (the ambiance screen animates the picture itself)',
  animateColor: 'animation elements are not allowed (the ambiance screen animates the picture itself)',
  set: 'animation elements are not allowed (the ambiance screen animates the picture itself)',
  discard: 'animation elements are not allowed',
  switch: 'switch is not allowed',
  metadata: 'metadata is not allowed: remove it',
  font: 'SVG fonts are not allowed: use generic font families (serif, sans-serif, monospace, cursive)',
  'font-face': 'SVG fonts are not allowed: use generic font families (serif, sans-serif, monospace, cursive)',
  cursor: 'cursor is not allowed',
  view: 'view is not allowed',
  handler: 'handlers are not allowed',
  listener: 'listeners are not allowed',
}

/** Attributes allowed on any allowed element (SVG ignores the ones that don't apply). */
export const SVG_ATTRIBUTES: ReadonlySet<string> = new Set([
  // core and geometry
  'id', 'class', 'style', 'lang', 'xml:space', 'xmlns', 'xmlns:xlink', 'version', 'viewBox', 'preserveAspectRatio',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr', 'width', 'height', 'd', 'points', 'pathLength', 'transform',
  // presentation
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'color', 'display', 'visibility', 'overflow', 'clip-path', 'clip-rule', 'mask', 'filter',
  'marker-start', 'marker-mid', 'marker-end', 'paint-order', 'vector-effect', 'shape-rendering', 'text-rendering', 'image-rendering',
  'color-interpolation', 'color-interpolation-filters', 'mix-blend-mode', 'isolation', 'stop-color', 'stop-opacity', 'flood-color',
  'flood-opacity', 'lighting-color',
  // text
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'font-stretch', 'letter-spacing', 'word-spacing', 'text-anchor',
  'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'text-decoration', 'writing-mode', 'direction', 'unicode-bidi',
  'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust', 'startOffset', 'method', 'spacing', 'side',
  // paint servers, clipping, masks, markers
  'offset', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'patternUnits', 'patternContentUnits', 'patternTransform',
  'clipPathUnits', 'maskUnits', 'maskContentUnits', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient',
  // filters
  'filterUnits', 'primitiveUnits', 'in', 'in2', 'result', 'stdDeviation', 'type', 'values', 'mode', 'operator', 'k1', 'k2', 'k3', 'k4',
  'baseFrequency', 'numOctaves', 'seed', 'stitchTiles', 'scale', 'xChannelSelector', 'yChannelSelector', 'radius', 'surfaceScale',
  'diffuseConstant', 'specularConstant', 'specularExponent', 'kernelMatrix', 'order', 'divisor', 'bias', 'targetX', 'targetY',
  'edgeMode', 'preserveAlpha', 'kernelUnitLength', 'tableValues', 'slope', 'intercept', 'amplitude', 'exponent', 'azimuth',
  'elevation', 'z', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'limitingConeAngle',
  // internal references only (checked below)
  'href', 'xlink:href',
])

/** Elements whose href may point to another element of the file. */
const HREF_ELEMENTS = new Set(['use', 'textPath', 'linearGradient', 'radialGradient', 'pattern', 'filter'])
/** Elements that may hold text. */
const TEXT_ELEMENTS = new Set(['text', 'tspan', 'textPath', 'title', 'desc', 'style'])

const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y
const ID = /^[A-Za-z_][\w.-]*$/
const LOCAL_REF = /^#([A-Za-z_][\w.-]*)$/
const LOCAL_URL = /url\(\s*(['"]?)#[A-Za-z_][\w.-]*\1\s*\)/gi
const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?`
const VIEWBOX = new RegExp(String.raw`^\s*(${NUMBER})[\s,]+(${NUMBER})[\s,]+(${NUMBER})[\s,]+(${NUMBER})\s*$`)
// Control characters other than tab, newline and carriage return (XML 1.0 refuses them).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/

interface SvgNode {
  name: string
  attrs: Array<[string, string]>
  children: Array<SvgNode | string>
  line: number
}

export interface SafeSvg {
  /** The SVG as stored: rebuilt from the parsed tree. */
  svg: string
  viewBox: [number, number, number, number]
  /** Size of `svg` in bytes. */
  bytes: number
}

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => escText(s).replace(/"/g, '&quot;')

/**
 * CSS from a <style> element or a style attribute: plain declarations only. Anything that could load
 * something (url() other than url(#id), image-set, @import, @font-face…) or hide it (backslash escapes)
 * is refused.
 */
function checkCss(css: string, where: string) {
  if (/\/\*(?![\s\S]*?\*\/)/.test(css)) throw new SvgError(`${where}: unterminated CSS comment.`)
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(LOCAL_URL, '')
  if (/\\/.test(plain)) throw new SvgError(`${where}: backslash escapes are not allowed in CSS.`)
  if (plain.includes('<')) throw new SvgError(`${where}: "<" is not allowed in CSS.`)
  const bad = plain.match(/url\s*\(|image-set|image\s*\(|cross-fade|element\s*\(|\bsrc\s*\(|expression\s*\(|javascript|vbscript|-moz-binding|behavior\s*:/i)
  if (bad) throw new SvgError(`${where}: "${bad[0]}" is not allowed in CSS. Only url(#id) can reference something, and only inside the file.`)
  for (const m of plain.matchAll(/@([\w-]*)/g)) {
    if (!['media', 'keyframes', '-webkit-keyframes', 'supports'].includes(m[1].toLowerCase())) {
      throw new SvgError(`${where}: @${m[1]} is not allowed in CSS (no @import, @font-face: use generic font families such as serif or cursive).`)
    }
  }
}

/** Any attribute value: url() only to #id, no script or data URLs. */
function checkValue(name: string, value: string, where: string) {
  if (CONTROL.test(value)) throw new SvgError(`${where}: ${name} holds control characters.`)
  if (/(?:javascript|vbscript|data)\s*:/i.test(value)) throw new SvgError(`${where}: ${name} must not hold a javascript:, vbscript: or data: URL.`)
  if (/url\s*\(/i.test(value.replace(LOCAL_URL, ''))) {
    throw new SvgError(`${where}: ${name} may use url(#id) only, pointing to an element of this file (no external URL).`)
  }
}

/** Decode the five XML entities and character references; anything else is refused. */
function decode(raw: string, line: () => number): string {
  return raw.replace(/&([^;\s&<]{0,12});?/g, (m, body: string) => {
    if (!m.endsWith(';')) throw new SvgError(`line ${line()}: "&" must be written &amp;.`)
    const named: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
    if (body in named) return named[body]
    const num = /^#(\d{1,7})$/.exec(body)?.[1]
    const hex = /^#x([0-9a-fA-F]{1,6})$/.exec(body)?.[1]
    const code = num ? Number(num) : hex ? parseInt(hex, 16) : NaN
    if (!Number.isFinite(code)) throw new SvgError(`line ${line()}: unknown entity &${body}; (only &lt; &gt; &amp; &quot; &apos; and &#…; are allowed).`)
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new SvgError(`line ${line()}: invalid character reference &${body};.`)
    const ch = String.fromCodePoint(code)
    if (CONTROL.test(ch)) throw new SvgError(`line ${line()}: control character &${body}; is not allowed.`)
    return ch
  })
}

/** Parse, check and rebuild an SVG. Throws SvgError with a message for the model. */
export function sanitizeSvg(input: unknown): SafeSvg {
  if (typeof input !== 'string' || !input.trim()) throw new SvgError('svg must be the SVG source, as text.')
  const size = new TextEncoder().encode(input).length
  if (size > SVG_LIMITS.bytes) {
    throw new SvgError(`The SVG is ${Math.ceil(size / 1024)} KB: at most ${SVG_LIMITS.bytes / 1024} KB. Use fewer, simpler paths (round coordinates to whole numbers, reuse shapes with <use>).`)
  }
  const src = input.replace(/^﻿/, '')
  if (CONTROL.test(src)) throw new SvgError('The SVG holds control characters.')

  let i = 0
  const lineAt = (pos: number) => src.slice(0, pos).split('\n').length
  const at = () => `line ${lineAt(i)}`
  const fail = (msg: string): never => {
    throw new SvgError(`${at()}: ${msg}`)
  }
  const skipSpace = () => {
    while (i < src.length && /\s/.test(src[i])) i++
  }
  const skipComment = () => {
    const end = src.indexOf('-->', i + 4)
    if (end === -1) fail('unterminated comment.')
    i = end + 3
  }
  const readName = () => {
    NAME.lastIndex = i
    const m = NAME.exec(src)
    if (!m) fail('expected a tag or attribute name.')
    i += m![0].length
    return m![0]
  }

  // Prolog: an optional XML declaration, then comments and whitespace only.
  skipSpace()
  if (/^<\?xml\s/.test(src.slice(i, i + 6))) {
    const m = /^<\?xml(?:\s+[a-z]+\s*=\s*(?:"[^"<>?]*"|'[^'<>?]*'))*\s*\?>/.exec(src.slice(i))
    if (!m) fail('malformed XML declaration.')
    i += m![0].length
  }
  for (;;) {
    skipSpace()
    if (src.startsWith('<!--', i)) skipComment()
    else break
  }
  if (src.startsWith('<!', i)) fail('DOCTYPE and entity declarations are not allowed.')
  if (src.startsWith('<?', i)) fail('processing instructions are not allowed.')
  if (!src.startsWith('<svg', i)) fail('the file must start with the root <svg> element.')

  // The document node holds the root; after the root closes, only whitespace and comments may follow.
  const doc: SvgNode = { name: '#document', attrs: [], children: [], line: 0 }
  const stack: SvgNode[] = [doc]
  let elements = 0

  while (i < src.length) {
    const top = stack[stack.length - 1]
    if (top === doc && doc.children.length) {
      skipSpace()
      if (i >= src.length) break
      if (src.startsWith('<!--', i)) {
        skipComment()
        continue
      }
      fail('nothing may follow the closing </svg>.')
    }
    if (src.startsWith('<!--', i)) {
      skipComment()
    } else if (src.startsWith('<![CDATA[', i)) {
      if (top.name !== 'style') fail('CDATA sections are allowed in <style> only.')
      const end = src.indexOf(']]>', i)
      if (end === -1) fail('unterminated CDATA section.')
      top.children.push(src.slice(i + 9, end))
      i = end + 3
    } else if (src.startsWith('<!', i)) {
      fail('DOCTYPE and entity declarations are not allowed.')
    } else if (src.startsWith('<?', i)) {
      fail('processing instructions are not allowed.')
    } else if (src.startsWith('</', i)) {
      i += 2
      const name = readName()
      skipSpace()
      if (src[i] !== '>') fail(`malformed closing tag </${name}.`)
      i++
      if (name !== top.name) fail(`</${name}> closes <${top.name}> (opened line ${top.line}).`)
      stack.pop()
    } else if (src[i] === '<') {
      const line = lineAt(i)
      i++
      const name = readName()
      const where = `line ${line}: <${name}>`
      if (REFUSED[name]) throw new SvgError(`${where}: ${REFUSED[name]}.`)
      if (!SVG_ELEMENTS.has(name)) throw new SvgError(`${where} is not allowed. Use only: ${[...SVG_ELEMENTS].join(', ')}.`)
      if (top === doc && name !== 'svg') throw new SvgError(`${where}: the root element must be <svg>.`)
      if (++elements > SVG_LIMITS.elements) throw new SvgError(`More than ${SVG_LIMITS.elements} elements: simplify the drawing.`)
      if (stack.length > SVG_LIMITS.depth) throw new SvgError(`${where}: nested more than ${SVG_LIMITS.depth} levels deep.`)
      const node: SvgNode = { name, attrs: [], children: [], line }
      const seen = new Set<string>()
      for (;;) {
        const before = i
        skipSpace()
        if (src.startsWith('/>', i) || src[i] === '>') break
        if (i === before) fail(`attributes of <${name}> must be separated by spaces.`)
        const attr = readName()
        skipSpace()
        if (src[i] !== '=') fail(`attribute ${attr} of <${name}> needs a quoted value.`)
        i++
        skipSpace()
        const q = src[i]
        if (q !== '"' && q !== "'") fail(`the value of ${attr} must be in quotes.`)
        const end = src.indexOf(q, i + 1)
        if (end === -1) fail(`unterminated value of ${attr}.`)
        const raw = src.slice(i + 1, end)
        if (raw.includes('<')) fail(`"<" in the value of ${attr} must be written &lt;.`)
        i = end + 1
        if (seen.has(attr)) throw new SvgError(`${where}: attribute ${attr} is repeated.`)
        seen.add(attr)
        const value = decode(raw, () => line).replace(/[\t\n\r]/g, ' ')
        if (/^on/i.test(attr)) throw new SvgError(`${where}: event handlers (${attr}) are not allowed.`)
        if (attr === 'xmlns') {
          if (value !== SVG_NS) throw new SvgError(`${where}: xmlns must be "${SVG_NS}".`)
        } else if (attr === 'xmlns:xlink') {
          if (value !== XLINK_NS) throw new SvgError(`${where}: xmlns:xlink must be "${XLINK_NS}".`)
        } else if (attr.startsWith('xmlns')) {
          throw new SvgError(`${where}: ${attr}: only the SVG and xlink namespaces are allowed (remove editor namespaces).`)
        } else if (attr === 'xml:space') {
          if (value !== 'default' && value !== 'preserve') throw new SvgError(`${where}: xml:space must be "default" or "preserve".`)
        } else if (attr === 'href' || attr === 'xlink:href') {
          if (!HREF_ELEMENTS.has(name)) throw new SvgError(`${where}: ${attr} is allowed on ${[...HREF_ELEMENTS].join(', ')} only.`)
          if (!LOCAL_REF.test(value)) throw new SvgError(`${where}: ${attr} must point inside the file ("#some-id"), not to "${value.slice(0, 60)}".`)
        } else if (!SVG_ATTRIBUTES.has(attr)) {
          throw new SvgError(`${where}: attribute ${attr} is not allowed.`)
        } else if (attr === 'id' && !ID.test(value)) {
          throw new SvgError(`${where}: id "${value.slice(0, 60)}" must start with a letter and hold only letters, digits, "-", "_" and ".".`)
        }
        if (attr === 'style') checkCss(value, `${where} style`)
        checkValue(attr, value, where)
        node.attrs.push([attr, value])
      }
      top.children.push(node)
      if (src.startsWith('/>', i)) {
        i += 2
      } else {
        i++
        stack.push(node)
      }
    } else {
      const end = src.indexOf('<', i)
      const raw = src.slice(i, end === -1 ? src.length : end)
      const textValue = decode(raw, () => lineAt(i))
      if (textValue.trim() && !TEXT_ELEMENTS.has(top.name)) {
        fail(`text is allowed only inside ${[...TEXT_ELEMENTS].join(', ')} (found in <${top.name}>).`)
      }
      if (TEXT_ELEMENTS.has(top.name)) top.children.push(textValue)
      i = end === -1 ? src.length : end
    }
  }
  if (stack.length > 1) throw new SvgError(`<${stack[stack.length - 1].name}> (line ${stack[stack.length - 1].line}) is never closed.`)
  const root = doc.children[0]
  if (!root || typeof root === 'string') throw new SvgError('No <svg> element.')

  // <style> contents.
  const ids = new Map<string, SvgNode>()
  let usesXlink = false
  const walk = (n: SvgNode, fn: (n: SvgNode) => void) => {
    fn(n)
    for (const c of n.children) if (typeof c !== 'string') walk(c, fn)
  }
  walk(root, (n) => {
    if (n.name === 'style') {
      if (n.children.some((c) => typeof c !== 'string')) throw new SvgError(`line ${n.line}: <style> may hold CSS text only.`)
      checkCss(n.children.join(''), `line ${n.line}: <style>`)
    }
    for (const [k, v] of n.attrs) {
      if (k === 'id' && !ids.has(v)) ids.set(v, n)
      if (k === 'xlink:href') usesXlink = true
    }
  })

  // References must exist; <use> chains must not loop or explode.
  const target = (n: SvgNode) => {
    const ref = n.attrs.find(([k]) => k === 'href' || k === 'xlink:href')?.[1]
    if (!ref) return null
    const t = ids.get(ref.slice(1))
    if (!t) throw new SvgError(`line ${n.line}: <${n.name}> points to ${ref}, which is not in the file.`)
    return t
  }
  const counts = new Map<SvgNode, number>()
  const visiting = new Set<SvgNode>()
  const rendered = (n: SvgNode): number => {
    const known = counts.get(n)
    if (known !== undefined) return known
    if (visiting.has(n)) throw new SvgError(`line ${n.line}: <${n.name}> is part of a reference loop.`)
    visiting.add(n)
    let total = 1
    for (const c of n.children) if (typeof c !== 'string') total += rendered(c)
    const t = target(n)
    if (t && n.name === 'use') total += rendered(t)
    else if (t) rendered(t) // gradients, patterns, filters inheriting from another: check for loops
    visiting.delete(n)
    if (total > SVG_LIMITS.rendered) throw new SvgError(`The drawing expands to more than ${SVG_LIMITS.rendered} elements through <use>: simplify it.`)
    counts.set(n, total)
    return total
  }
  rendered(root)

  // The root: a viewBox, and the namespaces an image/svg+xml file needs.
  const vbRaw = root.attrs.find(([k]) => k === 'viewBox')?.[1]
  const vb = vbRaw ? VIEWBOX.exec(vbRaw) : null
  if (!vb) throw new SvgError('The root <svg> needs a viewBox, e.g. viewBox="0 0 1600 900" for a scene background.')
  const viewBox = [Number(vb[1]), Number(vb[2]), Number(vb[3]), Number(vb[4])] as [number, number, number, number]
  if (!(viewBox[2] > 0 && viewBox[3] > 0 && viewBox[2] <= 100_000 && viewBox[3] <= 100_000)) {
    throw new SvgError('The viewBox width and height must be positive (and at most 100000).')
  }
  // width and height from the viewBox: an <img> of an SVG without them is drawn 300 px wide (handouts
  // on the ambiance screen are <img> elements, scaled down to fit).
  const rootAttrs = root.attrs.filter(([k]) => !['xmlns', 'xmlns:xlink', 'width', 'height'].includes(k))
  root.attrs = [
    ['xmlns', SVG_NS],
    ...(usesXlink ? [['xmlns:xlink', XLINK_NS] as [string, string]] : []),
    ['width', String(viewBox[2])],
    ['height', String(viewBox[3])],
    ...rootAttrs,
  ]

  const out = (n: SvgNode): string => {
    const attrs = n.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('')
    if (!n.children.length) return `<${n.name}${attrs}/>`
    return `<${n.name}${attrs}>${n.children.map((c) => (typeof c === 'string' ? escText(c) : out(c))).join('')}</${n.name}>`
  }
  const svg = `${out(root)}\n`
  return { svg, viewBox, bytes: new TextEncoder().encode(svg).length }
}
