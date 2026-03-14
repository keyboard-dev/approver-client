import { useEffect, useState } from 'react'

interface OrgCoverImageState {
  url: string | null
  loading: boolean
}

/**
 * Fetches the organization's cover image if the user belongs to an org.
 * Returns { url, loading } — url is null if no cover image or no org.
 */
export function useOrgCoverImage(): OrgCoverImageState {
  const [state, setState] = useState<OrgCoverImageState>({ url: null, loading: true })

  useEffect(() => {
    let cancelled = false

    async function fetchCoverImage() {
      try {
        const result = await window.electronAPI?.getOrgCoverImage?.()
        if (!cancelled && result?.success) {
          setState({ url: result.url ?? null, loading: false })
        } else if (!cancelled) {
          setState({ url: null, loading: false })
        }
      } catch {
        if (!cancelled) {
          setState({ url: null, loading: false })
        }
      }
    }

    fetchCoverImage()
    return () => { cancelled = true }
  }, [])

  return state
}
