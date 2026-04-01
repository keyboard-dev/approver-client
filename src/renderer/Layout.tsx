import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeftIcon, ChevronRightIcon, PanelLeftIcon, PanelRightIcon } from 'lucide-react'

import { useGlobalWebSocketListeners } from './hooks/useGlobalWebSocketListeners'
import { useAuth } from './hooks/useAuth'
import { useSidebarStore } from './stores/sidebar-store'

function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/chat') return 'Chat'
  if (pathname.startsWith('/chat/')) return 'Chat'
  if (pathname.startsWith('/messages/')) return 'Approval'
  if (pathname.startsWith('/settings/')) {
    const tab = pathname.replace('/settings/', '')
    return tab.charAt(0).toUpperCase() + tab.slice(1)
  }
  if (pathname === '/settings') return 'Settings'
  if (pathname.startsWith('/home/')) {
    const tab = pathname.replace('/home/', '').split('/')[0]
    return tab.charAt(0).toUpperCase() + tab.slice(1)
  }
  if (pathname === '/home') return 'Home'
  if (pathname === '/approvals') return 'Approvals'
  return ''
}

export const Layout: React.FC = () => {
  const { leftSidebarOpen, setLeftSidebarOpen, rightSidebarOpen, setRightSidebarOpen, activePanelTitle, settingsPanelOpen } = useSidebarStore()
  const { pathname, hash } = useLocation()
  const viewId = `${pathname}${hash}`
  const navigate = useNavigate()
  const { authStatus, isSkippingAuth } = useAuth()

  const isChatRoute = pathname === '/' || pathname.startsWith('/chat')
  const showRightSidebarButton = isChatRoute && !settingsPanelOpen
  const isSignInPage = !authStatus.authenticated && !isSkippingAuth

  // Navigation history tracking
  const historyStack = useRef<string[]>([viewId])
  const historyIndex = useRef(0)
  const isNavigatingHistory = useRef(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    if (isNavigatingHistory.current) {
      isNavigatingHistory.current = false
      setCanGoBack(historyIndex.current > 0)
      setCanGoForward(historyIndex.current < historyStack.current.length - 1)
      return
    }
    const stack = historyStack.current
    const idx = historyIndex.current
    if (stack[idx] === viewId) return
    const newStack = stack.slice(0, idx + 1)
    newStack.push(viewId)
    historyStack.current = newStack
    historyIndex.current = newStack.length - 1
    setCanGoBack(historyIndex.current > 0)
    setCanGoForward(false)
  }, [viewId])

  const goBack = () => {
    if (historyIndex.current <= 0) return
    historyIndex.current -= 1
    const target = historyStack.current[historyIndex.current]
    if (target === viewId) {
      setCanGoBack(historyIndex.current > 0)
      setCanGoForward(true)
      return
    }
    isNavigatingHistory.current = true
    navigate(target)
  }

  const goForward = () => {
    if (historyIndex.current >= historyStack.current.length - 1) return
    historyIndex.current += 1
    const target = historyStack.current[historyIndex.current]
    if (target === viewId) {
      setCanGoBack(true)
      setCanGoForward(historyIndex.current < historyStack.current.length - 1)
      return
    }
    isNavigatingHistory.current = true
    navigate(target)
  }

  // Register global WebSocket message listeners (persists across route changes)
  useGlobalWebSocketListeners()

  // Sync dark class on <html> with system color scheme
  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark)
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mq.matches)
    mq.addEventListener('change', e => apply(e.matches))
    return () => mq.removeEventListener('change', e => apply(e.matches))
  }, [])

  const pageTitle = activePanelTitle ?? getPageTitle(pathname)

  return (
    <div className="w-full h-screen bg-[#EBEBEB] draggable rounded-[0.5rem]">
    <div
      className="flex flex-col w-full h-full p-[0.63rem] pt-0 items-center text-[0.88rem] text-[#171717] font-medium font-inter"
    >
      <div className="relative flex w-full ml-[1.25rem] my-[0.5rem] py-[4px] items-center z-20">
        {/* Left: sidebar toggle */}
        <div className="ml-[5rem]">
          {!isSignInPage && (
            <button
              type="button"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="not-draggable"
              aria-label={leftSidebarOpen ? 'Close left sidebar' : 'Open left sidebar'}
            >
              <PanelLeftIcon className="size-[16px] text-[#171717] dark:text-white" />
            </button>
          )}
        </div>

        {/* Center: back/forward + title — absolutely centered in the bar */}
        {!isSignInPage && (
          <div className="absolute inset-x-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-[8px] pointer-events-auto">
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack}
                className="not-draggable"
                aria-label="Go back"
              >
                <ChevronLeftIcon className={`size-[16px] transition-colors ${canGoBack ? 'text-[#171717] dark:text-white' : 'text-[#C0C0C0] dark:text-[#555]'}`} />
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={!canGoForward}
                className="not-draggable"
                aria-label="Go forward"
              >
                <ChevronRightIcon className={`size-[16px] transition-colors ${canGoForward ? 'text-[#171717] dark:text-white' : 'text-[#C0C0C0] dark:text-[#555]'}`} />
              </button>
              {pageTitle && (
                <span className="text-[13px] font-medium text-[#171717] dark:text-white ml-[4px]">
                  {pageTitle}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Right: right sidebar toggle */}
        {!isSignInPage && showRightSidebarButton && (
          <button
            type="button"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className="not-draggable ml-auto mr-[16px]"
            aria-label={rightSidebarOpen ? 'Close right sidebar' : 'Open right sidebar'}
          >
            <PanelRightIcon className="size-[16px] text-[#171717] dark:text-white" />
          </button>
        )}
      </div>

      <div
        className={`flex flex-col w-full min-w-0 grow min-h-0 bg-[#EBEBEB] rounded-[0.5rem] not-draggable gap-[0.63rem] items-start overflow-auto ${isSignInPage ? 'pt-0 pb-[0.75rem]' : 'pt-[4px] pb-[0.75rem]'}`}
      >
        <Outlet />
      </div>
    </div>
    </div>
  )
}
