#!/usr/bin/env node
// After `vite build`: writes static HTML for every free tool page (dist/<path>/index.html), with its
// own title, description, canonical address, language alternates and schema.org data, plus
// dist/sitemap.xml and dist/robots.txt. The pages are rendered by src/tools/prerender.tsx, built
// here for Node (vite SSR build into node_modules/.prerender, thrown away after).
//
//   node scripts/prerender.mjs          (pnpm build runs it)
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'dist')
const out = path.join(root, 'node_modules/.prerender')

await build({
  root,
  logLevel: 'warn',
  build: {
    ssr: 'src/tools/prerender.tsx',
    outDir: out,
    emptyOutDir: true,
    copyPublicDir: false,
    // A string replaces the app's { main, play } inputs.
    rolldownOptions: { input: 'src/tools/prerender.tsx', output: { entryFileNames: 'prerender.mjs' } },
  },
})

const { render, publicPages, SITE } = await import(pathToFileURL(path.join(out, 'prerender.mjs')).href)
const template = await readFile(path.join(dist, 'index.html'), 'utf8')

const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
/** JSON inside <script>: no "</script>" can close it early. */
const jsonForScript = (v) => JSON.stringify(v).replaceAll('<', '\\u003c')

function replaceOnce(html, pattern, value, what) {
  const found = typeof pattern === 'string' ? html.includes(pattern) : pattern.test(html)
  if (!found) throw new Error(`prerender: ${what} not found in dist/index.html`)
  return html.replace(pattern, () => value)
}

function pageHtml(page, body) {
  const url = SITE + page.path
  const title = `${page.title} · Grimoire`
  const alternates = page.alternate
    ? [
        `<link rel="alternate" hreflang="${page.lang}" href="${SITE}${page.path}" />`,
        `<link rel="alternate" hreflang="${page.alternate.lang}" href="${SITE}${page.alternate.path}" />`,
        `<link rel="alternate" hreflang="x-default" href="${SITE}${page.lang === 'fr' ? page.path : page.alternate.path}" />`,
      ]
    : []
  const head = [
    `<link rel="canonical" href="${url}" />`,
    ...alternates,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="Grimoire" />`,
    `<meta property="og:locale" content="${page.lang === 'fr' ? 'fr_FR' : 'en_GB'}" />`,
    `<meta name="twitter:card" content="summary" />`,
    page.jsonLd && `<script type="application/ld+json">${jsonForScript(page.jsonLd)}</script>`,
  ].filter(Boolean).join('\n    ')

  let html = template
  html = replaceOnce(html, /<html lang="[^"]*"/, `<html lang="${page.lang}"`, '<html lang>')
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`, '<title>')
  html = replaceOnce(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escape(page.description)}" />`, 'meta description')
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escape(page.title)}" />`, 'og:title')
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escape(page.description)}" />\n    ${head}`, 'og:description')
  html = replaceOnce(html, '<div id="root"></div>', `<div id="root">${body}</div>`, '<div id="root">')
  return html
}

const pages = publicPages()
for (const page of pages) {
  const body = await render(page.path)
  if (!body.includes('<h1')) throw new Error(`prerender: ${page.path} rendered no <h1>`)
  const file = path.join(dist, page.path, 'index.html')
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, pageHtml(page, body))
}

// The landing page and the legal pages are public too (rendered in the browser).
const extra = ['/', '/confidentialite', '/privacy', '/conditions', '/terms', '/aide', '/help']
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...extra.map((p) => `  <url><loc>${SITE}${p}</loc></url>`),
  ...pages.map((p) => {
    const links = p.alternate
      ? [p, { lang: p.alternate.lang, path: p.alternate.path }].map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${SITE}${a.path}" />`).join('')
      : ''
    return `  <url><loc>${SITE}${p.path}</loc>${links}${links && '\n  '}</url>`
  }),
  '</urlset>',
  '',
].join('\n')
await writeFile(path.join(dist, 'sitemap.xml'), sitemap)

// The app's private screens (a keeper's account, links shared at the table) have nothing to index.
await writeFile(
  path.join(dist, 'robots.txt'),
  [
    'User-agent: *',
    'Allow: /',
    'Disallow: /games/',
    'Disallow: /t/',
    'Disallow: /screen/',
    'Disallow: /screen-preview',
    'Disallow: /oauth/',
    'Disallow: /characters',
    'Disallow: /settings',
    'Disallow: /stories',
    'Disallow: /login',
    'Disallow: /play.html',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
    '',
  ].join('\n'),
)

await rm(out, { recursive: true, force: true })
console.log(`prerender: ${pages.length} pages, sitemap.xml, robots.txt`)
