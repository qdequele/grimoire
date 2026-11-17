// Going on with an AI import that stopped half-way (a timeout, a network cut), instead of starting
// a new one that converts, and counts, the first pages a second time.

/** What the Importer page keeps of an interrupted import. */
export interface ImportResume {
  importId: string
  /** Pages converted when it stopped, as the browser saw it. */
  done: number
  /** Pages of the whole import: the selected files, which stay locked until it ends. */
  total: number
  storyId: string | null
  /** The title and language the import started with: every call sends them again. */
  title: string
  lang: 'fr' | 'en'
}

/**
 * The number of pages already converted, where a resumed import goes on. The server's count
 * (`story_imports.page_count`) wins when it saved a batch whose answer never reached the browser:
 * sending that batch again would convert and count it twice.
 */
export function resumeFrom(clientDone: number, serverPages: number | null | undefined, total: number): number {
  return Math.min(total, Math.max(clientDone, serverPages ?? 0))
}

/** The calls to make for the uploaded pages, each with the 1-based position of its first page in the whole import. */
export function importBatches(paths: string[], done: number, perCall: number): Array<{ pagePaths: string[]; firstPage: number }> {
  const batches: Array<{ pagePaths: string[]; firstPage: number }> = []
  for (let i = 0; i < paths.length; i += perCall) batches.push({ pagePaths: paths.slice(i, i + perCall), firstPage: done + i + 1 })
  return batches
}
