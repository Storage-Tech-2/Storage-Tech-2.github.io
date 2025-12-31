import React from "react"
import { type ChannelRef, type Tag } from "../types"
import { clsx, normalize } from "../utils"
import { TagChip } from "./ArchiveUI"

type Props = {
  channels: ChannelRef[]
  selectedChannels: string[]
  channelCounts: Record<string, number>
  onToggleChannel: (code: string) => void
  tagMode: "OR" | "AND"
  onTagModeChange: (mode: "OR" | "AND") => void
  allTags: Tag[]
  tagState: Record<string, -1 | 0 | 1>
  onToggleTag: (name: string) => void
  tagCounts: Record<string, number>
}

export function ArchiveFilters({
  channels,
  selectedChannels,
  channelCounts,
  onToggleChannel,
  tagMode,
  onTagModeChange,
  allTags,
  tagState,
  onToggleTag,
  tagCounts,
}: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Channels</span>
          <div className="flex flex-wrap gap-2">
            {channels.map(ch => (
              <label key={ch.code} title={ch.description} className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs cursor-pointer", selectedChannels.includes(ch.code) ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black" : "")}>
                <input type="checkbox" className="hidden" checked={selectedChannels.includes(ch.code)} onChange={() => onToggleChannel(ch.code)} />
                <span className="font-semibold">{ch.code}</span>
                <span className={selectedChannels.includes(ch.code) ? "text-white dark:text-black" : "text-gray-500 dark:text-white"}>{ch.name}</span>
                <span className="ml-1 rounded bg-black/10 px-1 text-[10px] dark:bg-white/10">{channelCounts[ch.code] || 0}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Tags</span>
          <div className="inline-flex items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="tagMode" value="AND" checked={tagMode === "AND"} onChange={() => onTagModeChange("AND")} />
              <span>Match all</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" name="tagMode" value="OR" checked={tagMode === "OR"} onChange={() => onTagModeChange("OR")} />
              <span>Match any</span>
            </label>
            <span className="text-gray-500">Tip: click tag twice to exclude</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {allTags.map(tag => (
            <TagChip key={tag.id} tag={tag} state={tagState[tag.name] || 0} count={tagCounts[normalize(tag.name)] || 0} onToggle={() => onToggleTag(tag.name)} />
          ))}
        </div>
      </div>
    </div>
  )
}
