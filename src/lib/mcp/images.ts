/**
 * Industry-agnostic image discovery inside an MCP tool result.
 *
 * Any connected system may return pictures — a room, a dish, a product, a
 * venue. Rather than knowing a vendor's field names, walk the parsed value and
 * collect anything that looks like an image URL. Pure function.
 *
 * URLs only, deliberately. This used to also lift the nearest `title`/`name`
 * field and send it as the photo's caption, which meant four photos of one room
 * arrived with the room's name repeated under each of them — and the reply text
 * then had to be edited to avoid saying it a fifth time. The assistant
 * introduces its own pictures; nothing here needs to label them.
 */

const IMAGE_KEYS = new Set([
  "imageurl",
  "image",
  "imageurls",
  "images",
  "photourl",
  "photo",
  "photos",
  "thumbnail",
  "thumbnailurl",
  "picture",
  "pictureurl",
])

const IMAGE_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|bmp|svg|avif)(?:$|[?#])/i

export interface McpImage {
  url: string
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  if (!/^https?:\/\//i.test(value)) return false
  if (IMAGE_EXT_RE.test(value)) return true
  return value.includes("/storage/v1/object/public/")
}

/**
 * Collect image candidates from a parsed MCP result.
 * Depth-capped and result-capped so a huge payload cannot flood a reply.
 */
export function extractMcpImages(value: unknown, limit = 4): McpImage[] {
  const found: McpImage[] = []
  const seen = new Set<string>()

  const visit = (node: unknown, depth: number, parent: unknown, key: string) => {
    if (found.length >= limit || depth > 6 || node == null) return

    if (typeof node === "string") {
      // Only trust strings that sit under an image-ish key, or that end in an
      // image extension — otherwise a description full of links would leak in.
      if (isImageUrl(node) && (IMAGE_KEYS.has(key.toLowerCase()) || IMAGE_EXT_RE.test(node))) {
        if (seen.has(node)) return
        seen.add(node)
        found.push({ url: node })
      }
      return
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1, parent, key)
      return
    }

    if (typeof node === "object") {
      for (const [childKey, childValue] of Object.entries(
        node as Record<string, unknown>
      )) {
        visit(childValue, depth + 1, node, childKey)
      }
    }
  }

  visit(value, 0, null, "")
  return found
}
