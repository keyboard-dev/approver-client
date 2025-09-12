import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'
import React, { useState } from 'react'

import blueCheckIconUrl from '../../../assets/icon-check-blue.svg'
import codeIconUrl from '../../../assets/icon-code.svg'
import greyXIconUrl from '../../../assets/icon-x-grey.svg'
import { CollectionRequest, TemplateVariableSchema } from '../../types'
interface ShareProps {
  request: CollectionRequest
  onApprove: (updatedRequest: CollectionRequest) => void
  onReject: () => void
  onBack: () => void
}

export const Share: React.FC<ShareProps> = ({
  request,
  onApprove,
  onReject,
  onBack,
}) => {
  const [formData, setFormData] = useState<CollectionRequest>(request)
  const [activeTab, setActiveTab] = useState<'details' | 'code' | 'schema'>('details')
  const [isFontLoaded, setIsFontLoaded] = useState(false)
  const [schemaJsonError, setSchemaJsonError] = useState<string | null>(null)

  React.useEffect(() => {
    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        setTimeout(() => setIsFontLoaded(true), 100)
      }
      catch (error) {
        console.warn('Font loading failed, proceeding with fallback:', error)
        setIsFontLoaded(true)
      }
    }
    checkFontLoaded()
  }, [])

  const handleEditorWillMount = (monacoInstance: typeof monaco) => {
    monacoInstance.editor.defineTheme('lazy', lazyTheme as monaco.editor.IStandaloneThemeData)
  }

  const handleInputChange = (field: keyof CollectionRequest, value: string | boolean | string[] | Record<string, TemplateVariableSchema>) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayInputChange = (field: keyof CollectionRequest, index: number, value: string) => {
    setFormData((prev) => {
      const array = [...(prev[field] as string[])]
      array[index] = value
      return { ...prev, [field]: array }
    })
  }

  const addArrayItem = (field: keyof CollectionRequest) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), ''],
    }))
  }

  const removeArrayItem = (field: keyof CollectionRequest, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index),
    }))
  }

  return (
    <>
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
        <button
          onClick={() => setActiveTab('schema')}
          className="grow basis-0 flex items-center justify-center py-[0.5rem] rounded-[0.25rem] gap-[0.31rem] border-none outline-none"
          style={activeTab === 'schema' ? { backgroundColor: 'white' } : {}}
        >
          Template Schema
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="w-full grow overflow-auto min-h-0 flex flex-col gap-[1rem]">
          <div className="flex flex-col gap-[0.5rem]">
            <label className="text-[#737373] text-[0.75rem]">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleInputChange('title', e.target.value)}
              className="px-[0.75rem] py-[0.5rem] border border-[#E5E5E5] rounded-[0.38rem] w-full"
            />
          </div>

          <div className="flex flex-col gap-[0.5rem]">
            <label className="text-[#737373] text-[0.75rem]">Description</label>
            <textarea
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
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
                  onChange={e => handleArrayInputChange('keyboard_api_keys_required', index, e.target.value)}
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
                  onChange={e => handleArrayInputChange('provider_user_tokens_required', index, e.target.value)}
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
            <label className="text-[#737373] text-[0.75rem]">Services by Domain Name</label>
            {formData.api_services.map((service, index) => (
              <div key={index} className="flex gap-[0.5rem]">
                <input
                  type="text"
                  value={service}
                  onChange={e => handleArrayInputChange('api_services', index, e.target.value)}
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
          {isFontLoaded
            ? (
                <Editor
                  height="100%"
                  width="100%"
                  language="javascript"
                  value={formData.script_code}
                  onChange={value => handleInputChange('script_code', value || '')}
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
              )
            : (
                <div className="flex items-center justify-center h-full text-[#737373]">
                  Loading editor...
                </div>
              )}
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="w-full grow min-h-0 flex flex-col gap-[0.5rem]">
          <div className="text-[#737373] text-[0.75rem]">
            Template Variables Schema (JSON)
          </div>
          {schemaJsonError && (
            <div className="px-[0.75rem] py-[0.5rem] bg-[#FEE2E2] text-[#DC2626] rounded-[0.38rem] text-[0.75rem]">
              {schemaJsonError}
            </div>
          )}
          <div className="border border-[#E5E5E5] rounded-[0.38rem] w-full grow min-h-0">
            {isFontLoaded
              ? (
                  <Editor
                    height="100%"
                    width="100%"
                    language="json"
                    value={JSON.stringify(formData.template_variables_schema, null, 2)}
                    onChange={(value) => {
                      try {
                        const parsed = JSON.parse(value || '{}')
                        handleInputChange('template_variables_schema', parsed)
                        setSchemaJsonError(null)
                      }
                      catch (e) {
                        setSchemaJsonError(e instanceof Error ? e.message : 'Invalid JSON')
                      }
                    }}
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
                )
              : (
                  <div className="flex items-center justify-center h-full text-[#737373]">
                    Loading editor...
                  </div>
                )}
          </div>
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
    </>
  )
}
