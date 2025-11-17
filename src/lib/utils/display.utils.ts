export function maskKey(key: string | null | undefined): string {
  if (!key || typeof key !== 'string') {
    return ''
  }

  // If key is 6 characters or less, don't mask it (not enough to hide)
  if (key.length <= 6) {
    return key
  }

  const start = key.slice(0, 3)
  const end = key.slice(-3)
  const middleLength = key.length - 6
  const asterisks = '*'.repeat(middleLength)

  return `${start}${asterisks}${end}`
}
