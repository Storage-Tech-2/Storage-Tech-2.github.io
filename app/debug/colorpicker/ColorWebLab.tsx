"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { clsx } from "@/lib/utils/classNames";
import type { GlobalTag, Tag } from "@/lib/types";
import { TagPill, TagChip } from "@/components/ui/Tags";

type ThemeMode = "light" | "dark";

const DEFAULT_COLOR = "#29b0ff";

const PRESETS: Array<{ name: string; emoji?: string; color: string }> = [
  { name: "Untested", emoji: "⁉️", color: "#fcd34d" },
  { name: "Broken", emoji: "💔", color: "#ff6969" },
  { name: "Tested & Functional", emoji: "✅", color: "#34d399" },
  { name: "Recommended", emoji: "⭐", color: "#29b0ff" },
];

function buildTagStyle(color?: string): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    "--tag-color": color,
    "--tag-bg-light": `color-mix(in lab, ${color} 12%, white)`,
    "--tag-bg-dark": `color-mix(in lab, ${color} 18%, black)`,
    "--tag-text-light": `color-mix(in srgb, ${color} 40%, black)`,
    "--tag-text-dark": `color-mix(in srgb, ${color} 65%, white)`,
  } as CSSProperties;
}

function normalizeColorInput(value: string): string | null {
  const trimmed = value.trim();
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(trimmed)) {
    if (trimmed.length === 4) {
      const expanded = trimmed
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("");
      return `#${expanded.toLowerCase()}`;
    }
    return trimmed.toLowerCase();
  }
  return null;
}

function ForcedTagPill({ mode, name, emoji, color }: { mode: ThemeMode; name: string; emoji?: string; color: string }) {
  const baseStyle = buildTagStyle(color);
  const style = {
    ...(baseStyle ?? {}),
    borderColor: mode === "dark" ? "#374151" : "#e5e7eb",
  } as CSSProperties;
  const base = "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold leading-none whitespace-nowrap";
  const cls =
    mode === "dark"
      ? "text-[color:var(--tag-text-dark)] bg-[var(--tag-bg-dark)] border-gray-700"
      : "text-[color:var(--tag-text-light)] bg-[var(--tag-bg-light)] border-gray-200";
  return (
    <span className={clsx(base, cls)} style={style}>
      {emoji ? <span className="text-[12px]">{emoji}</span> : null}
      <span>{name}</span>
    </span>
  );
}

function ForcedTagChip({
  mode,
  name,
  emoji,
  color,
  state,
}: {
  mode: ThemeMode;
  name: string;
  emoji?: string;
  color: string;
  state: -1 | 0 | 1;
}) {
  const baseStyle = buildTagStyle(color);
  const style = {
    ...(baseStyle ?? {}),
    borderColor: mode === "dark" ? "#374151" : "#e5e7eb",
  } as CSSProperties;
  const base = "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)]";

  let cls: string;
  if (state === -1) {
    cls = "bg-red-600 text-white shadow-sm";
  } else if (state === 1) {
    cls = "text-[color:var(--tag-text-light)] bg-[var(--tag-color)] shadow-sm";
  } else {
    cls =
      mode === "dark"
        ? "text-[color:var(--tag-text-dark)] bg-[var(--tag-bg-dark)]"
        : "text-[color:var(--tag-text-light)] bg-[var(--tag-bg-light)]";
  }

  return (
    <span className={clsx(base, cls)} style={style} title={state === -1 ? "Excluded" : state === 1 ? "Included" : "Neutral"}>
      {emoji ? <span className="text-[12px]">{emoji}</span> : null}
      <span>{name}</span>
      {state === 1 ? (
        <span className={clsx("rounded px-1 text-[10px]", mode === "dark" ? "bg-white/10 text-white/80" : "bg-black/10 text-black/70")}>ON</span>
      ) : null}
      {state === -1 ? <span className="rounded bg-black/10 px-1 text-[10px] text-white/90">OFF</span> : null}
    </span>
  );
}

function ColorVariable({
  label,
  swatch,
  description,
  style,
}: {
  label: string;
  swatch: string;
  description: string;
  style: CSSProperties | undefined;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 text-sm shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/70" style={style}>
      <div className="h-10 w-10 rounded-lg border border-gray-200 shadow-sm dark:border-gray-700" style={{ background: swatch }} />
      <div className="flex flex-col leading-tight">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
        <span className="text-xs text-gray-600 dark:text-gray-300">{description}</span>
        <code className="mt-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-100">{swatch}</code>
      </div>
    </div>
  );
}

function PreviewPanel({ mode, tagName, emoji, color }: { mode: ThemeMode; tagName: string; emoji?: string; color: string }) {
  const style = buildTagStyle(color);
  const surface =
    mode === "dark"
      ? "bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white"
      : "bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900";
  const panelStyle: CSSProperties = {
    ...(style ?? {}),
    borderColor: mode === "dark" ? "#374151" : "#e5e7eb",
  };
  const labelColor = mode === "dark" ? "text-sky-300" : "text-sky-700";
  const subtitleColor = mode === "dark" ? "text-gray-200" : "text-gray-700";
  const mutedColor = mode === "dark" ? "text-gray-400" : "text-gray-500";

  return (
    <div className={clsx("rounded-2xl border p-4 shadow-sm", surface)} style={panelStyle}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className={clsx("text-[11px] font-semibold uppercase tracking-wide", labelColor)}>{mode === "dark" ? "Dark surface" : "Light surface"}</div>
          <div className={clsx("text-sm", subtitleColor)}>Forced preview (ignores system theme)</div>
        </div>
        <div className={clsx("text-xs", mutedColor)}>colorWeb → tag style</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ForcedTagPill mode={mode} name={tagName} emoji={emoji} color={color} />
        <span className={clsx("text-[11px] uppercase tracking-wide", mutedColor)}>Filter states</span>
        <ForcedTagChip mode={mode} name={tagName} emoji={emoji} color={color} state={1} />
        <ForcedTagChip mode={mode} name={tagName} emoji={emoji} color={color} state={0} />
        <ForcedTagChip mode={mode} name={tagName} emoji={emoji} color={color} state={-1} />
      </div>

      <p className={clsx("mt-3 text-xs", mode === "dark" ? "text-gray-300" : "text-gray-600")}>
        Matches the TagChip / TagPill color math: background blends use <code>color-mix</code> with {mode === "dark" ? "18% black" : "12% white"} and text is mixed toward {mode === "dark" ? "white" : "black"}.
      </p>
    </div>
  );
}

export function TagColorLab() {
  const [tagName, setTagName] = useState("Recommended");
  const [emoji, setEmoji] = useState("⭐");
  const [rawColor, setRawColor] = useState(DEFAULT_COLOR);

  const normalizedColor = useMemo(() => normalizeColorInput(rawColor), [rawColor]);
  const colorForPreview = normalizedColor ?? DEFAULT_COLOR;
  const usingFallback = !normalizedColor && rawColor.trim().length > 0 && rawColor.trim() !== DEFAULT_COLOR;

  const tag: Tag = useMemo(
    () => ({
      id: "preview-tag",
      name: tagName.trim() || "Sample Tag",
    }),
    [tagName],
  );

  const globalTags = useMemo<GlobalTag[]>(
    () => [
      {
        name: tag.name,
        emoji: emoji.trim() ? emoji.trim() : undefined,
        colorWeb: colorForPreview,
      },
    ],
    [emoji, colorForPreview, tag.name],
  );

  const variableStyle = buildTagStyle(colorForPreview);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(41,176,255,0.16),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(52,211,153,0.15),transparent_40%)]" />
        <div className="relative space-y-4">
          <div>
            <div className="text-sm font-semibold text-sky-800 dark:text-sky-300">Set up your tag</div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Pick a name, emoji, and <code>colorWeb</code> to mirror the archive&apos;s global tag styling.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.3fr,0.7fr] md:items-end">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-800 dark:text-gray-100">
              Tag name
              <input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-700 dark:bg-gray-950"
                placeholder="Recommended"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-800 dark:text-gray-100">
              Emoji (optional)
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-700 dark:bg-gray-950"
                placeholder="⭐"
                maxLength={4}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950/70">
              <input
                aria-label="Pick colorWeb"
                type="color"
                value={colorForPreview}
                onChange={(e) => setRawColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-0 shadow-sm dark:border-gray-700"
              />
              <div className="flex flex-1 flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">colorWeb</span>
                <input
                  value={rawColor}
                  onChange={(e) => setRawColor(e.target.value)}
                  placeholder="#29b0ff"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-700 dark:bg-gray-900"
                  spellCheck={false}
                />
              </div>
              <div className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Normalized</span>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-100">{colorForPreview}</code>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setTagName(preset.name);
                    setEmoji(preset.emoji ?? "");
                    setRawColor(preset.color);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:-translate-y-px hover:shadow-md dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                >
                  {preset.emoji ? `${preset.emoji} ` : ""}
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {usingFallback ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              That value isn&apos;t a valid hex color. Showing the default ({DEFAULT_COLOR}) instead so the preview still works.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <ColorVariable label="--tag-color" swatch="var(--tag-color)" description="Exact colorWeb value" style={variableStyle} />
            <ColorVariable label="--tag-bg-light" swatch="var(--tag-bg-light)" description="Background on light surfaces (12% toward white)" style={variableStyle} />
            <ColorVariable label="--tag-bg-dark" swatch="var(--tag-bg-dark)" description="Background on dark surfaces (18% toward black)" style={variableStyle} />
            <ColorVariable label="--tag-text" swatch="linear-gradient(90deg, var(--tag-text-light), var(--tag-text-dark))" description="Text mixes: 40% toward black (light) / 65% toward white (dark)" style={variableStyle} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PreviewPanel mode="light" tagName={tag.name} emoji={emoji} color={colorForPreview} />
        <PreviewPanel mode="dark" tagName={tag.name} emoji={emoji} color={colorForPreview} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/90">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Live components (system theme)</div>
        <div className="mt-3 flex flex-wrap items-center gap-2" style={variableStyle}>
          <TagPill name={tag.name} globalTags={globalTags} />
          <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Filter states</span>
          <TagChip tag={tag} state={1} globalTags={globalTags} />
          <TagChip tag={tag} state={0} globalTags={globalTags} />
          <TagChip tag={tag} state={-1} globalTags={globalTags} />
        </div>
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          These are the exact <code>TagChip</code> / <code>TagPill</code> components used on the site and will follow your current system theme.
        </p>
      </div>
    </div>
  );
}
