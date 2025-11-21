import { Check, ChevronDown, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Script } from '../../main'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

interface ScriptSelectorProps {
  selectedScripts: Script[]
  onScriptSelect: (scripts: Script[]) => void
  className?: string
}

export const ScriptSelector: React.FC<ScriptSelectorProps> = ({
  selectedScripts,
  onScriptSelect,
  className = '',
}) => {
  const [scripts, setScripts] = useState<Script[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadScripts = async () => {
      try {
        const fetchedScripts = await window.electronAPI.getScripts()
        setScripts(fetchedScripts)
      }
      catch (error) {
        console.error('Error loading scripts:', error)
        setScripts([])
      }
      finally {
        setIsLoading(false)
      }
    }

    loadScripts()
  }, [])

  const handleScriptToggle = (script: Script) => {
    const isSelected = selectedScripts.some(s => s.id === script.id)
    if (isSelected) {
      // Remove script from selection
      onScriptSelect(selectedScripts.filter(s => s.id !== script.id))
    } else {
      // Add script to selection
      onScriptSelect([...selectedScripts, script])
    }
  }

  const handleClearSelection = () => {
    onScriptSelect([])
  }

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-sm text-muted-foreground">Loading scripts...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {selectedScripts.length > 0
        ? (
            <div className="flex flex-col space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg w-full">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">
                  {selectedScripts.length === 1 
                    ? `Selected: ${selectedScripts[0].name}` 
                    : `${selectedScripts.length} scripts selected`}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-6 w-6 p-0 hover:bg-red-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Show script details for single selection or list for multiple */}
              {selectedScripts.length === 1 ? (
                <div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {selectedScripts[0].description}
                  </div>
                  {selectedScripts[0].tags && selectedScripts[0].tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedScripts[0].tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {selectedScripts[0].tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{selectedScripts[0].tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedScripts.map((script, index) => (
                    <Badge 
                      key={script.id} 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleScriptToggle(script)
                      }}
                    >
                      {script.name}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )
        : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between text-sm h-9"
                  disabled={scripts.length === 0}
                >
                  {scripts.length === 0
                    ? 'No scripts available'
                    : 'Select scripts (optional)'}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
                {scripts.map(script => {
                  const isSelected = selectedScripts.some(s => s.id === script.id)
                  return (
                    <DropdownMenuItem
                      key={script.id}
                      onClick={() => handleScriptToggle(script)}
                      className="flex flex-col items-start space-y-1 p-3 cursor-pointer"
                    >
                      <div className="flex items-center w-full">
                        <div className="font-medium text-sm">{script.name}</div>
                        <Check className={`ml-auto h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2 w-full">
                        {script.description}
                      </div>
                      {script.tags && script.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 w-full">
                          {script.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {script.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{script.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
    </div>
  )
}