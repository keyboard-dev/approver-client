import { ChevronDown, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Script } from '../../main'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

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
    }
    else {
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
    <div className={`flex flex-col space-y-2 ${className}`}>
      {/* Always show the dropdown for adding scripts */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-sm h-9"
            disabled={scripts.length === 0}
          >
            {scripts.length === 0
              ? 'No scripts available'
              : selectedScripts.length === 0
                ? 'Select scripts (optional)'
                : `${selectedScripts.length} script${selectedScripts.length > 1 ? 's' : ''} selected - click to add more`}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
          <DropdownMenuLabel>Select Scripts</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {scripts.map((script) => {
            const isSelected = selectedScripts.some(s => s.id === script.id)
            return (
              <DropdownMenuCheckboxItem
                key={script.id}
                checked={isSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onScriptSelect([...selectedScripts, script])
                  }
                  else {
                    onScriptSelect(selectedScripts.filter(s => s.id !== script.id))
                  }
                }}
                className="cursor-pointer"
              >
                <div className="flex flex-col space-y-1 w-full">
                  <div className="font-medium text-sm">{script.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 w-full">
                    {script.description}
                  </div>
                  {script.tags && script.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 w-full mt-1">
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
                </div>
              </DropdownMenuCheckboxItem>
            )
          })}
          {selectedScripts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleClearSelection}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear all selections
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Show selected scripts below the dropdown when any are selected */}
      {selectedScripts.length > 0 && (
        <div className="flex flex-wrap gap-1 p-3 bg-blue-50 border border-blue-200 rounded-lg w-full">
          {selectedScripts.map(script => (
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="h-6 text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
