import React, { useState } from 'react'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { Popup } from '../../../ui/Popup'

interface ManualProviderFormProps {
  onSave: ({
    name,
    url,
  }: {
    name: string
    url: string
  }) => Promise<void>
  onCancel: () => void
}

export const AddServerPopup: React.FC<ManualProviderFormProps> = ({
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  return (
    <Popup
      onCancel={onCancel}
    >
      <div
        className="flex flex-col gap-[1rem]"
      >
        <div
          className="text-[1rem] text-[#000] font-semibold"
        >
          Add a server provider
        </div>

        <div
          className="flex flex-col gap-[0.75rem]"
        >
          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Server name
              {' '}
              <span className="text-[#D23535]">
                *
              </span>
            </div>

            <div
              className="text-[#737373]"
            >
              A name for this server, e.g., “My Salesforce”.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div
            className="flex flex-col gap-[0.38rem]"
          >
            <div
              className="text-[#000]"
            >
              Server URL
              {' '}
              <span className="text-[#D23535]">
                *
              </span>
            </div>

            <div
              className="text-[#737373]"
            >
              Provided by the service you’re connecting to.
            </div>

            <input
              className="border border-[#CCC] rounded-[0.38rem] px-[0.63rem] py-[0.38rem]"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://localhost:4000"
            />
          </div>
        </div>

        <div
          className="flex gap-[1.25rem]"
        >
          <ButtonDesigned
            className="grow shrink basis-0"
            variant="primary"
            onClick={() => onSave({ name, url })}
            // disabled={isLoading}
          >
            Connect
          </ButtonDesigned>

          <ButtonDesigned
            className="grow shrink basis-0"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </ButtonDesigned>
        </div>
      </div>
    </Popup>
  )
}
