'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'

export function NotificationBell() {
  const [count] = useState(0)

  return (
    <button className="relative p-2 rounded-lg hover:bg-[var(--muted)] transition-colors">
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}