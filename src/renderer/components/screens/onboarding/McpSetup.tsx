import { Copy, Download } from 'lucide-react'
import React, { useState } from 'react'
import { Footer } from '../../Footer'
import { ButtonDesigned } from '../../ui/ButtonDesigned'
import { Input } from '../../ui/input'
import { ProgressIndicator } from './ProgressIndicator'

interface McpSetupProps {
  onNext: () => void
}

export const McpSetup: React.FC<McpSetupProps> = ({ onNext }) => {
  const [remoteUrl, setRemoteUrl] = useState('https://mcp.keyboard.dev')
  const [copySuccess, setCopySuccess] = useState(false)

  const advancedSettingsImg = 'https://res.cloudinary.com/dt29hglkk/image/upload/v1757699431/advanced-settings_prlpa6.png'
  const installExtensionImg = 'https://res.cloudinary.com/dt29hglkk/image/upload/v1757699537/install-extension_qbtjua.png'

  const handleDownload = () => {
    window.electronAPI.openExternalUrl('https://github.com/keyboard-dev/keyboard-mcp/releases/latest')
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
    catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div
      className="flex flex-col h-full w-full py-[3.88rem] items-center"
    >
      <div
        className="flex flex-col items-start h-full max-w-[22.88rem] justify-between"
      >
        <div
          className="flex w-full flex-col items-start gap-[2.5rem]"
        >
          <div
            className="flex w-full flex-col items-start gap-[0.63rem] pb-[1.25rem] border-b"
          >
            <div
              className="text-[1.38rem] font-semibold"
            >
              Set up your MCP client
            </div>
            <div
              className="text-[#A5A5A5]"
            >
              Choose how to connect to our MCP server.
            </div>

            <div
              className="flex w-full justify-center"
            >
              <ProgressIndicator progress={1} />
            </div>
          </div>

          <div
            className="flex flex-col items-start gap-[1.5rem] w-full"
          >
            {/* Option 1: Remote MCP */}
            <div className="flex flex-col gap-[0.94rem] w-full">
              <div className="text-gray-900 font-medium">Option 1: Remote MCP Server (Recommended)</div>

              <div className="text-sm text-[#A5A5A5]">
                Copy and paste this URL into your MCP client configuration:
              </div>

              <div className="flex gap-[0.5rem] w-full">
                <Input
                  value={remoteUrl}
                  onChange={e => setRemoteUrl(e.target.value)}
                  className="flex-1 text-sm"
                  readOnly
                />
                <ButtonDesigned
                  variant="primary"
                  className="flex gap-[0.5rem] px-[1rem] py-[0.5rem]"
                  hasBorder
                  onClick={handleCopyUrl}
                >
                  <Copy className="h-4 w-4" />
                  <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                </ButtonDesigned>
              </div>
            </div>

            {/* Option 2: Download .dxt file */}
            <div className="flex flex-col gap-[0.94rem] w-full">
              <div className="text-gray-900 font-medium">Option 2: Download Local File</div>

              <div className="text-sm text-[#A5A5A5]">
                <span>Download the </span>
                <span className="text-[#5093B7]">keyboard-mcp.dxt</span>
                <span> file for local setup</span>
              </div>

              <ButtonDesigned
                variant="primary"
                className="rounded-full flex gap-[0.63rem] px-[1.25rem] py-[0.63rem] self-center"
                hasBorder
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                <span>Download file</span>
              </ButtonDesigned>
            </div>

          </div>

          <div className="space-y-4">
            <div className="text-gray-900 font-medium">For Claude Desktop:</div>

            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Step 1:</span>
                {' '}
                Find the advanced settings
              </div>
              <div className="flex justify-center">
                <img
                  src={advancedSettingsImg}
                  alt="Advanced Settings"
                  className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                />
              </div>

              <div className="text-sm text-gray-700">
                <span className="font-medium">Step 2:</span>
                {' '}
                Install the extension and upload the file
              </div>
              <div className="flex justify-center">
                <img
                  src={installExtensionImg}
                  alt="Install Extension"
                  className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <span className="text-gray-900 font-medium">For other MCP clients:</span>
            <span
              className="pl-2 text-blue-600 text-sm font-medium font-inter cursor-pointer hover:underline"
              onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/getting-started/other-mcp-clients')}
            >
              Follow this document
            </span>
          </div>

          <ButtonDesigned
            variant="clear"
            onClick={() => {
              onNext()
            }}
            className="px-[1rem] py-[0.5rem] self-end"
            hasBorder
          >
            Next
          </ButtonDesigned>

        </div>

        <Footer />
      </div>
    </div>
  )

  // return (
  //   <div className="flex items-start justify-center min-h-screen w-full p-6 bg-white">
  //     <div style={{ height: '70vh', display: 'flex', flexDirection: 'column' }} className="max-w-md w-full space-y-6 bg-white rounded-lg p-8 shadow-sm">
  //       {/* Header */}
  //       <div className="text-center space-y-2">
  //         <h1 className="text-xl font-semibold text-gray-900">
  //           Set up your MCP client
  //         </h1>
  //         <p className="text-gray-600 text-sm">
  //           Make sure you've downloaded our most up-to-date .dxt file.
  //         </p>
  //       </div>

  //       {/* Progress indicator */}
  //       <div className="flex justify-center space-x-2">
  //         <ProgressIndicator progress={1} />
  //       </div>

  //       {/* Instructions */}
  //       <div className="space-y-6">
  //         <div className="space-y-4">
  //           <div>
  //             <span className="text-gray-900 font-medium">Download the </span>
  //             <span className="text-gray-900 font-medium">keyboard-mcp.dxt</span>
  //             <span className="text-gray-900 font-medium"> file</span>
  //           </div>

  //           <div className="flex justify-center">
  //             <button
  //               onClick={handleDownload}
  //               className="flex items-center space-x-2 px-6 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-blue-200"
  //             >
  //               <Download className="h-4 w-4" />
  //               <span>Download file</span>
  //             </button>
  //           </div>
  //         </div>

  //         {/* Claude Desktop Setup */}
  //         <div className="space-y-4">
  //           <div className="text-gray-900 font-medium">For Claude Desktop:</div>

  //           <div className="space-y-3">
  //             <div className="text-sm text-gray-700">
  //               <span className="font-medium">Step 1:</span>
  //               {' '}
  //               Find the advanced settings
  //             </div>
  //             <div className="flex justify-center">
  //               <img
  //                 src={advancedSettingsImg}
  //                 alt="Advanced Settings"
  //                 className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
  //               />
  //             </div>

  //             <div className="text-sm text-gray-700">
  //               <span className="font-medium">Step 2:</span>
  //               {' '}
  //               Install the extension and upload the file
  //             </div>
  //             <div className="flex justify-center">
  //               <img
  //                 src={installExtensionImg}
  //                 alt="Install Extension"
  //                 className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
  //               />
  //             </div>
  //           </div>
  //         </div>

  //         <div>
  //           <br />
  //           <div className="flex justify-center">
  //             <span className="text-gray-900 font-medium">For other MCP clients:</span>
  //             <span
  //               className="pl-2 text-blue-600 text-sm font-medium font-inter cursor-pointer hover:underline"
  //               onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/getting-started/other-mcp-clients')}
  //             >
  //               Follow this document
  //             </span>
  //           </div>
  //         </div>
  //       </div>

  //       {/* Action Buttons */}
  //       <div className="flex justify-end pt-4">
  //         <button
  //           onClick={onNext}
  //           className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
  //         >
  //           Next
  //         </button>
  //       </div>

  //       {/* Footer */}
  //       <Footer />
  //     </div>
  //   </div>
  // )
}

export default McpSetup
