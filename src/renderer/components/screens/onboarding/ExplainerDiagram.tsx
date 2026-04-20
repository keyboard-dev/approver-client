import { Cloud, Link2, Server, Zap } from 'lucide-react'
import React from 'react'

// =============================================================================
// Types
// =============================================================================

type ExplainerType = 'execution-environment' | 'mcp-connection' | 'integrations'

interface ExplainerDiagramProps {
  type: ExplainerType
}

// =============================================================================
// Sub-components
// =============================================================================

const DiagramBox: React.FC<{
  icon: React.ReactNode
  label: string
  highlight?: boolean
}> = ({ icon, label, highlight }) => (
  <div
    className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
      highlight
        ? 'bg-blue-50 border border-blue-200'
        : 'bg-gray-50 border border-gray-200'
    }`}
  >
    <div className={highlight ? 'text-blue-600' : 'text-gray-500'}>
      {icon}
    </div>
    <span className={`text-xs font-medium ${highlight ? 'text-blue-700' : 'text-gray-600'}`}>
      {label}
    </span>
  </div>
)

const Arrow: React.FC = () => (
  <div className="flex items-center px-1">
    <div className="w-4 h-0.5 bg-gray-300" />
    <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 border-l-gray-300" />
  </div>
)

// =============================================================================
// Diagram Content
// =============================================================================

const ExecutionEnvironmentDiagram: React.FC = () => (
  <div className="flex flex-col gap-3">
    <div className="text-sm font-medium text-gray-700">
      Why do I need this?
    </div>
    <div className="text-xs text-gray-600 leading-relaxed">
      AI agents need a secure place to run code and complete tasks. Think of it like giving your assistant their own computer to work on.
    </div>
    <div className="flex items-center justify-center gap-1 py-2">
      <DiagramBox
        icon={<Zap className="w-4 h-4" />}
        label="AI Agent"
      />
      <Arrow />
      <DiagramBox
        icon={<Server className="w-4 h-4" />}
        label="Execution Env"
        highlight
      />
      <Arrow />
      <DiagramBox
        icon={<Cloud className="w-4 h-4" />}
        label="Your Tasks"
      />
    </div>
    <div className="text-xs text-gray-500 text-center italic">
      The execution environment is where your AI agent safely runs code and automation scripts
    </div>
  </div>
)

const McpConnectionDiagram: React.FC = () => (
  <div className="flex flex-col gap-3">
    <div className="text-sm font-medium text-gray-700">
      Why do I need this?
    </div>
    <div className="text-xs text-gray-600 leading-relaxed">
      MCP (Model Context Protocol) is like a translator between your AI assistant and Keyboard's powerful tools.
    </div>
    <div className="flex items-center justify-center gap-1 py-2">
      <DiagramBox
        icon={<Zap className="w-4 h-4" />}
        label="Claude / AI"
      />
      <Arrow />
      <DiagramBox
        icon={<Link2 className="w-4 h-4" />}
        label="MCP"
        highlight
      />
      <Arrow />
      <DiagramBox
        icon={<Server className="w-4 h-4" />}
        label="Keyboard"
      />
    </div>
    <div className="text-xs text-gray-500 text-center italic">
      Connecting MCP lets your AI access Keyboard's automation capabilities
    </div>
  </div>
)

const IntegrationsDiagram: React.FC = () => (
  <div className="flex flex-col gap-3">
    <div className="text-sm font-medium text-gray-700">
      Why do I need this?
    </div>
    <div className="text-xs text-gray-600 leading-relaxed">
      To automate tasks in your apps (like sending emails or updating spreadsheets), Keyboard needs permission to access them on your behalf.
    </div>
    <div className="flex items-center justify-center gap-1 py-2">
      <DiagramBox
        icon={<Server className="w-4 h-4" />}
        label="Keyboard"
      />
      <Arrow />
      <DiagramBox
        icon={<Link2 className="w-4 h-4" />}
        label="Auth"
        highlight
      />
      <Arrow />
      <DiagramBox
        icon={<Cloud className="w-4 h-4" />}
        label="Your Apps"
      />
    </div>
    <div className="text-xs text-gray-500 text-center italic">
      Each app connection lets Keyboard automate workflows in that service
    </div>
  </div>
)

// =============================================================================
// Main Component
// =============================================================================

export const ExplainerDiagram: React.FC<ExplainerDiagramProps> = ({ type }) => {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 border border-gray-200 rounded-lg p-4 w-full">
      {type === 'execution-environment' && <ExecutionEnvironmentDiagram />}
      {type === 'mcp-connection' && <McpConnectionDiagram />}
      {type === 'integrations' && <IntegrationsDiagram />}
    </div>
  )
}

export default ExplainerDiagram
