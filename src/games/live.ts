// Small pure pieces of the game screen's live updates (GamePage.tsx).

/**
 * What the game page shows. Once the game has started it stays on screen: the game is refetched
 * in the background (window focus, a revoked link), and a refetch that fails, or comes back without
 * the story, must not take the running game away from the table.
 */
export function gameView(s: { error: boolean; noStory: boolean; started: boolean; ready: boolean }): 'missing' | 'no-story' | 'loading' | 'play' {
  if (!s.started && s.error) return 'missing'
  if (!s.started && s.noStory) return 'no-story'
  return s.ready ? 'play' : 'loading'
}

/**
 * Calls for the engine, which appears in the iframe once its script has run: `run` calls now when
 * the engine is there and nothing waits, else queues. The queue is emptied, in order, as soon as the
 * engine is there, whenever that is (also after it went away and came back).
 */
export function engineQueue<E>(engine: () => E | undefined, pollMs: number, onError: (error: unknown) => void) {
  const queue: Array<(e: E) => void> = []
  let poll: ReturnType<typeof setInterval> | undefined
  let stopped = false
  const call = (fn: (e: E) => void, e: E) => {
    try {
      fn(e)
    } catch (error) {
      onError(error)
    }
  }
  const rest = () => {
    clearInterval(poll)
    poll = undefined
  }
  const drain = () => {
    const e = engine()
    if (!e) return
    rest()
    for (const fn of queue.splice(0)) call(fn, e)
  }
  return {
    run(fn: (e: E) => void) {
      if (stopped) return
      const e = engine()
      if (e && !queue.length) return call(fn, e)
      queue.push(fn)
      poll ??= setInterval(drain, pollMs)
    },
    stop() {
      stopped = true
      queue.length = 0
      rest()
    },
  }
}

/**
 * Runs async reads one at a time, in the order they were asked for, so the answer of an early, slow
 * read can't land after a later one's. A read that fails is reported and the next ones still run.
 */
export function inOrder(onError: (error: unknown) => void): (task: () => Promise<void>) => void {
  let chain: Promise<void> = Promise.resolve()
  return (task) => {
    chain = chain.then(task).catch(onError)
  }
}
