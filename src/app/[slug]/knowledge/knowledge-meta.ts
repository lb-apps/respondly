import type { Icon } from "@tabler/icons-react"
import {
  IconBookFilled,
  IconFileCodeFilled,
  IconFileDescriptionFilled,
  IconFileTextFilled,
  IconFileTypographyFilled,
  IconFolderFilled,
  IconPhotoFilled,
  IconWorldFilled,
} from "@tabler/icons-react"
import { KNOWLEDGE_LIBRARY_LABEL } from "@/lib/knowledge/constants"
import type { FolderOption } from "@/lib/supabase/queries/knowledge"

export { formatBytes } from "@/lib/knowledge/quota"

export { IconFolderFilled as folderTypeIcon }

/** Filled Tabler icon for a source row (kind / file extension). */
export function sourceTypeIcon(kind: string, ext: string | null): Icon {
  if (kind === "link") return IconWorldFilled
  if (kind === "text") return IconFileTypographyFilled
  switch ((ext ?? "").toLowerCase()) {
    case "html":
      return IconFileCodeFilled
    case "epub":
      return IconBookFilled
    case "docx":
      return IconFileDescriptionFilled
    default:
      return IconFileTextFilled
  }
}

/** Filled icons for the type facet filter (matches row glyphs). */
export const sourceTypeFacetIcons = {
  file: IconFileTextFilled,
  link: IconWorldFilled,
  text: IconFileTypographyFilled,
  image: IconPhotoFilled,
} as const satisfies Record<string, Icon>

/** Turkish label for a source kind. */
export function kindLabel(kind: string, ext: string | null): string {
  if (kind === "link") return "Bağlantı"
  if (kind === "text") return "Metin"
  if (kind === "image") return "Görsel"
  return (ext ?? "Dosya").toUpperCase()
}

/** Detail panel right column heading by source kind. */
export function contentSectionTitle(kind: string): string {
  if (kind === "link") return "URL içeriği"
  if (kind === "text") return "Metin içeriği"
  return "Dosya içeriği"
}

/** "1 öğe" / "N öğe" sub-line for folder rows. */
export function itemCountLabel(n: number): string {
  return `${n} öğe`
}

/**
 * Build a "/"-joined path label for a folder (root-first), e.g. "A / B / C".
 * Used in parent-folder Select options + the detail breadcrumb.
 */
export function folderPath(
  folders: FolderOption[],
  folderId: string | null,
  rootLabel: string = KNOWLEDGE_LIBRARY_LABEL
): string {
  if (!folderId) return rootLabel
  const byId = new Map(folders.map((f) => [f.id, f]))
  const parts: string[] = []
  let cur = byId.get(folderId)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    parts.unshift(cur.name)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return parts.length ? parts.join(" / ") : rootLabel
}
