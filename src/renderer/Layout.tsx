import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import iconGearUrl from '../../assets/icon-gear.svg'
import AlertButton from './components/AlertButton'
import StatusDisplay from './components/StatusDisplay'
import { ButtonDesigned } from './components/ui/ButtonDesigned'
import { WebSocketStatusDialog } from './components/WebSocketStatusDialog'
import { useWebSocketDialog } from './hooks/useWebSocketDialog'

/**
 * Layout - Global layout wrapper for all routes
 *
 * This component wraps all routes with a consistent header and frame.
 * Uses React Router's Outlet to render child routes.
 *
 * Features:
 * - StatusDisplay (connection status)
 * - AlertButton (notifications)
 * - Settings button (navigates to /settings)
 * - WebSocket status dialog (global)
 */
export const Layout: React.FC = () => {
  const navigate = useNavigate()
  const { showDialog: showWebSocketDialog, closeDialog: closeWebSocketDialog } = useWebSocketDialog()

  return (
    <div
      className="flex flex-col w-full h-screen bg-transparent draggable rounded-[0.5rem] p-[0.63rem] pt-0 items-center text-[0.88rem] text-[#171717] font-medium font-inter"
    >
      <div className="flex w-full -h-[1.56rem] mx-[1.25rem] my-[0.5rem] justify-between z-20">
        <div
          className="flex-1"
        />
        <StatusDisplay />
        <div
          className="flex-1 flex gap-[0.31rem] justify-end"
        >
          <AlertButton />
          <ButtonDesigned
            className="px-[0.5rem] py-[0.25rem] rounded-full not-draggable"
            variant="secondary"
            onClick={() => navigate('/settings')}
          >
            <img src={iconGearUrl} alt="Settings" className="w-4 h-4" />
          </ButtonDesigned>
        </div>
      </div>

      <div
        className="flex flex-col w-full min-w-0 grow min-h-0 bg-white rounded-[0.5rem] px-[0.63rem] py-[0.75rem] not-draggable gap-[0.63rem] items-start overflow-auto"
      >
        <Outlet />
      </div>

      {/* WebSocket Status Dialog */}
      <WebSocketStatusDialog
        open={showWebSocketDialog}
        onOpenChange={open => !open && closeWebSocketDialog()}
      />
    </div>
  )
}
