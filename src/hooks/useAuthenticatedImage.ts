import { useState, useEffect } from 'react'

/**
 * A hook that fetches an image from an authenticated endpoint using a Blob and Object URL.
 * It automatically handles URL revocation on unmount or when the URL/token changes.
 */
export function useAuthenticatedImage(
  url: string | null | undefined, 
  token: string | null
) {
  const [src, setSrc] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!url || !token) {
      setSrc(undefined)
      return
    }

    let isMounted = true
    let objectUrl: string | null = null

    async function fetchImage() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(url!, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()

        if (isMounted) {
          objectUrl = URL.createObjectURL(blob)
          setSrc(objectUrl)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error fetching image'))
          setSrc(undefined)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void fetchImage()

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [url, token])

  return { src, loading, error }
}
