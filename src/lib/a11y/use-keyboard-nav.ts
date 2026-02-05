"use client"

import * as React from "react"

type Direction = "horizontal" | "vertical" | "both"
type WrapMode = "none" | "wrap" | "stop"

interface UseKeyboardNavOptions {
  /** Direction of navigation */
  direction?: Direction
  /** Whether to wrap around when reaching boundaries */
  wrap?: WrapMode
  /** Whether navigation is enabled */
  enabled?: boolean
  /** Callback when active index changes */
  onActiveChange?: (index: number) => void
  /** Selector for navigable items */
  itemSelector?: string
  /** Whether to prevent default on arrow keys */
  preventDefault?: boolean
  /** Enable Home/End key navigation */
  homeEnd?: boolean
  /** Enable type-ahead search */
  typeAhead?: boolean
  /** Timeout for type-ahead search reset (ms) */
  typeAheadTimeout?: number
}

interface UseKeyboardNavReturn {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLElement>
  /** Currently active index */
  activeIndex: number
  /** Set active index programmatically */
  setActiveIndex: (index: number) => void
  /** Focus the currently active item */
  focusActiveItem: () => void
  /** Props to spread on the container */
  containerProps: {
    role: string
    "aria-activedescendant"?: string
    onKeyDown: (event: React.KeyboardEvent) => void
  }
  /** Get props for each item */
  getItemProps: (index: number) => {
    id: string
    role: string
    "aria-selected": boolean
    tabIndex: number
    onFocus: () => void
  }
}

/**
 * Hook to enable arrow key navigation within a list of items.
 * Implements WAI-ARIA keyboard navigation patterns.
 * 
 * @example
 * ```tsx
 * function Menu() {
 *   const { containerProps, getItemProps, activeIndex } = useKeyboardNav({
 *     direction: "vertical",
 *     wrap: "wrap",
 *   });
 *   
 *   return (
 *     <ul {...containerProps}>
 *       {items.map((item, index) => (
 *         <li key={item.id} {...getItemProps(index)}>
 *           {item.label}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useKeyboardNav(
  options: UseKeyboardNavOptions = {}
): UseKeyboardNavReturn {
  const {
    direction = "vertical",
    wrap = "wrap",
    enabled = true,
    onActiveChange,
    itemSelector = "[data-nav-item]",
    preventDefault = true,
    homeEnd = true,
    typeAhead = false,
    typeAheadTimeout = 500,
  } = options

  const containerRef = React.useRef<HTMLElement>(null)
  const [activeIndex, setActiveIndexState] = React.useState(0)
  const typeAheadBuffer = React.useRef("")
  const typeAheadTimer = React.useRef<NodeJS.Timeout>()
  const idPrefix = React.useId()

  const getItems = React.useCallback((): HTMLElement[] => {
    if (!containerRef.current) return []
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(itemSelector))
      .filter((el) => {
        const style = window.getComputedStyle(el)
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-disabled") !== "true"
        )
      })
  }, [itemSelector])

  const setActiveIndex = React.useCallback(
    (index: number) => {
      const items = getItems()
      if (items.length === 0) return

      let newIndex = index

      // Handle wrapping
      if (wrap === "wrap") {
        newIndex = ((index % items.length) + items.length) % items.length
      } else if (wrap === "stop" || wrap === "none") {
        newIndex = Math.max(0, Math.min(index, items.length - 1))
      }

      setActiveIndexState(newIndex)
      onActiveChange?.(newIndex)

      // Focus the new active item
      const item = items[newIndex]
      if (item) {
        item.focus()
      }
    },
    [getItems, wrap, onActiveChange]
  )

  const focusActiveItem = React.useCallback(() => {
    const items = getItems()
    const item = items[activeIndex]
    if (item) {
      item.focus()
    }
  }, [getItems, activeIndex])

  const handleTypeAhead = React.useCallback(
    (char: string) => {
      if (!typeAhead) return false

      // Clear previous timer
      if (typeAheadTimer.current) {
        clearTimeout(typeAheadTimer.current)
      }

      // Add character to buffer
      typeAheadBuffer.current += char.toLowerCase()

      // Find matching item
      const items = getItems()
      const matchIndex = items.findIndex((item) => {
        const text = item.textContent?.toLowerCase() || ""
        return text.startsWith(typeAheadBuffer.current)
      })

      if (matchIndex !== -1) {
        setActiveIndex(matchIndex)
      }

      // Set timer to clear buffer
      typeAheadTimer.current = setTimeout(() => {
        typeAheadBuffer.current = ""
      }, typeAheadTimeout)

      return true
    },
    [typeAhead, getItems, setActiveIndex, typeAheadTimeout]
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled) return

      const items = getItems()
      if (items.length === 0) return

      const isVertical = direction === "vertical" || direction === "both"
      const isHorizontal = direction === "horizontal" || direction === "both"

      let handled = false

      switch (event.key) {
        case "ArrowUp":
          if (isVertical) {
            setActiveIndex(activeIndex - 1)
            handled = true
          }
          break

        case "ArrowDown":
          if (isVertical) {
            setActiveIndex(activeIndex + 1)
            handled = true
          }
          break

        case "ArrowLeft":
          if (isHorizontal) {
            setActiveIndex(activeIndex - 1)
            handled = true
          }
          break

        case "ArrowRight":
          if (isHorizontal) {
            setActiveIndex(activeIndex + 1)
            handled = true
          }
          break

        case "Home":
          if (homeEnd) {
            setActiveIndex(0)
            handled = true
          }
          break

        case "End":
          if (homeEnd) {
            setActiveIndex(items.length - 1)
            handled = true
          }
          break

        default:
          // Handle type-ahead for single printable characters
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            handled = handleTypeAhead(event.key)
          }
      }

      if (handled && preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [enabled, direction, activeIndex, setActiveIndex, homeEnd, handleTypeAhead, preventDefault, getItems]
  )

  // Cleanup type-ahead timer on unmount
  React.useEffect(() => {
    return () => {
      if (typeAheadTimer.current) {
        clearTimeout(typeAheadTimer.current)
      }
    }
  }, [])

  const containerProps = React.useMemo(
    () => ({
      role: "listbox" as const,
      "aria-activedescendant": `${idPrefix}-item-${activeIndex}`,
      onKeyDown: handleKeyDown,
    }),
    [idPrefix, activeIndex, handleKeyDown]
  )

  const getItemProps = React.useCallback(
    (index: number) => ({
      id: `${idPrefix}-item-${index}`,
      role: "option" as const,
      "aria-selected": index === activeIndex,
      tabIndex: index === activeIndex ? 0 : -1,
      "data-nav-item": true,
      onFocus: () => setActiveIndexState(index),
    }),
    [idPrefix, activeIndex]
  )

  return {
    containerRef: containerRef as React.RefObject<HTMLElement>,
    activeIndex,
    setActiveIndex,
    focusActiveItem,
    containerProps,
    getItemProps,
  }
}

/**
 * Hook for roving tabindex pattern.
 * Only one item in the group is focusable at a time.
 */
export function useRovingTabIndex(
  itemCount: number,
  options: {
    initialIndex?: number
    vertical?: boolean
    loop?: boolean
  } = {}
) {
  const { initialIndex = 0, vertical = true, loop = true } = options
  const [focusedIndex, setFocusedIndex] = React.useState(initialIndex)

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const prevKey = vertical ? "ArrowUp" : "ArrowLeft"
      const nextKey = vertical ? "ArrowDown" : "ArrowRight"

      let newIndex = index

      if (event.key === prevKey) {
        newIndex = index - 1
        if (newIndex < 0) {
          newIndex = loop ? itemCount - 1 : 0
        }
        event.preventDefault()
      } else if (event.key === nextKey) {
        newIndex = index + 1
        if (newIndex >= itemCount) {
          newIndex = loop ? 0 : itemCount - 1
        }
        event.preventDefault()
      } else if (event.key === "Home") {
        newIndex = 0
        event.preventDefault()
      } else if (event.key === "End") {
        newIndex = itemCount - 1
        event.preventDefault()
      }

      if (newIndex !== index) {
        setFocusedIndex(newIndex)
      }

      return newIndex
    },
    [itemCount, vertical, loop]
  )

  const getTabIndex = (index: number) => (index === focusedIndex ? 0 : -1)

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getTabIndex,
  }
}
