import { Check, ChevronDown, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Script } from '../../main'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

interface ScriptSelectorProps {
  selectedScript: Script | null
  onScriptSelect: (script: Script | null) => void
  className?: string
}

export const ScriptSelector: React.FC<ScriptSelectorProps> = ({
  selectedScript,
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

  const handleScriptSelect = (script: Script) => {
    onScriptSelect(script)
  }

  const handleClearSelection = () => {
    onScriptSelect(null)
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
      {selectedScript
        ? (
            <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">{selectedScript.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {selectedScript.description}
                </div>
                {selectedScript.tags && selectedScript.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedScript.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {selectedScript.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +
                        {selectedScript.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
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
                    : 'Select a script (optional)'}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
                {scripts.map(script => (
                  <DropdownMenuItem
                    key={script.id}
                    onClick={() => handleScriptSelect(script)}
                    className="flex flex-col items-start space-y-1 p-3 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <div className="font-medium text-sm">{script.name}</div>
                      <Check className="ml-auto h-4 w-4 opacity-0" />
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
                            +
                            {script.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
    </div>
  )
}