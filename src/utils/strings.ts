export function normalize(s?: string) {
  return (s || "").toLowerCase()
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
