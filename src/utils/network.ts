import { getRawURL } from "./urls"
import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "../types"

export async function fetchJSONRaw(path: string, owner = DEFAULT_OWNER, repo = DEFAULT_REPO, branch = DEFAULT_BRANCH) {
  const url = getRawURL(owner, repo, branch, path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json()
}

// Simple pool to limit concurrent fetches
export async function asyncPool<T, R>(limit: number, items: T[], fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  const workers: Promise<void>[] = []
  async function work() {
    while (i < items.length) {
      const cur = i++
      results[cur] = await fn(items[cur], cur)
    }
  }
  for (let k = 0; k < Math.max(1, Math.min(limit, items.length)); k++) workers.push(work())
  await Promise.allSettled(workers)
  return results
}
