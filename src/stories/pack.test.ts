import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { mimeOf, PACK_FILE_MAX_BYTES, packSceneCount, readPack, splitPacks, unzipPack, zipPack } from './pack'

const sample = readFileSync('stories/the-silent-light/story.json')
const png = new Uint8Array([137, 80, 78, 71])

const entry = (path: string, data: Uint8Array | string) => ({ path, data: typeof data === 'string' ? strToU8(data) : data })

describe('readPack', () => {
  it('reads a pack with story.json at the top', () => {
    const r = readPack([entry('story.json', sample), entry('images/map.png', png), entry('sounds/chant.mp3', png)])
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect((r.story!.meta as { title: string }).title).toBe('The Silent Light')
    expect(r.files.map((f) => [f.path, f.type])).toEqual([['images/map.png', 'image/png'], ['sounds/chant.mp3', 'audio/mpeg']])
  })

  it('reads a zipped folder (story.json one level down) and keeps paths relative to it', () => {
    const r = readPack([entry('the-silent-light/story.json', sample), entry('the-silent-light/images/map.png', png)])
    expect(r.errors).toEqual([])
    expect(r.files.map((f) => f.path)).toEqual(['images/map.png'])
  })

  it('drops OS clutter and anything trying to leave the pack', () => {
    const r = readPack([
      entry('story.json', sample), entry('__MACOSX/._story.json', 'x'), entry('.DS_Store', 'x'),
      entry('images/.hidden.png', png), entry('../escape.png', png), entry('images/ok.png', png),
    ])
    expect(r.files.map((f) => f.path)).toEqual(['images/ok.png'])
  })

  it('refuses a pack without story.json, with bad JSON, or with two stories', () => {
    expect(readPack([entry('images/a.png', png)]).errors).toEqual(['Aucun fichier story.json dans ce pack.'])
    expect(readPack([entry('story.json', '{oops')]).errors).toEqual(['story.json n’est pas un JSON valide.'])
    expect(readPack([entry('a/story.json', sample), entry('b/story.json', sample)]).errors[0]).toMatch(/plusieurs histoires/)
  })

  it('refuses a story the app could not store or play', () => {
    const r = readPack([entry('story.json', JSON.stringify({ format: 'other', meta: {}, acts: [] }))])
    expect(r.story).toBeNull()
    expect(r.errors).toEqual(expect.arrayContaining(['meta.title manquant.', 'Aucune scène.']))
  })

  it('refuses a story whose acts or scenes lack what every screen reads', () => {
    const base = { format: 'grimoire-story/1', meta: { id: 'x', title: 'X', lang: 'fr' } }
    const scene = { id: 's1', title: 'S' }
    const read = (acts: unknown) => readPack([entry('story.json', JSON.stringify({ ...base, acts }))])
    const badAct = (at: string) => [`Acte mal formé (id, title et scenes sont requis) : ${at}`]
    const badScene = (at: string) => [`Scène mal formée (id et title sont requis) : ${at}`]
    // One good act is not enough: the list and the story page read every act's scenes.
    const noScenes = read([{ id: 'a1', title: 'I', scenes: [scene] }, { id: 'a2', title: 'II' }])
    expect(noScenes.story).toBeNull()
    expect(noScenes.errors).toEqual(badAct('acts[1]'))
    expect(read([{ id: 'a1', title: 'I', scenes: [scene] }, null]).errors).toEqual(badAct('acts[1]'))
    expect(read([{ title: 'I', scenes: [scene] }]).errors).toEqual(badAct('acts[0]'))
    expect(read([{ id: 'a1', title: 'I', scenes: [scene, { id: 's2' }] }]).errors).toEqual(badScene('acts[0].scenes[1]'))
    expect(read([{ id: 'a1', title: 'I', scenes: [scene, 'oops'] }]).errors).toEqual(badScene('acts[0].scenes[1]'))
    // An act may still be empty, as long as the story has a scene somewhere.
    const emptyAct = read([{ id: 'a1', title: 'I', scenes: [scene] }, { id: 'a2', title: 'II', scenes: [] }])
    expect(emptyAct.errors).toEqual([])
    expect(emptyAct.story).not.toBeNull()
  })

  it('refuses file names Storage would refuse half-way through the import', () => {
    const refused = (path: string) => readPack([entry('story.json', sample), entry(path, png)])
    const error = (path: string) => [`Nom de fichier refusé (lettres sans accent, chiffres, espaces et - _ . ( ) seulement) : ${path}`]
    // Accents (composed or decomposed, as macOS zips store them), #, [ ], %, and ? which would cut the address.
    for (const path of ['images/château.jpg', 'images/château.jpg', 'images/carte #1.jpg', 'images/map[1].jpg', 'images/50%.png', 'images/quoi?.png', 'sons/tonnerre~1.mp3']) {
      const r = refused(path)
      expect(r.errors, path).toEqual(error(path))
      expect(r.story, path).toBeNull()
    }
    const ok = readPack([entry('story.json', sample), entry('images/plan du manoir (rez-de-chaussee)_v2.jpg', png), entry("images/l'entree.png", png)])
    expect(ok.errors).toEqual([])
    expect(ok.files).toHaveLength(2)
  })

  it('refuses a file larger than the bucket accepts', () => {
    const big = { length: PACK_FILE_MAX_BYTES + 1 } as Uint8Array
    expect(readPack([entry('story.json', sample), { path: 'sounds/long.mp3', data: big }]).errors).toEqual(['Fichier trop lourd (50 Mo au plus) : sounds/long.mp3'])
    const limit = { length: PACK_FILE_MAX_BYTES } as Uint8Array
    expect(readPack([entry('story.json', sample), { path: 'sounds/long.mp3', data: limit }]).errors).toEqual([])
  })

  it('imports with warnings when only the finer schema rules are broken', () => {
    const story = JSON.parse(sample.toString())
    story.acts[0].scenes[0].mood = 'stormy'
    const r = readPack([entry('story.json', JSON.stringify(story))])
    expect(r.errors).toEqual([])
    expect(r.story).not.toBeNull()
    expect(r.warnings.join()).toMatch(/additional properties/)
  })
})

describe('zipPack / unzipPack', () => {
  it('round-trips a pack', () => {
    const story = JSON.parse(sample.toString())
    const zip = zipPack(story, [{ path: 'images/map.png', data: png }])
    const back = readPack(unzipPack(zip))
    expect(back.story).toEqual(story)
    expect(back.files.map((f) => [f.path, [...f.data]])).toEqual([['images/map.png', [...png]]])
  })

  it('opens zips made by other tools', () => {
    const zip = zipSync({ 'pack/story.json': sample, 'pack/images/': new Uint8Array(), 'pack/images/a.png': png })
    expect(readPack(unzipPack(zip)).files.map((f) => f.path)).toEqual(['images/a.png'])
  })
})

describe('helpers', () => {
  it('knows common file types and counts scenes', () => {
    expect(mimeOf('a/B.JPG')).toBe('image/jpeg')
    expect(mimeOf('x.bin')).toBe('application/octet-stream')
    expect(packSceneCount(JSON.parse(sample.toString()))).toBe(6)
  })
})

describe('splitPacks', () => {
  it('splits a folder of pack folders, files going to their own story', () => {
    const packs = splitPacks([
      entry('scans/one/story.json', sample), entry('scans/one/images/a.png', png),
      entry('scans/two/story.json', sample), entry('scans/two/images/b.png', png), entry('scans/two/images/c.png', png),
      entry('scans/readme.txt', 'x'),
    ])
    expect(packs.map((p) => [p.name, p.entries.map((e) => e.path)])).toEqual([
      ['one', ['scans/one/story.json', 'scans/one/images/a.png']],
      ['two', ['scans/two/story.json', 'scans/two/images/b.png', 'scans/two/images/c.png']],
    ])
    expect(readPack(packs[1].entries).files.map((f) => f.path)).toEqual(['images/b.png', 'images/c.png'])
  })

  it('keeps a single pack whole, and nested packs apart', () => {
    expect(splitPacks([entry('story.json', sample), entry('images/a.png', png)])).toHaveLength(1)
    const nested = splitPacks([entry('a/story.json', sample), entry('a/extra/story.json', sample), entry('a/extra/x.png', png)])
    expect(nested.map((p) => p.entries.length)).toEqual([1, 2])
  })
})
