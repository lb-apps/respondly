import { z } from "zod"

/**
 * Single source of truth for the MCP server form — imported by the client form
 * (react-hook-form resolver) and by the server action (trusted re-validation).
 */

export const KEY_VALUE_KEY = /^[A-Za-z0-9_.-]+$/

const keyValueRow = z.object({
  key: z.string().trim(),
  value: z.string().trim(),
})

const mcpServerBaseSchema = z.object({
  name: z.string().trim().min(1, "Ad gerekli").max(80, "En fazla 80 karakter"),
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9_]{2,32}$/,
      "2-32 karakter; sadece küçük harf, rakam ve alt çizgi"
    ),
  url: z.string().trim().min(1, "Adres gerekli").max(2048),
  transport: z.enum(["http", "sse"]),
  authKind: z.enum(["none", "bearer", "header"]),
  authHeaderName: z.string().trim().max(64).optional().or(z.literal("")),
  /** Blank on an existing server means "keep the stored secret". */
  secret: z.string().max(4096).optional().or(z.literal("")),
  headers: z.array(keyValueRow).max(20),
  queryParams: z.array(keyValueRow).max(20),
  timeoutMs: z
    .number("Sayı girin")
    .int()
    .min(1000, "En az 1000 ms")
    .max(120000, "En fazla 120000 ms"),
  enabled: z.boolean(),
})

/** Cross-field rules shared by the form and the action. */
function refineMcpServer<T extends z.ZodType<z.infer<typeof mcpServerBaseSchema>>>(
  schema: T
) {
  return schema.superRefine((value, ctx) => {
    if (value.authKind === "header" && !value.authHeaderName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["authHeaderName"],
        message: "Başlık adı gerekli",
      })
    }
    for (const [index, row] of value.headers.entries()) {
      if (row.key && !KEY_VALUE_KEY.test(row.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["headers", index, "key"],
          message: "Geçersiz başlık adı",
        })
      }
    }
  })
}

export const mcpServerFormSchema = refineMcpServer(mcpServerBaseSchema)

export type McpServerFormValues = z.infer<typeof mcpServerBaseSchema>

export const saveMcpServerSchema = refineMcpServer(
  mcpServerBaseSchema.extend({
    organizationId: z.string().uuid(),
    serverId: z.string().uuid().nullable(),
    slugPath: z.string().min(1),
  })
)

export type SaveMcpServerInput = z.input<typeof saveMcpServerSchema>

export const MCP_TRANSPORT_LABELS: Record<string, string> = {
  http: "Streamable HTTP",
  sse: "SSE (eski)",
}

export const MCP_AUTH_LABELS: Record<string, string> = {
  none: "Yok",
  bearer: "Bearer token",
  header: "Özel başlık",
}

export const MCP_STATUS_LABELS: Record<string, string> = {
  connected: "Bağlı",
  disconnected: "Test edilmedi",
  error: "Hata",
}

export const MCP_STATUS_VARIANTS: Record<
  string,
  "secondary" | "outline" | "destructive"
> = {
  connected: "secondary",
  disconnected: "outline",
  error: "destructive",
}

/** Turn form rows into the JSON object shape the DB stores. */
export function rowsToRecord(
  rows: Array<{ key: string; value: string }>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (key) out[key] = row.value
  }
  return out
}

/** And back again, for editing. */
export function recordToRows(
  value: unknown
): Array<{ key: string; value: string }> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return []
  }
  return Object.entries(value as Record<string, unknown>).map(([key, raw]) => ({
    key,
    value: typeof raw === "string" ? raw : String(raw ?? ""),
  }))
}
