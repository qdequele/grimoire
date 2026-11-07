import { describe, expect, it } from 'vitest'
import { sanitizeSvg, SVG_LIMITS, SvgError } from './svg-safe'

const wrap = (body: string, rootAttrs = 'viewBox="0 0 1600 900"') => `<svg xmlns="http://www.w3.org/2000/svg" ${rootAttrs}>${body}</svg>`
const refused = (svg: string, why?: RegExp) => {
  let error: unknown
  try {
    sanitizeSvg(svg)
  } catch (e) {
    error = e
  }
  expect(error, String(svg).slice(0, 120)).toBeInstanceOf(SvgError)
  if (why) expect((error as Error).message).toMatch(why)
}

describe('sanitizeSvg: what a good picture uses', () => {
  const scene = `<?xml version="1.0" encoding="UTF-8"?>
<!-- a harbour at night -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#2a3550"/></linearGradient>
    <radialGradient id="moon-glow" href="#sky" cx="0.5" cy="0.5" r="0.5"/>
    <filter id="haze"><feGaussianBlur stdDeviation="6"/><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3"/></filter>
    <clipPath id="frame"><rect width="1600" height="900"/></clipPath>
    <symbol id="window" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f3c46b"/></symbol>
    <style><![CDATA[ .ink { fill: #1a1410; font-family: cursive; } g > .lit { opacity: .8 } @media (min-width: 10px) { .x { fill: url(#sky) } } ]]></style>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <g clip-path="url(#frame)" style="filter: url(#haze); opacity: 0.9">
    <path d="M0 700 L400 520 L800 640 L1600 560 V900 H0 Z" fill="#05070c"/>
    <use xlink:href="#window" x="300" y="600" width="12" height="12" class="lit"/>
    <use href="#window" x="340" y="600" width="12" height="12"/>
  </g>
  <text x="800" y="850" text-anchor="middle" class="ink">Le phare &amp; la &#233;cluse<tspan dx="4">&#x2014;</tspan></text>
</svg>
<!-- end -->`

  it('keeps shapes, gradients, filters, symbols, internal references, styles and text', () => {
    const { svg, viewBox, bytes } = sanitizeSvg(scene)
    expect(viewBox).toEqual([0, 0, 1600, 900])
    expect(bytes).toBe(new TextEncoder().encode(svg).length)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="900" viewBox="0 0 1600 900">')).toBe(true)
    expect(svg).toContain('<use xlink:href="#window" x="300"')
    expect(svg).toContain('fill="url(#sky)"')
    expect(svg).toContain('Le phare &amp; la écluse<tspan dx="4">—</tspan>')
    expect(svg).toContain('g &gt; .lit')
    // Rebuilt from the tree: no declaration, comment or CDATA left.
    expect(svg).not.toMatch(/<\?xml|<!--|CDATA/)
    // The output is itself accepted, unchanged.
    expect(sanitizeSvg(svg).svg).toBe(svg)
  })

  it('adds the SVG namespace when it is missing, sizes the picture from its viewBox, and needs a viewBox', () => {
    expect(sanitizeSvg('<svg viewBox="0 0 800 1100"><rect width="800" height="1100"/></svg>').svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100"><rect width="800" height="1100"/></svg>\n',
    )
    expect(sanitizeSvg('<svg width="100%" height="100%" viewBox="0 0 16 9"/>').svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9"/>\n')
    refused('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>', /viewBox/)
    refused(wrap('', 'viewBox="0 0 0 900"'), /positive/)
    refused(wrap('', 'viewBox="zero"'), /viewBox/)
  })

  it('accepts single quotes, a byte order mark and whitespace around the root', () => {
    expect(sanitizeSvg("﻿\n  <svg viewBox='0 0 10 10'><circle cx='5' cy='5' r='4' fill='#000'/></svg>\n\n").svg).toContain('<circle cx="5" cy="5" r="4" fill="#000"/>')
  })
})

describe('sanitizeSvg: attacks are refused', () => {
  it('refuses scripts, HTML, raster images, links and animation', () => {
    refused(wrap('<script>alert(1)</script>'), /scripts/)
    refused(wrap('<SCRIPT>alert(1)</SCRIPT>'), /not allowed/)
    refused(wrap('<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>'), /not allowed/)
    refused(wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(1)"/></div></foreignObject>'), /foreignObject/)
    refused(wrap('<image href="https://evil.example/x.png" width="10" height="10"/>'), /raster images/)
    refused(wrap('<image href="data:image/png;base64,AAAA"/>'), /raster images/)
    refused(wrap('<filter id="f"><feImage href="https://evil.example/x.png"/></filter>'), /feImage/)
    refused(wrap('<a href="javascript:alert(1)"><rect width="10" height="10"/></a>'), /links/)
    refused(wrap('<animate attributeName="href" to="javascript:alert(1)"/>'), /animation/)
    refused(wrap('<set attributeName="onmouseover" to="alert(1)"/>'), /animation/)
    refused(wrap('<iframe src="https://evil.example"/>'), /iframes/)
    refused(wrap('<metadata><rdf:RDF/></metadata>'), /metadata/)
  })

  it('refuses event handlers, whatever their case', () => {
    refused('<svg viewBox="0 0 10 10" onload="alert(1)"/>', /event handlers/)
    refused(wrap('<rect width="10" height="10" ONCLICK="alert(1)"/>'), /event handlers/)
    refused(wrap('<rect width="10" height="10" onBegin="alert(1)"/>'), /event handlers/)
  })

  it('refuses external links: href only to #id, url() only to #id', () => {
    refused(wrap('<use href="https://evil.example/sprite.svg#x"/>'), /point inside the file/)
    refused(wrap('<use xlink:href="data:image/svg+xml;base64,PHN2Zz4="/>'), /point inside the file/)
    refused(wrap('<use href="javascript:alert(1)"/>'), /point inside the file/)
    refused(wrap('<rect href="#x" width="1" height="1"/>'), /allowed on/)
    refused(wrap('<rect id="r" width="1" height="1"/><use href="#missing"/>'), /not in the file/)
    refused(wrap('<rect fill="url(https://evil.example/p.svg#g)" width="1" height="1"/>'), /url\(#id\)/)
    refused(wrap('<rect fill="url(#ok) url(//evil.example/x)" width="1" height="1"/>'), /url\(#id\)/)
    refused(wrap('<rect fill="URL( \'http://evil.example\' )" width="1" height="1"/>'), /url\(#id\)/)
    refused(wrap('<rect filter="u&#114;l(http://evil.example)" width="1" height="1"/>'), /url\(#id\)/)
    refused(wrap('<rect class="data:text/html,x" width="1" height="1"/>'), /data:/)
  })

  it('refuses CSS that loads or hides something', () => {
    refused(wrap('<style>@import url(https://evil.example/x.css);</style>'), /url|@import/)
    refused(wrap('<style>@import "https://evil.example/x.css";</style>'), /@import/)
    refused(wrap('<style>@font-face { font-family: X; src: local(Arial) }</style>'), /@font-face/)
    refused(wrap('<style>rect { fill: url(https://evil.example/x) }</style>'), /url/)
    refused(wrap('<style>rect { background: image-set("x.png" 1x) }</style>'), /image-set/)
    refused(wrap('<style>rect { fill: u\\72l(https://evil.example/x) }</style>'), /backslash/)
    refused(wrap('<style>rect { fill: red } /* never closed</style>'), /comment/)
    refused(wrap('<style>rect { behavior: url(x.htc) }</style>'), /url|behavior/)
    refused(wrap('<style>rect { width: expression(alert(1)) }</style>'), /expression/)
    refused(wrap('<style><rect/></style>'), /CSS text only/)
    refused(wrap('<rect style="fill: url(http://evil.example/x)" width="1" height="1"/>'), /url/)
    refused(wrap('<rect style="fill:red;-moz-binding:url(x.xml#a)" width="1" height="1"/>'), /url|binding/)
    // A comment can't hide an url() from the check either: it is read the way a browser reads it.
    refused(wrap('<style>rect { fill: url/**/(http://evil.example/x) }</style>'), /url/)
  })

  it('refuses DOCTYPE, entities, processing instructions and other namespaces', () => {
    refused('<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1">&x;</svg>', /DOCTYPE/)
    refused('<?xml version="1.0"?><!DOCTYPE svg SYSTEM "file:///etc/passwd"><svg viewBox="0 0 1 1"/>', /DOCTYPE/)
    refused(wrap('<text>&xxe;</text>'), /unknown entity/)
    refused(wrap('<text>a & b</text>'), /&amp;/)
    refused(wrap('<?xml-stylesheet href="https://evil.example/x.css"?>'), /processing instructions/)
    refused('<?xml-stylesheet href="x.css"?><svg viewBox="0 0 1 1"/>', /processing instructions/)
    refused('<svg viewBox="0 0 1 1" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"/>', /namespaces/)
    refused('<svg viewBox="0 0 1 1" xmlns="http://www.w3.org/1999/xhtml"/>', /xmlns/)
    refused(wrap('<rect xml:base="https://evil.example/" width="1" height="1"/>'), /not allowed/)
    refused(wrap('<text>&#0;</text>'), /invalid/)
    refused(wrap('<text>&#1;</text>'), /control/)
  })

  it('refuses malformed XML instead of guessing', () => {
    refused('<html><svg viewBox="0 0 1 1"/></html>', /root <svg>/)
    refused('hello <svg viewBox="0 0 1 1"/>', /start with/)
    refused(wrap('<g><rect width="1" height="1"></g>'), /closes/)
    refused('<svg viewBox="0 0 1 1"><g>', /never closed/)
    refused(wrap('<rect width=1 height="1"/>'), /quotes/)
    refused(wrap('<rect width="1"height="1"/>'), /separated/)
    refused(wrap('<rect width="1" width="2"/>'), /repeated/)
    refused(wrap('<rect title="a<b"/>'), /&lt;/)
    refused(wrap('<g>stray text</g>'), /text is allowed only/)
    refused(`${wrap('')}<script>alert(1)</script>`, /follow/)
    refused(wrap('<![CDATA[x]]>'), /CDATA/)
    refused(wrap('<rect id="1bad" width="1" height="1"/>'), /id/)
    refused(wrap('<rect width="1" height="1" inkscape:label="x"/>'), /not allowed/)
    refused(wrap('<!-- open'), /comment/)
    refused('', /SVG source/)
    refused(42 as unknown as string, /SVG source/)
  })

  it('refuses <use> loops and exponential <use> chains', () => {
    refused(wrap('<g id="a"><use href="#a"/></g>'), /loop/)
    refused(wrap('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g>'), /loop/)
    refused(wrap('<linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/>'), /loop/)
    let body = '<g id="l0"><rect width="1" height="1"/></g>'
    for (let n = 1; n <= 8; n++) body += `<g id="l${n}">${Array.from({ length: 10 }, () => `<use href="#l${n - 1}"/>`).join('')}</g>`
    refused(wrap(`<defs>${body}</defs>`), /expands/)
  })

  it('refuses files that are too large or too deep', () => {
    refused(wrap(`<path d="M0 0 ${'L1 1 '.repeat(SVG_LIMITS.bytes / 5)}"/>`), /KB/)
    refused(wrap('<g>'.repeat(SVG_LIMITS.depth + 1) + '</g>'.repeat(SVG_LIMITS.depth + 1)), /nested/)
    refused(wrap('<rect/>'.repeat(SVG_LIMITS.elements + 1)), /elements/)
  })

  it('writes attribute values and texts escaped', () => {
    const { svg } = sanitizeSvg(wrap('<text font-family="&quot;Old&quot;, serif">&lt;b&gt;hi&lt;/b&gt;</text><title>a "b" &apos;c&apos;</title>'))
    expect(svg).toContain('<text font-family="&quot;Old&quot;, serif">&lt;b&gt;hi&lt;/b&gt;</text>')
    expect(svg).toContain(`<title>a "b" 'c'</title>`)
  })
})
