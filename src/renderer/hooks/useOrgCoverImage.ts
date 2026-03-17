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
    let retryCount = 0
    const maxRetries = 3

    async function fetchCoverImage() {
      try {
        const result = await window.electronAPI?.getOrgCoverImage?.()
        if (cancelled) return
        if (result?.success && result.url) {
          setState({ url: result.url, loading: false })
        }
        else if (retryCount < maxRetries) {
          // Auth may not be ready yet — retry after a short delay
          retryCount++
          setTimeout(fetchCoverImage, 2000)
        }
        else {
          setState({ url: null, loading: false })
        }
      }
      catch {
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
