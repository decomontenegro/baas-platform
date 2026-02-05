import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Aria label for icon-only buttons.
   * Required when size="icon" and no visible text is provided.
   */
  "aria-label"?: string
  /**
   * Loading state indicator.
   * When true, disables the button and shows loading state.
   */
  loading?: boolean
  /**
   * ID of the element that describes this button.
   * Useful for additional context.
   */
  "aria-describedby"?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    disabled,
    loading = false,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading
    
    // Warn in development if icon button lacks aria-label
    if (process.env.NODE_ENV === "development" && size === "icon" && !ariaLabel && !props["aria-labelledby"]) {
      console.warn(
        "Button with size='icon' should have an aria-label or aria-labelledby for accessibility."
      )
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <span className="sr-only">Carregando</span>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {typeof children === "string" ? children : null}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

/**
 * Icon-only button with required accessibility label.
 * Use this when you need a button with only an icon.
 */
interface IconButtonProps extends Omit<ButtonProps, "size" | "aria-label"> {
  /** Required accessible label for the icon button */
  label: string
  /** Icon to display */
  icon: React.ReactNode
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon"
        aria-label={label}
        className={className}
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </Button>
    )
  }
)
IconButton.displayName = "IconButton"

export { Button, IconButton, buttonVariants }
