import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { ChevronDown, ChevronUp, Eye, Play, Search, Paperclip, X } from 'lucide-react'
import { Textarea } from "./ui/textarea"
import { ChatInput } from "./ChatInput"

interface Script {
    id: string
    name: string
    description: string
    tags?: string[]
    services?: string[]
    isExpanded?: boolean
}

interface PrompterProps {
    message: any
}

export const Prompter: React.FC<PrompterProps> = ({ message }) => {
    const { authStatus } = useAuth()
    const [scripts, setScripts] = useState<Script[]>([])
    const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set())
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
    const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
    const [messagePrompt, setMessagePrompt] = useState(message?.prompt || '')
    const [attachedFiles, setAttachedFiles] = useState<File[]>([])
    const [attachedImages, setAttachedImages] = useState<File[]>([])

    console.log('message', message)

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
        if(message?.prompt?.trim() === "true") {
        setMessagePrompt(true)
        }
        getScripts()
    }, [])

    // Sync messagePrompt state when message prop changes
    useEffect(() => {
        if (message?.prompt !== undefined) {
            setMessagePrompt(message.prompt)
        }
    }, [message?.prompt])

    // Listen for prompt responses from WebSocket
    useEffect(() => {
        const handlePromptResponse = (event: any, message: any) => {
            console.log('Received prompt response:', message)

            // Check if this response matches our request
            if (message.requestId === currentRequestId) {
                setIsWaitingForResponse(false)
                setCurrentRequestId(null)

                // Handle the prompt response
                if (message.prompt) {
                    console.log('Prompt from client:', message.prompt)
                    // You can handle the prompt here - maybe show it in a dialog or process it
                    alert(`Received prompt: ${message.prompt}`)
                }
            }
        }

        window.electronAPI.onPromptResponse(handlePromptResponse)

        return () => {
            window.electronAPI.removeAllListeners('prompt-response')
        }
    }, [currentRequestId])

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

    const handleAttachFile = (file: File) => {
        setAttachedFiles(prev => [...prev, file])
    }

    const handleAttachImage = (file: File) => {
        setAttachedImages(prev => [...prev, file])
    }

    const removeAttachedFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const removeAttachedImage = (index: number) => {
        setAttachedImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSendMessage = async () => {
        if (messagePrompt.trim() || attachedFiles.length > 0 || attachedImages.length > 0) {
            // TODO: Implement sending message with attachments
            console.log('Sending message:', {
                prompt: messagePrompt,
                files: attachedFiles,
                images: attachedImages
            })
            
            await runSelectedScripts()
            // Clear the input and attachments after sending
            setMessagePrompt('')
            setAttachedFiles([])
            setAttachedImages([])
        }
    }

    const runSelectedScripts = async () => {
        const selected = scripts.filter(script => selectedScripts.has(script.id)).map(script => {
            return {
                id: script.id,
                name: script.name,
                description: script.description
            }
        })
        console.log('Sending prompt request with scripts:', selected)

        try {
            setIsWaitingForResponse(true)

            // Convert File objects to data URLs
            const dataUrls = await Promise.all(
                attachedImages.map(async (file) => {
                    return new Promise<string>((resolve) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(reader.result as string)
                        reader.readAsDataURL(file)
                    })
                })
            )

            // Send the selected scripts to the WebSocket client and get request ID
            const requestId = await window.electronAPI.sendPromptCollectionRequest({
                scripts: selected, 
                prompt: messagePrompt, 
                images: dataUrls
            })
            setCurrentRequestId(requestId)

            console.log('Prompt request sent with ID:', requestId)

            // Don't clear selection yet - wait for response
        } catch (error) {
            console.error('Error sending prompt request:', error)
            setIsWaitingForResponse(false)
            alert('Error: ' + (error as Error).message)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">Keyboard Shortcuts</h1>
                    <p className="text-muted-foreground">Select the relevant Keyboard shortucts scripts you want to run</p>
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

                {selectedScripts.size > 0 ? (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <span className="text-sm font-medium">
                            {selectedScripts.size} script{selectedScripts.size !== 1 ? 's' : ''} selected
                        </span>
                        <Button
                            onClick={runSelectedScripts}
                            size="sm"
                        >
                            <>
                                <Play className="h-4 w-4 mr-2" />
                                Send Prompt Request
                            </>
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <span className="text-sm font-medium">
                            No scripts selected
                        </span>
                        <Button
                            onClick={runSelectedScripts}
                            size="sm"
                        >
                            <>
                                <Play className="h-4 w-4 mr-2" />
                                Skip
                            </>
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
            
            {/* Sticky chat input at bottom */}
            {message.prompt && (
                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Chat Input</h2>
                        
                        {/* Attachment previews */}
                        {(attachedFiles.length > 0 || attachedImages.length > 0) && (
                            <div className="space-y-2">
                                {attachedFiles.map((file, index) => (
                                    <div key={`file-${index}`} className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <Paperclip className="h-4 w-4 text-gray-500" />
                                            <span className="text-sm text-gray-700">{file.name}</span>
                                            <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        <button
                                            onClick={() => removeAttachedFile(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                
                                {attachedImages.map((file, index) => (
                                    <div key={`image-${index}`} className="flex items-center justify-between p-2 bg-gray-100 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <img 
                                                src={URL.createObjectURL(file)} 
                                                alt={file.name}
                                                className="h-8 w-8 object-cover rounded"
                                            />
                                            <span className="text-sm text-gray-700">{file.name}</span>
                                            <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        <button
                                            onClick={() => removeAttachedImage(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <ChatInput
                            value={messagePrompt}
                            onChange={setMessagePrompt}
                            onSend={handleSendMessage}
                            onAttachFile={handleAttachFile}
                            onAttachImage={handleAttachImage}
                            placeholder="Type your message here..."
                        />
                    </div>
                </div>
            )}
        </div>
    )
}