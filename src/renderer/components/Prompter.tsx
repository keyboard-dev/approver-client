import React from 'react'
import { useAuth } from '../hooks/useAuth'


export const Prompter: React.FC = () => {
  const { authStatus } = useAuth()


  const getScripts = async () => {
    const scripts = await window.electronAPI.getScripts()
    return scripts
  }

  return (
    <div>
      <h1>Prompter</h1>
    </div>
  )
}