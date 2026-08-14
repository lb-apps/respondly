/** PostgREST error when an RPC has not been deployed yet. */
export function isMissingStockRpcError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST202"
  )
}
