"use client"
import Link from "next/link"
import { type ForesightRegisterOptions } from "js.foresight"
import useForesight from "../hooks/useForesight"
import { useRouter } from "next/navigation"
import { ComponentPropsWithoutRef } from "react"

interface ForesightLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "prefetch">, Omit<ForesightRegisterOptions, "element" | "callback"> {
  children: React.ReactNode,
  onPrefetch?: () => void | boolean,
  className?: string
}

export function ForesightPrefetchLink({ children, className, onPrefetch, ...props }: ForesightLinkProps) {
  const router = useRouter() // import from "next/navigation" not "next/router"
  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      if (onPrefetch) {
        const shouldPrefetch = onPrefetch();
        if (shouldPrefetch === false) {
          return;
        }
      }
      router.prefetch(props.href.toString())
    },
    hitSlop: props.hitSlop,
    name: props.name,
    meta: props.meta,
    reactivateAfter: props.reactivateAfter,
  })

  return (
    <Link {...props} ref={elementRef} className={className} prefetch={false}>
      {children}
    </Link>
  )
}