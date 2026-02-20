import React, { useCallback, useEffect, useState } from 'react'
import { SecurityPolicy, HttpMethod, ApiPathRule } from '../../../../../types/security-policy'
import { Button } from '../../../ui/button'
import { Input } from '../../../ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog'
import { Trash2, Plus, Save, RefreshCw } from 'lucide-react'

// Dialog state types
interface AddItemDialogState {
  open: boolean
  type: 'domain' | 'package' | 'binary' | null
  value: string
}

interface AddApiPathDialogState {
  open: boolean
  domain: string
  path: string
  method: HttpMethod
  allow: boolean
}

export const SecurityPolicyPanel: React.FC = () => {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null)
  const [editingPolicy, setEditingPolicy] = useState<Partial<SecurityPolicy> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isNew, setIsNew] = useState(false)

  // Dialog states
  const [addItemDialog, setAddItemDialog] = useState<AddItemDialogState>({
    open: false,
    type: null,
    value: '',
  })

  const [addApiPathDialog, setAddApiPathDialog] = useState<AddApiPathDialogState>({
    open: false,
    domain: '',
    path: '/*',
    method: 'GET',
    allow: true,
  })

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Load policy on mount
  const loadPolicy = useCallback(async () => {
    setLoading(true)
    try {
      const loadedPolicy = await window.electronAPI.getSecurityPolicy()
      setPolicy(loadedPolicy)
      if (loadedPolicy) {
        setEditingPolicy({ ...loadedPolicy })
        setIsNew(false)
      }
      else {
        // No policy exists, start in create mode
        setEditingPolicy({
          name: 'My Security Policy',
          tier: 'custom',
          allowedDomains: [],
          apiPathRules: {},
          allowedPackages: [],
          allowedBinaries: [],
        })
        setIsNew(true)
      }
    }
    catch (error) {
      setEditingPolicy({
        name: 'My Security Policy',
        tier: 'custom',
        allowedDomains: [],
        apiPathRules: {},
        allowedPackages: [],
        allowedBinaries: [],
      })
      setIsNew(true)
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicy()
  }, [loadPolicy])

  // Save policy (create or update)
  const handleSave = async () => {
    if (!editingPolicy || !editingPolicy.name?.trim()) {
      alert('Policy name is required')
      return
    }

    setSaving(true)
    try {
      // Console.log the finished policy as requested
      let savedPolicy: SecurityPolicy | null
      if (isNew) {
        // Create new policy
        savedPolicy = await window.electronAPI.createSecurityPolicy({
          name: editingPolicy.name,
          tier: editingPolicy.tier || 'custom',
          allowedDomains: editingPolicy.allowedDomains || [],
          apiPathRules: editingPolicy.apiPathRules || {},
          allowedPackages: editingPolicy.allowedPackages || [],
          allowedBinaries: editingPolicy.allowedBinaries || [],
        })
      }
      else {
        // Update existing policy
        savedPolicy = await window.electronAPI.updateSecurityPolicy(editingPolicy)
      }

      if (savedPolicy) {
        setPolicy(savedPolicy)
        setEditingPolicy({ ...savedPolicy })
        setIsNew(false)
      }
    }
    catch (error) {
      alert(`Failed to save policy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    finally {
      setSaving(false)
    }
  }

  // Delete policy
  const handleDelete = async () => {
    try {
      const deleted = await window.electronAPI.deleteSecurityPolicy()
      if (deleted) {
        setPolicy(null)
        setEditingPolicy({
          name: 'My Security Policy',
          tier: 'custom',
          allowedDomains: [],
          apiPathRules: {},
          allowedPackages: [],
          allowedBinaries: [],
        })
        setIsNew(true)
      }
      setDeleteConfirmOpen(false)
    }
    catch (error) {
      alert('Failed to delete policy. Please try again.')
    }
  }

  // Reset changes
  const handleReset = () => {
    if (policy) {
      setEditingPolicy({ ...policy })
    }
    else {
      setEditingPolicy({
        name: 'My Security Policy',
        tier: 'custom',
        allowedDomains: [],
        apiPathRules: {},
        allowedPackages: [],
        allowedBinaries: [],
      })
    }
  }

  // Update editing policy fields
  const updatePolicyField = <K extends keyof SecurityPolicy>(field: K, value: SecurityPolicy[K]) => {
    if (!editingPolicy) return
    setEditingPolicy({
      ...editingPolicy,
      [field]: value,
    })
  }

  // Open add item dialog
  const openAddItemDialog = (type: 'domain' | 'package' | 'binary') => {
    setAddItemDialog({
      open: true,
      type,
      value: '',
    })
  }

  // Handle add item dialog submit
  const handleAddItemSubmit = () => {
    if (!addItemDialog.value.trim() || !editingPolicy || !addItemDialog.type) return

    const fieldMap = {
      domain: 'allowedDomains',
      package: 'allowedPackages',
      binary: 'allowedBinaries',
    } as const

    const field = fieldMap[addItemDialog.type]
    const currentArray = (editingPolicy[field] as string[]) || []
    updatePolicyField(field, [...currentArray, addItemDialog.value.trim()])

    setAddItemDialog({ open: false, type: null, value: '' })
  }

  // Remove item from array field
  const removeArrayItem = (field: 'allowedDomains' | 'allowedPackages' | 'allowedBinaries', index: number) => {
    if (!editingPolicy) return
    const currentArray = (editingPolicy[field] as string[]) || []
    updatePolicyField(field, currentArray.filter((_, i) => i !== index))
  }

  // Open add API path dialog
  const openAddApiPathDialog = () => {
    setAddApiPathDialog({
      open: true,
      domain: '',
      path: '/*',
      method: 'GET',
      allow: true,
    })
  }

  // Handle add API path dialog submit
  const handleAddApiPathSubmit = () => {
    if (!addApiPathDialog.domain.trim() || !editingPolicy) return

    const currentRules = editingPolicy.apiPathRules || {}
    const domainRules = currentRules[addApiPathDialog.domain] || []

    updatePolicyField('apiPathRules', {
      ...currentRules,
      [addApiPathDialog.domain]: [
        ...domainRules,
        {
          method: addApiPathDialog.method,
          path: addApiPathDialog.path || '/*',
          allow: addApiPathDialog.allow,
        },
      ],
    })

    setAddApiPathDialog({
      open: false,
      domain: '',
      path: '/*',
      method: 'GET',
      allow: true,
    })
  }

  // Remove API path rule
  const removeApiPathRule = (domain: string, index: number) => {
    if (!editingPolicy) return
    const currentRules = editingPolicy.apiPathRules || {}
    const domainRules = currentRules[domain] || []

    const updatedDomainRules = domainRules.filter((_, i) => i !== index)

    if (updatedDomainRules.length === 0) {
      const { [domain]: _, ...remainingRules } = currentRules
      updatePolicyField('apiPathRules', remainingRules)
    }
    else {
      updatePolicyField('apiPathRules', {
        ...currentRules,
        [domain]: updatedDomainRules,
      })
    }
  }

  const getDialogTitle = () => {
    switch (addItemDialog.type) {
      case 'domain': return 'Add Domain'
      case 'package': return 'Add Package'
      case 'binary': return 'Add Binary'
      default: return 'Add Item'
    }
  }

  const getDialogDescription = () => {
    switch (addItemDialog.type) {
      case 'domain': return 'Enter the domain that should be allowed (e.g., api.github.com)'
      case 'package': return 'Enter the npm package name (e.g., axios)'
      case 'binary': return 'Enter the binary name (e.g., ffmpeg)'
      default: return ''
    }
  }

  const getDialogPlaceholder = () => {
    switch (addItemDialog.type) {
      case 'domain': return 'api.example.com'
      case 'package': return 'package-name'
      case 'binary': return 'binary-name'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="grow shrink min-w-0 h-full py-[0.5rem] flex items-center justify-center">
        <div className="text-[#737373]">Loading security policy...</div>
      </div>
    )
  }

  return (
    <div className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem] overflow-auto">
      <div className="text-[1.13rem] px-[0.94rem] flex items-center justify-between">
        <span>{isNew ? 'Create Security Policy' : 'Security Policy'}</span>
        <div className="flex gap-[0.5rem]">
          {!isNew && (
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="flex items-center gap-[0.25rem]"
              disabled={saving}
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            size="sm"
            className="flex items-center gap-[0.25rem]"
            disabled={saving || !editingPolicy?.name?.trim()}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : (isNew ? 'Create' : 'Save')}
          </Button>
          {!isNew && (
            <Button
              onClick={() => setDeleteConfirmOpen(true)}
              variant="destructive"
              size="sm"
              className="flex items-center gap-[0.25rem]"
              disabled={saving}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="text-[0.88rem] text-[#737373] px-[0.94rem]">
        Configure your security policy for the 4-layer security system: Domain Control, Language Control, API Path Control, and Package Control.
        {isNew && ' You can have one security policy per account.'}
      </div>

      {editingPolicy && (
        <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[1rem]">
          {/* Basic Info */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="font-semibold">Basic Information</div>
            <div className="flex gap-[0.5rem]">
              <Input
                type="text"
                placeholder="Policy Name"
                value={editingPolicy.name || ''}
                onChange={e => updatePolicyField('name', e.target.value)}
                className="flex-1"
              />
              <select
                value={editingPolicy.tier || 'custom'}
                onChange={e => updatePolicyField('tier', e.target.value)}
                className="px-[0.5rem] py-[0.38rem] border border-input rounded-md bg-background text-sm"
              >
                <option value="free">Free Tier</option>
                <option value="pro">Pro Tier</option>
                <option value="enterprise">Enterprise Tier</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="w-full h-[0.06rem] bg-[#E5E5E5]" />

          {/* Layer 1: Domain Control */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="font-semibold">Layer 1: Allowed Domains</div>
            <div className="text-[0.88rem] text-[#737373]">
              Which external domains can be accessed via HTTP requests
            </div>
            <div className="flex flex-col gap-[0.25rem]">
              {(editingPolicy.allowedDomains || []).map((domain, index) => (
                <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded">
                  <span className="flex-1 text-[0.88rem]">{domain}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem('allowedDomains', index)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => openAddItemDialog('domain')}
                variant="outline"
                size="sm"
                className="flex items-center gap-[0.25rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add Domain
              </Button>
            </div>
          </div>

          <div className="w-full h-[0.06rem] bg-[#E5E5E5]" />

          {/* Layer 3: API Path Control */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="font-semibold">Layer 3: API Path Rules</div>
            <div className="text-[0.88rem] text-[#737373]">
              Fine-grained control over which API endpoints can be called
            </div>
            <div className="flex flex-col gap-[0.5rem]">
              {Object.entries(editingPolicy.apiPathRules || {}).map(([domain, rules]) => (
                <div key={domain} className="border border-[#E5E5E5] rounded p-[0.5rem]">
                  <div className="font-medium text-[0.88rem] mb-[0.25rem]">{domain}</div>
                  {rules.map((rule: ApiPathRule, index: number) => (
                    <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded mb-[0.25rem]">
                      <span className={`px-[0.38rem] py-[0.13rem] rounded text-[0.75rem] font-mono ${rule.allow ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {rule.allow ? 'ALLOW' : 'BLOCK'}
                      </span>
                      <span className="px-[0.38rem] py-[0.13rem] bg-blue-100 text-blue-800 rounded text-[0.75rem] font-mono">
                        {rule.method}
                      </span>
                      <span className="flex-1 text-[0.88rem] font-mono">{rule.path}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeApiPathRule(domain, index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
              <Button
                onClick={openAddApiPathDialog}
                variant="outline"
                size="sm"
                className="flex items-center gap-[0.25rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add API Path Rule
              </Button>
            </div>
          </div>

          <div className="w-full h-[0.06rem] bg-[#E5E5E5]" />

          {/* Layer 4: Package Control */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="font-semibold">Layer 4: Allowed Packages</div>
            <div className="text-[0.88rem] text-[#737373]">
              Which npm packages are available for use
            </div>
            <div className="flex flex-col gap-[0.25rem]">
              {(editingPolicy.allowedPackages || []).map((pkg, index) => (
                <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded">
                  <span className="flex-1 text-[0.88rem] font-mono">{pkg}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem('allowedPackages', index)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => openAddItemDialog('package')}
                variant="outline"
                size="sm"
                className="flex items-center gap-[0.25rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add Package
              </Button>
            </div>
          </div>

          <div className="w-full h-[0.06rem] bg-[#E5E5E5]" />

          {/* Layer 4: Binary Control */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="font-semibold">Layer 4: Allowed Binaries</div>
            <div className="text-[0.88rem] text-[#737373]">
              Which system binaries are available for execution
            </div>
            <div className="flex flex-col gap-[0.25rem]">
              {(editingPolicy.allowedBinaries || []).map((binary, index) => (
                <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded">
                  <span className="flex-1 text-[0.88rem] font-mono">{binary}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem('allowedBinaries', index)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => openAddItemDialog('binary')}
                variant="outline"
                size="sm"
                className="flex items-center gap-[0.25rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add Binary
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Dialog (Domain, Package, Binary) */}
      <Dialog open={addItemDialog.open} onOpenChange={open => setAddItemDialog({ ...addItemDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={getDialogPlaceholder()}
              value={addItemDialog.value}
              onChange={e => setAddItemDialog({ ...addItemDialog, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddItemSubmit()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialog({ open: false, type: null, value: '' })}>
              Cancel
            </Button>
            <Button onClick={handleAddItemSubmit} disabled={!addItemDialog.value.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Path Rule Dialog */}
      <Dialog open={addApiPathDialog.open} onOpenChange={open => setAddApiPathDialog({ ...addApiPathDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Path Rule</DialogTitle>
            <DialogDescription>
              Configure an API path rule for fine-grained endpoint control
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Domain</label>
              <Input
                placeholder="api.example.com"
                value={addApiPathDialog.domain}
                onChange={e => setAddApiPathDialog({ ...addApiPathDialog, domain: e.target.value })}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Path</label>
              <Input
                placeholder="/v1/products/*"
                value={addApiPathDialog.path}
                onChange={e => setAddApiPathDialog({ ...addApiPathDialog, path: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">HTTP Method</label>
              <select
                value={addApiPathDialog.method}
                onChange={e => setAddApiPathDialog({ ...addApiPathDialog, method: e.target.value as HttpMethod })}
                className="px-[0.5rem] py-[0.5rem] border border-input rounded-md bg-background text-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
                <option value="*">* (All Methods)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Action</label>
              <select
                value={addApiPathDialog.allow ? 'allow' : 'block'}
                onChange={e => setAddApiPathDialog({ ...addApiPathDialog, allow: e.target.value === 'allow' })}
                className="px-[0.5rem] py-[0.5rem] border border-input rounded-md bg-background text-sm"
              >
                <option value="allow">Allow</option>
                <option value="block">Block</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddApiPathDialog({ open: false, domain: '', path: '/*', method: 'GET', allow: true })}
            >
              Cancel
            </Button>
            <Button onClick={handleAddApiPathSubmit} disabled={!addApiPathDialog.domain.trim()}>
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Security Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your security policy? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
