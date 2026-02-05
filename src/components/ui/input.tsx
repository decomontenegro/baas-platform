import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Error message to display. When provided, sets aria-invalid="true".
   */
  error?: string
  /**
   * Hint text for additional context about the input.
   */
  hint?: string
  /**
   * Label for the input. If provided as string, renders a visible label.
   * For invisible labels, use aria-label instead.
   */
  label?: string
  /**
   * Position of the label relative to the input.
   */
  labelPosition?: "above" | "left" | "hidden"
  /**
   * Whether the input is required.
   */
  required?: boolean
  /**
   * Container className for the wrapper div.
   */
  containerClassName?: string
}

/**
 * Accessible Input component with built-in label, hint, and error support.
 * 
 * @example
 * ```tsx
 * // With visible label
 * <Input label="Email" type="email" required />
 * 
 * // With error
 * <Input label="Password" error="Password must be at least 8 characters" />
 * 
 * // With hint
 * <Input label="Username" hint="Letters, numbers, and underscores only" />
 * 
 * // Hidden label (for search inputs, etc.)
 * <Input label="Search" labelPosition="hidden" placeholder="Search..." />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type, 
    error, 
    hint,
    label,
    labelPosition = "above",
    required,
    containerClassName,
    id: providedId,
    "aria-describedby": ariaDescribedBy,
    ...props 
  }, ref) => {
    // Generate unique IDs for accessibility relationships
    const generatedId = React.useId()
    const inputId = providedId || generatedId
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`
    
    // Build aria-describedby value
    const describedByParts: string[] = []
    if (ariaDescribedBy) describedByParts.push(ariaDescribedBy)
    if (error) describedByParts.push(errorId)
    if (hint && !error) describedByParts.push(hintId)
    const describedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined

    const inputElement = (
      <input
        type={type}
        id={inputId}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        required={required}
        {...props}
      />
    )

    // If no label, return just the input
    if (!label) {
      return inputElement
    }

    // Hidden label uses sr-only class
    const labelElement = (
      <label
        htmlFor={inputId}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          labelPosition === "hidden" && "sr-only",
          labelPosition === "left" && "shrink-0"
        )}
      >
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
    )

    // Error message element
    const errorElement = error && (
      <p
        id={errorId}
        className="text-sm font-medium text-destructive"
        role="alert"
        aria-live="polite"
      >
        {error}
      </p>
    )

    // Hint element (only shown when there's no error)
    const hintElement = hint && !error && (
      <p
        id={hintId}
        className="text-sm text-muted-foreground"
      >
        {hint}
      </p>
    )

    // Render based on label position
    if (labelPosition === "left") {
      return (
        <div className={cn("flex items-center gap-3", containerClassName)}>
          {labelElement}
          <div className="flex-1 space-y-1">
            {inputElement}
            {errorElement}
            {hintElement}
          </div>
        </div>
      )
    }

    return (
      <div className={cn("space-y-2", containerClassName)}>
        {labelElement}
        {inputElement}
        {errorElement}
        {hintElement}
      </div>
    )
  }
)
Input.displayName = "Input"

/**
 * Simple input without label management.
 * Use when you need to manage labels externally.
 */
const BaseInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean
  }
>(({ className, error, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive focus-visible:ring-destructive",
        className
      )}
      ref={ref}
      aria-invalid={error || undefined}
      {...props}
    />
  )
})
BaseInput.displayName = "BaseInput"

export { Input, BaseInput }
