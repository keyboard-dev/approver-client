import React from 'react'

export const ConnectorPanel: React.FC = () => {
  return (
    <>
      <div
        className="px-[0.94rem]"
      >
        <div
          className="text-[1.13rem]"
        >
          Connectors
        </div>
        <div
          className="text-[#737373]"
        >
          Allow Keyboard to reference other apps and services for more context.
          {' '}
          <button
            className="underline"
            // too add link
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/')}
          >
            Learn more
          </button>
        </div>
      </div>

      <div
        className="p-[0.94rem] flex flex-col gap-[1rem] border border-[#E5E5E5] rounded-[0.38rem]"
      >
        <div
          className="flex flex-col gap-[0.5rem]"
        >
          <div
            className="text-[1rem]"
          >
            Shared connectors
          </div>
          <div
            className="text-[#737373]"
          >
            A shared integration hub where available connectors are controlled by someone else — such as your organization, team admin, or another service.
          </div>
        </div>

        <div>
          fdsafad
        </div>

      </div>
    </>
  )
}
