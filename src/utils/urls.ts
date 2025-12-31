import { DEFAULT_BRANCH, DEFAULT_OWNER, DEFAULT_REPO } from "../types"

// Build a RAW GitHub URL for a repo path
export function getRawURL(owner: string, repo: string, branch: string, path: string) {
  const safe = encodeURI(path.replace(/^\/+/, ""))
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${safe}`
}

// Safe path join for channel, entry, and relative asset paths
export function assetURL(
  channelPath: string,
  entryPath: string,
  rel: string,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
) {
  const joined = [channelPath, entryPath, rel]
    .join("/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
  return getRawURL(owner, repo, branch, joined)
}
