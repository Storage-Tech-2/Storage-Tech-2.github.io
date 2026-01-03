import { AuthorType, type Author } from "../types"

export function getAuthorName(author: Author): string {
    if (author.type === AuthorType.DiscordInGuild || author.type === AuthorType.DiscordLeftGuild) {
        return author.displayName;
    } else {
        return author.username;
    }
}
