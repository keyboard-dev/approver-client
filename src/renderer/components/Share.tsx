import React, { useState } from 'react'
import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'

import blueCheckIconUrl from '../../../assets/icon-check-blue.svg'
import greyXIconUrl from '../../../assets/icon-x-grey.svg'
import codeIconUrl from '../../../assets/icon-code.svg'
import iconGearUrl from '../../../assets/icon-gear.svg'

export interface TemplateVariableSchema {
  type: string
  description?: string
  default?: any
  required?: boolean
}

export interface CollectionRequest {
  title: string
  description: string
  community: boolean
  from_the_team: boolean
  keyboard_api_keys_required: string[]
  provider_user_tokens_required: string[]
  api_services: string[]
  script_code: string
  template_variables_schema: Record<string, TemplateVariableSchema>
}

interface ShareProps {
  request: CollectionRequest
  onApprove: (updatedRequest: CollectionRequest) => void
  onReject: () => void
  onBack: () => void
  onOptionClick: () => void
}

export const Share: React.FC<ShareProps> = ({
  request,
  onApprove,
  onReject,
  onBack,
  onOptionClick,
}) => {
  const [formData, setFormData] = useState<CollectionRequest>(request)
  const [activeTab, setActiveTab] = useState<'details' | 'code'>('details')
  const [isFontLoaded, setIsFontLoaded] = useState(false)

  React.useEffect(() => {
    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        setTimeout(() => setIsFontLoaded(true), 100)
      } catch (error) {
        console.warn('Font loading failed, proceeding with fallback:', error)
        setIsFontLoaded(true)
      }
    }
    checkFontLoaded()
  }, [])

  const handleEditorWillMount = (monacoInstance: typeof monaco) => {
    monacoInstance.editor.defineTheme('lazy', lazyTheme as monaco.editor.IStandaloneThemeData)
  }

  const handleInputChange = (field: keyof CollectionRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayInputChange = (field: keyof CollectionRequest, index: number, value: string) => {
    setFormData(prev => {
      const array = [...(prev[field] as string[])]
      array[index] = value
      return { ...prev, [field]: array }
    })
  }

  const addArrayItem = (field: keyof CollectionRequest) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }))
  }

  const removeArrayItem = (field: keyof CollectionRequest, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }))
  }

  return (
    <div className="flex flex-col w-full h-screen bg-transparent draggable rounded-[0.5rem] p-[0.63rem] pt-0 items-center text-[0.88rem] text-[#171717]">
      <div className="flex w-full -h-[1.56rem] mx-[1.25rem] my-[0.5rem] justify-between">
        <div
          className="px-[0.5rem] py-[0.25rem] w-4 h-4"
        />
        <div
          className="px-[0.75rem] py-[0.25rem] rounded-full bg-[#BFBFBF] flex items-center gap-[0.63rem]"
        >
          <div
            className="w-[10px] h-[10px] rounded-full bg-[#7BB750]"
          />
          <div
            className="text-[#737373]"
          >
            All systems are
            {' '}
            <span className="text-[#7BB750] font-semibold">
              normal
            </span>
          </div>
        </div>
        <button
          onClick={onOptionClick}
          className="px-[0.5rem] py-[0.25rem] rounded-full bg-[#BFBFBF] not-draggable "
        >
          <img src={iconGearUrl} alt="Settings" className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col w-full grow min-h-0 bg-white rounded-[0.5rem] px-[0.63rem] py-[0.75rem] not-draggable gap-[0.63rem] items-start">
        <button
          onClick={onBack}
          className="py-[0.31rem] mt-[-0.31rem] px-[0.31rem] text-[#737373]"
        >
          &lt; Back
        </button>

        <div className="flex w-full border border-[#E5E5E5] rounded-[0.38rem] bg-[#F3F3F3] p-[0.25rem] text-[#737373] font-semibold">
          <button
            onClick={() => setActiveTab('details')}
            className="grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none"
            style={activeTab === 'details' ? { backgroundColor: 'white' } : {}}
          >
            Collection Details
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className="grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none"
            style={activeTab === 'code' ? { backgroundColor: 'white' } : {}}
          >
            <img src={codeIconUrl} alt="code" className="w-[1rem] h-[1rem] m-[0.19rem]" />
            Script Code
          </button>
        </div>

        {activeTab === 'details' && (
          <div className="w-full grow overflow-auto min-h-0 flex flex-col gap-[1rem]">
            <div className="flex flex-col gap-[0.5rem]">
              <label className="text-[#737373] text-[0.75rem]">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="px-[0.75rem] py-[0.5rem] border border-[#E5E5E5] rounded-[0.38rem] w-full"
              />
            </div>

            <div className="flex flex-col gap-[0.5rem]">
              <label className="text-[#737373] text-[0.75rem]">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="px-[0.75rem] py-[0.5rem] border border-[#E5E5E5] rounded-[0.38rem] w-full min-h-[4rem]"
              />
            </div>

            <div className="flex flex-col gap-[0.5rem]">
              <label className="text-[#737373] text-[0.75rem]">Keyboard API Keys Required</label>
              {formData.keyboard_api_keys_required.map((key, index) => (
                <div key={index} className="flex gap-[0.5rem]">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => handleArrayInputChange('keyboard_api_keys_required', index, e.target.value)}
                    className="px-[0.75rem] py-[0.5rem] border border-[#E5E5E5] rounded-[0.38rem] flex-1"
                  />
                  <button
                    onClick={() => removeArrayItem('keyboard_api_keys_required', index)}
                    className="px-[0.75rem] py-[0.5rem] bg-[#F3F3F3] rounded-[0.38rem] text-[#737373]"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => addArrayItem('keyboard_api_keys_required')}
                className="px-[0.75rem] py-[0.5rem] bg-[#F3F3F3] rounded-[0.38rem] text-[#737373] w-fit"
              >
                + Add API Key
              </button>
            </div>

            <div className="flex flex-col gap-[0.5rem]">
              <label className="text-[#737373] text-[0.75rem]">Provider User Tokens Required</label>
              {formData.provider_user_tokens_required.map((token, index) => (
                <div key={index} className="flex gap-[0.5rem]">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => handleArrayInputChange('provider_user_tokens_required', index, e.target.value)}
                    className="px-[0.75rem] py-[0.5rem] border border-[#E5E5E5] rounded-[0.38rem] flex-1"
                  />
                  <button
                    onClick={() => removeArrayItem('provider_user_tokens_required', index)}
                    className="px-[0.75rem] py-[0.5rem] bg-[#F3F3F3] rounded-[0.38rem] text-[#737373]"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => addArrayItem('provider_user_tokens_required')}
                className="px-[0.75rem] py-[0.5rem] bg-[#F3F3F3] rounded-[0.38rem] text-[#737373] w-fit"
              >
                + Add Token
              </button>
            </div>

            <div className="flex flex-col gap-[0.5rem]">
              <label className="text-[#737373] text-[0.75rem]">API Services</label>
              {formData.api_services.map((service, index) => (
                <div key={index} className="flex gap-[0.5rem]">
                  <input
                    type="text"
                    value={service}
                    onChange={(e) => handleArrayInputChange('api_services', index, e.target.value)}
                    className="px-[0.75rem] py-[0.5rem] border border-[#E5E5E5] rounded-[0.38rem] flex-1"
                  />
                  <button
                    onClick={() => removeArrayItem('api_services', index)}
                    className="px-[0.75rem] py-[0.5rem] bg-[#F3F3F3] rounded-[0.38rem] text-[#737373]"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => addArrayItem('api_services')}
                className="px-[0.75rem] py-[0.5rem] bg-[#F3F3F3] rounded-[0.38rem] text-[#737373] w-fit"
              >
                + Add Service
              </button>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="border border-[#E5E5E5] rounded-[0.38rem] w-full grow min-h-0">
            {isFontLoaded ? (
              <Editor
                height="100%"
                width="100%"
                language="javascript"
                value={formData.script_code}
                onChange={(value) => handleInputChange('script_code', value || '')}
                theme="lazy"
                beforeMount={handleEditorWillMount}
                options={{
                  automaticLayout: true,
                  fontFamily: '"Fira Code", monospace',
                  fontLigatures: true,
                  fontSize: 14,
                  fontWeight: '400',
                  lineHeight: 1.5,
                  lineNumbersMinChars: 0,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[#737373]">
                Loading editor...
              </div>
            )}
          </div>
        )}

        <div className="w-full flex flex-col gap-[0.5rem]">
          <div className="w-full flex gap-[0.31rem]">
            <button
              className="bg-[#F3F3F3] text-[#737373] grow basis-0 flex gap-[0.31rem] rounded-[0.25rem] p-[0.5rem] items-center justify-center border-none outline-none"
              onClick={onReject}
            >
              <img src={greyXIconUrl} alt="x" className="w-[0.75rem] h-[0.75rem]" />
              Reject
            </button>

            <button
              className="bg-[#5093B726] text-[#5093B7] grow basis-0 flex gap-[0.31rem] rounded-[0.25rem] p-[0.5rem] items-center justify-center border-none outline-none"
              onClick={() => onApprove(formData)}
            >
              <img src={blueCheckIconUrl} alt="check" className="w-[0.75rem] h-[0.75rem]" />
              Approve & Send
            </button>
          </div>

          <div className="text-[#737373] text-[0.75rem] text-center w-full">
            Review all details before approving this collection request.
          </div>
        </div>
      </div>
    </div>
  )
}