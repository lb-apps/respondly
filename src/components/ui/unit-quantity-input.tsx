"use client"

import * as React from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group"
import { QuantityInput, type QuantityInputProps } from "@/components/ui/quantity-input"
import { cn } from "@/lib/utils"

const innerInputClasses =
  "rounded-none border-0 shadow-none focus-visible:ring-0 dark:bg-transparent flex-1 min-w-0 tabular-nums"

export interface UnitQuantityInputProps extends Omit<QuantityInputProps, "className"> {
  /** Trailing unit abbreviation (e.g. ml, kg). Addon omitted when empty after trim. */
  unitLabel?: string | null
  /** Shown in the trailing addon when `unitLabel` is empty (e.g. "Birim"). */
  unitFallback?: string
  /** `InputGroup` layout classes (e.g. height). */
  className?: string
  /** Passed to the inner `QuantityInput`. */
  inputClassName?: string
}

const UnitQuantityInput = React.forwardRef<HTMLInputElement, UnitQuantityInputProps>(
  (
    {
      className,
      inputClassName,
      unitLabel,
      unitFallback,
      disabled,
      ...quantityProps
    },
    ref
  ) => {
    const trimmedLabel = unitLabel?.trim() ?? ""
    const trimmedFallback = unitFallback?.trim() ?? ""
    const addonText = trimmedLabel || trimmedFallback
    const showAddon = addonText.length > 0

    return (
      <InputGroup
        data-disabled={disabled ? true : undefined}
        className={cn("min-w-0", className)}
      >
        <QuantityInput
          ref={ref}
          disabled={disabled}
          className={cn(innerInputClasses, inputClassName)}
          {...quantityProps}
        />
        {showAddon ? (
          <InputGroupAddon align="inline-end">
            <InputGroupText className="tabular-nums">{addonText}</InputGroupText>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    )
  }
)
UnitQuantityInput.displayName = "UnitQuantityInput"

export { UnitQuantityInput }
