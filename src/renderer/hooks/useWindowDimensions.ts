import { useEffect, useState } from 'react'

const THIN_WIDTH = 512

interface WindowDimensions {
  isThin: boolean
  width: number
  height: number
}

export const useWindowDimensions = (): WindowDimensions => {
  const [windowDimensions, setWindowDimensions] = useState<WindowDimensions>({
    isThin: window.innerWidth < THIN_WIDTH,
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        isThin: window.innerWidth < THIN_WIDTH,
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return windowDimensions
}
