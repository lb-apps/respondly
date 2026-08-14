"use client"

import * as React from "react"
import { NumericFormat, type NumericFormatProps } from "react-number-format"
import { cn } from "@/lib/utils"

export interface QuantityInputProps
  extends Omit<NumericFormatProps, "value" | "onValueChange"> {
  value: string | number
  onValueChange: (value: string) => void
  className?: string
}

const QuantityInput = React.forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    return (
      <NumericFormat
        getInputRef={ref}
        data-slot="input-group-control"
        value={value}
        onValueChange={(values) => {
          onValueChange(values.value)
        }}
        thousandSeparator="."
        decimalSeparator=","
        allowNegative={false}
        placeholder="0"
        className={cn(
          "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-base transition-[color,box-shadow] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  }
)
QuantityInput.displayName = "QuantityInput"

export { QuantityInput }
