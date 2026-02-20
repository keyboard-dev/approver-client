import { Download, RefreshCw } from 'lucide-react'
import React from 'react'
import type { UpdateAvailableNotification, UpdateDownloadedNotification, UpdateDownloadingNotification } from '../../hooks/useInbox'
import { useInbox } from '../../hooks/useInbox'
import { ButtonDesigned } from '../ui/ButtonDesigned'

interface UpdateAvailableItemProps {
  notification: UpdateAvailableNotification
}

export const UpdateAvailableItem: React.FC<UpdateAvailableItemProps> = ({ notification }) => {
  const { downloadUpdate, markAsRead } = useInbox()

  const handleDownload = async () => {
    markAsRead(notification.id)
    await downloadUpdate()
  }

  return (
    <div className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]">
      <div className="border-l-2 border-[#F59E0B] px-[0.63rem]">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[0.63rem]">
              <Download className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-black font-semibold">
                Update Available
              </span>
            </div>
            <ButtonDesigned
              variant="primary-black"
              className="px-[0.63rem] py-[0.38rem] rounded-full text-xs"
              onClick={handleDownload}
            >
              Download
            </ButtonDesigned>
          </div>
          <div className="text-sm text-[#525252]">
            Version
            {' '}
            <span className="font-medium">{notification.version}</span>
            {' '}
            is available.
          </div>
        </div>
      </div>
    </div>
  )
}

interface UpdateDownloadingItemProps {
  notification: UpdateDownloadingNotification
}

export const UpdateDownloadingItem: React.FC<UpdateDownloadingItemProps> = ({ notification }) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const percent = Math.round(notification.percent)

  return (
    <div className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]">
      <div className="border-l-2 border-[#3B82F6] px-[0.63rem]">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[0.63rem]">
              <Download className="w-4 h-4 text-[#3B82F6] animate-pulse" />
              <span className="text-black font-semibold">
                Downloading Update
              </span>
            </div>
            <span className="text-xs text-[#525252]">
              {percent}
              %
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#E5E5E5] rounded-full h-1.5">
            <div
              className="bg-[#3B82F6] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="text-xs text-[#737373]">
            {formatBytes(notification.transferred)}
            {' '}
            /
            {' '}
            {formatBytes(notification.total)}
            {' '}
            ·
            {' '}
            {formatBytes(notification.bytesPerSecond)}
            /s
          </div>
        </div>
      </div>
    </div>
  )
}

interface UpdateDownloadedItemProps {
  notification: UpdateDownloadedNotification
}

export const UpdateDownloadedItem: React.FC<UpdateDownloadedItemProps> = ({ notification }) => {
  const { installUpdate, markAsRead } = useInbox()

  const handleInstall = async () => {
    markAsRead(notification.id)
    await installUpdate()
  }

  return (
    <div className="px-[0.63rem] py-[0.75rem] border-t border-[#E5E5E5]">
      <div className="border-l-2 border-[#22C55E] px-[0.63rem]">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[0.63rem]">
              <RefreshCw className="w-4 h-4 text-[#22C55E]" />
              <span className="text-black font-semibold">
                Update Ready
              </span>
            </div>
            <ButtonDesigned
              variant="primary-black"
              className="px-[0.63rem] py-[0.38rem] rounded-full text-xs"
              onClick={handleInstall}
            >
              Restart
            </ButtonDesigned>
          </div>
          <div className="text-sm text-[#525252]">
            Version
            {' '}
            <span className="font-medium">{notification.version}</span>
            {' '}
            is ready to install.
          </div>
        </div>
      </div>
    </div>
  )
}
