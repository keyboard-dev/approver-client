import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { Progress } from './ui/progress'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
}

interface ProgressInfo {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export const UpdateNotification: React.FC = () => {
  const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<ProgressInfo | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [showNotification, setShowNotification] = useState(true)

  useEffect(() => {
    // Listen for update events
    const handleUpdateAvailable = (_event: unknown, info: UpdateInfo) => {
      setUpdateAvailable(true)
      setUpdateInfo(info)
      setShowNotification(true)
    }

    const handleDownloadProgress = (_event: unknown, progressInfo: ProgressInfo) => {
      setDownloadProgress(progressInfo)
      setDownloading(true)
    }

    const handleUpdateDownloaded = (_event: unknown, info: UpdateInfo) => {
      setUpdateDownloaded(true)
      setDownloading(false)
      setUpdateInfo(info)
      setShowNotification(true)
    }

    // Set up listeners
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable)
    window.electronAPI.onDownloadProgress(handleDownloadProgress)
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded)

    // Cleanup
    return () => {
      window.electronAPI.removeAllListeners('update-available')
      window.electronAPI.removeAllListeners('download-progress')
      window.electronAPI.removeAllListeners('update-downloaded')
    }
  }, [])

  const handleCheckForUpdates = async () => {
    setIsChecking(true)
    try {
      await window.electronAPI.checkForUpdates()
    } catch (error) {
      console.error('Error checking for updates:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleDownloadUpdate = async () => {
    setDownloading(true)
    try {
      await window.electronAPI.downloadUpdate()
    } catch (error) {
      console.error('Error downloading update:', error)
      setDownloading(false)
    }
  }

  const handleInstallUpdate = async () => {
    try {
      await window.electronAPI.quitAndInstall()
    } catch (error) {
      console.error('Error installing update:', error)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  // Don't show anything if there's no update and we're not checking
  if (!updateAvailable && !updateDownloaded && !isChecking && !downloading) {
    return null
  }

  // Don't show if user dismissed the notification
  if (!showNotification && !downloading) {
    return null
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 max-w-md">
        {updateDownloaded ? (
        <Alert className="border-green-200 bg-green-50">
          <RefreshCw className="h-4 w-4" />
          <AlertDescription className="pr-8">
            <div className="space-y-2">
              <div className="font-semibold">Update Ready to Install</div>
              <div className="text-sm">
                Version {updateInfo?.version} has been downloaded and is ready to install.
              </div>
              <div className="flex space-x-2 mt-3">
                <Button size="sm" onClick={handleInstallUpdate}>
                  Restart and Install
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNotification(false)}>
                  Later
                </Button>
              </div>
            </div>
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={() => setShowNotification(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Alert>
      ) : downloading && downloadProgress ? (
        <Alert className="border-blue-200 bg-blue-50">
          <Download className="h-4 w-4 animate-pulse" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-semibold">Downloading Update...</div>
              <Progress value={downloadProgress.percent} className="h-2" />
              <div className="text-xs text-gray-600 space-y-1">
                <div>{Math.round(downloadProgress.percent)}% complete</div>
                <div>
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                </div>
                <div>Speed: {formatSpeed(downloadProgress.bytesPerSecond)}</div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ) : updateAvailable ? (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Download className="h-4 w-4" />
          <AlertDescription className="pr-8">
            <div className="space-y-2">
              <div className="font-semibold">Update Available</div>
              <div className="text-sm">
                Version {updateInfo?.version} is available for download.
                {updateInfo?.releaseName && (
                  <div className="mt-1 text-xs text-gray-600">
                    {updateInfo.releaseName}
                  </div>
                )}
              </div>
              <div className="flex space-x-2 mt-3">
                <Button size="sm" onClick={handleDownloadUpdate}>
                  Download Update
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNotification(false)}>
                  Not Now
                </Button>
              </div>
            </div>
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={() => setShowNotification(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Alert>
      ) : isChecking ? (
        <Alert className="border-gray-200 bg-gray-50">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Checking for updates...
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Manual check button */}
      {!updateAvailable && !updateDownloaded && !downloading && !isChecking && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckForUpdates}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Check for Updates</span>
        </Button>
      )}
      </div>

      {/* Development Test UI */}
      {isDev && (
        <div className="fixed top-4 left-4 z-50 bg-gray-100 p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold mb-2">🧪 Auto-Updater Test Controls</div>
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await (window as any).electronAPI.testUpdateAvailable()
                } catch (error) {
                  console.error('Test update available error:', error)
                }
              }}
            >
              Simulate Update Available
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await (window.electronAPI as any).invoke('test-download-update')
                } catch (error) {
                  console.error('Test download update error:', error)
                }
              }}
            >
              Simulate Download Progress
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await (window.electronAPI as any).invoke('test-update-downloaded')
                } catch (error) {
                  console.error('Test update downloaded error:', error)
                }
              }}
            >
              Simulate Update Downloaded
            </Button>
          </div>
        </div>
      )}
    </>
  )
}