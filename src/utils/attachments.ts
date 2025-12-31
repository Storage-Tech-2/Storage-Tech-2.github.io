import { type Attachment } from "../types"

export function replaceAttachmentsInText(text: string, attachments: Attachment[]): string {
  let finalText = text
  const urls = text.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g)
  if (urls) {
    urls.forEach(url => {
      let match = null
      if (url.startsWith("https://www.mediafire.com/file/") || url.startsWith("https://www.mediafire.com/folder/")) {
        const id = url.split("/")[4]
        match = attachments.find(attachment => attachment.id === id)
      } else if (url.startsWith("https://youtu.be/") || url.startsWith("https://www.youtube.com/watch")) {
        const videoId = new URL(url).searchParams.get("v") || url.split("/").pop()
        if (!videoId) return
        match = attachments.find(attachment => attachment.id === videoId)
      } else if (url.startsWith("https://cdn.discordapp.com/attachments/")) {
        const id = url.split("/")[5]
        match = attachments.find(attachment => attachment.id === id)
      } else if (url.startsWith("https://bilibili.com/") || url.startsWith("https://www.bilibili.com/")) {
        const urlObj = new URL(url)
        const videoId = urlObj.pathname.split("/")[2] || urlObj.searchParams.get("bvid")
        if (!videoId) return
        match = attachments.find(attachment => attachment.id === videoId)
      }

      if (!match) return

      const finalTextSplit = finalText.split(url)
      if (finalTextSplit.length > 1) {
        const finalTextReplaced = [finalTextSplit[0]]
        for (let j = 1; j < finalTextSplit.length; j++) {
          if (finalTextSplit[j - 1].endsWith("](") && finalTextSplit[j].startsWith(")")) {
            finalTextReplaced.push(match.canDownload ? match.path : url)
          } else {
            finalTextReplaced.push(`[${match.name || "Attachment"}](${match.canDownload ? match.path : url})`)
          }
          finalTextReplaced.push(finalTextSplit[j])
        }

        finalText = finalTextReplaced.join("")
      }
    })
  }
  return finalText
}
