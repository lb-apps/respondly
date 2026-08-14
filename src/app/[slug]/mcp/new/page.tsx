import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getOrganizationBySlug } from "@/lib/supabase/queries/organizations"
import { McpServerForm } from "../mcp-server-form"

export default async function NewMcpServerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await headers()
  const org = await getOrganizationBySlug(slug)
  if (!org) notFound()

  return (
    <main className="mx-auto w-full max-w-3xl p-6 lg:p-10">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-1 gap-1.5">
        <Link href={`/${slug}/mcp`}>
          <ArrowLeft className="size-4" /> MCP Sunucuları
        </Link>
      </Button>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sunucu ekle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adresi ve kimlik bilgisini girin; kaydettikten sonra bağlantıyı test
          edip araçları keşfedin.
        </p>
      </header>

      <McpServerForm
        slug={slug}
        organizationId={org.id}
        initial={{
          id: null,
          hasSecret: false,
          name: "",
          slug: "",
          url: "",
          transport: "http",
          authKind: "bearer",
          authHeaderName: "",
          secret: "",
          headers: [],
          queryParams: [],
          timeoutMs: 20000,
          enabled: true,
        }}
      />
    </main>
  )
}
