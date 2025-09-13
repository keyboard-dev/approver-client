import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'


export const Prompter: React.FC = () => {
  const { authStatus } = useAuth()




  const [scripts, setScripts] = useState<any[]>([])

  useEffect(() => {
    const getScripts = async () => {
    const scripts = await window.electronAPI.getScripts()
        console.log('scripts', scripts)
      setScripts(scripts)
    }
    try {
        getScripts()
    }
    catch (error) {
      console.error('Error getting scripts:', error)
      setScripts([])
    }
  }, [])

  return (
    <div>
      <h1>Prompter</h1>
      <div className="flex flex-col gap-4">
        {scripts.map((script) => (
          <div key={script.id}>
            <h2>{script.name}</h2>
            <p>{script.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}