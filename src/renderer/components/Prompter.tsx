import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { ChevronDown, ChevronUp, Eye, Play, Search } from 'lucide-react'

interface Script {
  id: string
  name: string
  description: string
  tags?: string[]
  services?: string[]
  isExpanded?: boolean
}

export const Prompter: React.FC = () => {
  const { authStatus } = useAuth()
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    const getScripts = async () => {
      try {
        const scripts = await window.electronAPI.getScripts()
        console.log('scripts', scripts)
        setScripts(scripts)
      } catch (error) {
        console.error('Error getting scripts:', error)
        setScripts([])
      }
    }
    getScripts()
  }, [])

  const toggleScriptSelection = (scriptId: string) => {
    const newSelection = new Set(selectedScripts)
    if (newSelection.has(scriptId)) {
      newSelection.delete(scriptId)
    } else {
      newSelection.add(scriptId)
    }
    setSelectedScripts(newSelection)
  }

  const toggleCardExpansion = (scriptId: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(scriptId)) {
      newExpanded.delete(scriptId)
    } else {
      newExpanded.add(scriptId)
    }
    setExpandedCards(newExpanded)
  }

  const filteredScripts = scripts.filter(script =>
    script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    script.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const runSelectedScripts = () => {
    const selected = scripts.filter(script => selectedScripts.has(script.id))
    console.log('Running scripts:', selected)
    // TODO: Implement script execution
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Script Library</h1>
        <p className="text-muted-foreground">Select and run scripts to automate your workflow</p>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Search scripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {selectedScripts.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedScripts.size} script{selectedScripts.size !== 1 ? 's' : ''} selected
            </span>
            <Button onClick={runSelectedScripts} size="sm">
              <Play className="h-4 w-4 mr-2" />
              Run Selected
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScripts.map((script) => {
          const isExpanded = expandedCards.has(script.id)
          const isSelected = selectedScripts.has(script.id)
          
          return (
            <Card 
              key={script.id} 
              className={`transition-all duration-200 ${isSelected ? 'ring-2 ring-primary' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{script.name}</CardTitle>
                    <CardDescription className={`mt-2 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {script.description}
                    </CardDescription>
                  </div>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleScriptSelection(script.id)}
                    className="ml-4 mt-1"
                  />
                </div>
              </CardHeader>
              
              <CardContent>
                {script.tags && script.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {script.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {isExpanded && script.services && script.services.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Required Services:</p>
                    <div className="flex flex-wrap gap-2">
                      {script.services.map((service, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              
              <CardFooter className="flex justify-between pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCardExpansion(script.id)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      More
                    </>
                  )}
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{script.name}</DialogTitle>
                      <DialogDescription className="mt-3 whitespace-pre-wrap">
                        {script.description}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                      {script.tags && script.tags.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {script.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {script.services && script.services.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Required Services</h4>
                          <div className="flex flex-wrap gap-2">
                            {script.services.map((service, index) => (
                              <Badge key={index} variant="outline">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          )
        })}
      </div>
      
      {filteredScripts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No scripts found matching your search.</p>
        </div>
      )}
    </div>
  )
}