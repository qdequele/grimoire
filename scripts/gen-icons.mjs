// Renders public/favicon.svg to favicon.ico (16/32/48) and apple-touch-icon.png. Run: pnpm icons
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const svg = readFileSync('public/favicon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const png = async (s) => {
  await page.setViewportSize({ width: s, height: s })
  await page.setContent(`<style>*{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${s}" height="${s}">`)
  return page.screenshot({ type: 'png' })
}
const sizes = [16, 32, 48]
const imgs = []
for (const s of sizes) imgs.push([s, await png(s)])
// ICO with embedded PNGs
const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4)
let off = 6 + 16 * imgs.length
const dirs = [], datas = []
for (const [s, d] of imgs) {
  const e = Buffer.alloc(16)
  e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
  e.writeUInt32LE(d.length, 8); e.writeUInt32LE(off, 12); off += d.length
  dirs.push(e); datas.push(d)
}
writeFileSync('public/favicon.ico', Buffer.concat([head, ...dirs, ...datas]))
writeFileSync('public/apple-touch-icon.png', await png(180))
if (process.argv[2]) writeFileSync(process.argv[2], await png(256))
await browser.close()
