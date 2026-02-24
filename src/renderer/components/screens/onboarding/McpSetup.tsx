import { Copy } from 'lucide-react'
import React, { useState } from 'react'
import { Footer } from '../../Footer'
import { ButtonDesigned } from '../../ui/ButtonDesigned'
import { Input } from '../../ui/input'
import { ProgressIndicator } from './ProgressIndicator'

interface McpSetupProps {
  onNext: () => void
}

export const McpSetup: React.FC<McpSetupProps> = ({ onNext }) => {
  const [remoteUrl] = useState('https://mcp.keyboard.dev')
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
    catch (err) {
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
              Connect to our remote MCP server.
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
            <div className="flex flex-col gap-[0.94rem] w-full">
              <div className="text-gray-900 font-medium">Remote MCP Server</div>

              <div className="text-sm text-[#A5A5A5]">
                Copy and paste this URL into your MCP client configuration:
              </div>

              <div className="flex gap-[0.5rem] w-full">
                <Input
                  value={remoteUrl}
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
}

export default McpSetup
