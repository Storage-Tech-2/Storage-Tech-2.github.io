import { useEffect, useRef, useState } from "react"

export function useInView<T extends Element>(opts: IntersectionObserverInit = {}): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting)
    }, { root: opts.root || null, rootMargin: opts.rootMargin ?? "300px 0px", threshold: opts.threshold ?? 0.01 })
    io.observe(el)
    return () => io.disconnect()
  }, [opts.root, opts.rootMargin, opts.threshold])
  return [ref, inView]
}
