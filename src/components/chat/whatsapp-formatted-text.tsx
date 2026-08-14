"use client"

import { Fragment, useMemo } from "react"

import {
  parseWhatsAppMessage,
  type BlockNode,
  type InlineNode,
} from "@/lib/whatsapp/format-text"
import { cn } from "@/lib/utils"

const MONO_CLASS =
  "rounded bg-muted px-1 py-px font-mono text-[0.92em] text-foreground"

function renderInline(nodes: InlineNode[], keyPrefix: string) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`

    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.value}</Fragment>
      case "bold":
        return (
          <strong key={key} className="font-semibold">
            {renderInline(node.children, key)}
          </strong>
        )
      case "italic":
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        )
      case "strike":
        return (
          <s key={key} className="line-through">
            {renderInline(node.children, key)}
          </s>
        )
      case "inlineCode":
        return (
          <code key={key} className={MONO_CLASS}>
            {node.value}
          </code>
        )
      case "monospace":
        return (
          <code key={key} className={MONO_CLASS}>
            {node.value}
          </code>
        )
      default:
        return null
    }
  })
}

function renderBlock(block: BlockNode, index: number) {
  const key = `block-${index}`

  switch (block.type) {
    case "blank":
      return <div key={key} className="h-3" aria-hidden />
    case "paragraph":
      return (
        <p key={key} className="whitespace-pre-wrap">
          {renderInline(block.children, key)}
        </p>
      )
    case "bullet":
      return (
        <div key={key} className="flex gap-2 whitespace-pre-wrap">
          <span className="shrink-0 select-none" aria-hidden>
            {block.marker === "-" ? "–" : "•"}
          </span>
          <span className="min-w-0 flex-1">{renderInline(block.children, key)}</span>
        </div>
      )
    case "numbered":
      return (
        <div key={key} className="flex gap-2 whitespace-pre-wrap">
          <span className="shrink-0 tabular-nums" aria-hidden>
            {block.index}.
          </span>
          <span className="min-w-0 flex-1">{renderInline(block.children, key)}</span>
        </div>
      )
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-[3px] border-primary/40 py-0.5 pl-3 text-foreground/90"
        >
          <span className="whitespace-pre-wrap">
            {renderInline(block.children, key)}
          </span>
        </blockquote>
      )
    case "monospaceBlock":
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded-xl bg-muted px-2.5 py-2 font-mono text-[0.92em] whitespace-pre-wrap text-foreground"
        >
          {block.value}
        </pre>
      )
    default:
      return null
  }
}

export function WhatsAppFormattedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const blocks = useMemo(() => parseWhatsAppMessage(text), [text])
  if (!text.trim()) return null

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 break-words [overflow-wrap:anywhere]", className)}>
      {blocks.map(renderBlock)}
    </div>
  )
}
