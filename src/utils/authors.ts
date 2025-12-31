import { AuthorType, type Author } from "../types"

export function getAuthorName(a: Author) {
  return a.displayName || a.username || a.reason || (a.type === AuthorType.DiscordDeleted ? "Deleted" : "Unknown")
}
