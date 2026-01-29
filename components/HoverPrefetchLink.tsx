'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

type HoverPrefetchLinkProps = ComponentPropsWithoutRef<typeof Link>

export function HoverPrefetchLink({
  onMouseEnter,
  onFocus,
  ...props
}: HoverPrefetchLinkProps) {
  const [active, setActive] = useState(false)
  const resolvedPrefetch = active ? null : false

  return (
    <Link
      {...props}
      prefetch={resolvedPrefetch}
      onMouseEnter={(event) => {
        setActive(true)
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        setActive(true)
        onFocus?.(event)
      }}
    />
  )
}
