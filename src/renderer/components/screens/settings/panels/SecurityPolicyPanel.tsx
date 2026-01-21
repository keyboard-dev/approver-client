import React, { useCallback, useEffect, useState } from 'react'
import { SecurityPolicy, HttpMethod, ApiPathRule } from '../../../../../types/security-policy'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { Trash2, Plus, Edit2, Save, X } from 'lucide-react'

interface EditingPolicy {
  policy: Partial<SecurityPolicy>
  isNew: boolean
}

export const SecurityPolicyPanel: React.FC = () => {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPolicy, setEditingPolicy] = useState<EditingPolicy | null>(null)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)

  // Load policies on mount
  const loadPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const loadedPolicies = await window.electronAPI.getSecurityPolicies()
      setPolicies(loadedPolicies)
    }
    catch (error) {
      console.error('Failed to load security policies:', error)
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  // Create new policy
  const handleCreateNew = () => {
    setEditingPolicy({
      policy: {
        name: 'New Policy',
        tier: 'custom',
        allowedDomains: [],
        apiPathRules: {},
        allowedPackages: [],
        allowedBinaries: [],
      },
      isNew: true,
    })
    setSelectedPolicyId(null)
  }

  // Edit existing policy
  const handleEdit = (policy: SecurityPolicy) => {
    setEditingPolicy({
      policy: { ...policy },
      isNew: false,
    })
    setSelectedPolicyId(policy.id || null)
  }

  // Save policy (create or update)
  const handleSave = async () => {
    if (!editingPolicy) return

    try {
      if (editingPolicy.isNew) {
        // Create new policy
        await window.electronAPI.createSecurityPolicy(editingPolicy.policy as Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>)
      }
      else if (selectedPolicyId) {
        // Update existing policy
        await window.electronAPI.updateSecurityPolicy(selectedPolicyId, editingPolicy.policy)
      }

      // Reload policies and clear editing state
      await loadPolicies()
      setEditingPolicy(null)
      setSelectedPolicyId(null)
    }
    catch (error) {
      console.error('Failed to save policy:', error)
      alert('Failed to save policy. Please try again.')
    }
  }

  // Delete policy
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return

    try {
      await window.electronAPI.deleteSecurityPolicy(id)
      await loadPolicies()
      if (selectedPolicyId === id) {
        setSelectedPolicyId(null)
        setEditingPolicy(null)
      }
    }
    catch (error) {
      console.error('Failed to delete policy:', error)
      alert('Failed to delete policy. Please try again.')
    }
  }

  // Cancel editing
  const handleCancel = () => {
    setEditingPolicy(null)
    setSelectedPolicyId(null)
  }

  // Update editing policy fields
  const updatePolicyField = <K extends keyof SecurityPolicy>(field: K, value: SecurityPolicy[K]) => {
    if (!editingPolicy) return
    setEditingPolicy({
      ...editingPolicy,
      policy: {
        ...editingPolicy.policy,
        [field]: value,
      },
    })
  }

  // Add item to array field (domains, packages, binaries)
  const addArrayItem = (field: 'allowedDomains' | 'allowedPackages' | 'allowedBinaries') => {
    const value = prompt(`Enter ${field === 'allowedDomains' ? 'domain' : field === 'allowedPackages' ? 'package' : 'binary'}:`)
    if (!value || !editingPolicy) return

    const currentArray = (editingPolicy.policy[field] as string[]) || []
    updatePolicyField(field, [...currentArray, value])
  }

  // Remove item from array field
  const removeArrayItem = (field: 'allowedDomains' | 'allowedPackages' | 'allowedBinaries', index: number) => {
    if (!editingPolicy) return
    const currentArray = (editingPolicy.policy[field] as string[]) || []
    updatePolicyField(field, currentArray.filter((_, i) => i !== index))
  }

  // Add API path rule
  const addApiPathRule = () => {
    const domain = prompt('Enter domain (e.g., api.stripe.com):')
    if (!domain || !editingPolicy) return

    const path = prompt('Enter path (e.g., /v1/products):') || '/*'
    const method = (prompt('Enter HTTP method (GET, POST, etc., or * for all):') || 'GET').toUpperCase() as HttpMethod
    const allow = confirm('Allow this endpoint? (OK = Allow, Cancel = Block)')

    const currentRules = editingPolicy.policy.apiPathRules || {}
    const domainRules = currentRules[domain] || []

    updatePolicyField('apiPathRules', {
      ...currentRules,
      [domain]: [...domainRules, { method, path, allow }],
    })
  }

  // Remove API path rule
  const removeApiPathRule = (domain: string, index: number) => {
    if (!editingPolicy) return
    const currentRules = editingPolicy.policy.apiPathRules || {}
    const domainRules = currentRules[domain] || []

    const updatedDomainRules = domainRules.filter((_, i) => i !== index)

    if (updatedDomainRules.length === 0) {
      // Remove domain entirely if no rules left
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

  if (loading) {
    return (
      <div className="grow shrink min-w-0 h-full py-[0.5rem] flex items-center justify-center">
        <div className="text-[#737373]">Loading security policies...</div>
      </div>
    )
  }

  // If editing a policy
  if (editingPolicy) {
    return (
      <div className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem] overflow-auto">
        <div className="text-[1.13rem] px-[0.94rem] flex items-center justify-between">
          <span>{editingPolicy.isNew ? 'Create New Policy' : 'Edit Policy'}</span>
          <div className="flex gap-[0.5rem]">
            <ButtonDesigned
              onClick={handleSave}
              className="flex items-center gap-[0.25rem] px-[0.75rem] py-[0.38rem] text-[0.88rem]"
            >
              <Save className="w-4 h-4" />
              Save
            </ButtonDesigned>
            <ButtonDesigned
              onClick={handleCancel}
              className="flex items-center gap-[0.25rem] px-[0.75rem] py-[0.38rem] text-[0.88rem] bg-gray-300 hover:bg-gray-400"
            >
              <X className="w-4 h-4" />
              Cancel
            </ButtonDesigned>
          </div>
        </div>

        <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[1rem]">
          {/* Basic Info */}
          <div className="flex flex-col gap-[0.5rem]">
            <div className="font-semibold">Basic Information</div>
            <div className="flex gap-[0.5rem]">
              <input
                type="text"
                placeholder="Policy Name"
                value={editingPolicy.policy.name || ''}
                onChange={(e) => updatePolicyField('name', e.target.value)}
                className="flex-1 px-[0.5rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem]"
              />
              <select
                value={editingPolicy.policy.tier || 'custom'}
                onChange={(e) => updatePolicyField('tier', e.target.value)}
                className="px-[0.5rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem]"
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
              {(editingPolicy.policy.allowedDomains || []).map((domain, index) => (
                <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded">
                  <span className="flex-1 text-[0.88rem]">{domain}</span>
                  <button
                    onClick={() => removeArrayItem('allowedDomains', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <ButtonDesigned
                onClick={() => addArrayItem('allowedDomains')}
                className="flex items-center gap-[0.25rem] px-[0.5rem] py-[0.25rem] text-[0.88rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add Domain
              </ButtonDesigned>
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
              {Object.entries(editingPolicy.policy.apiPathRules || {}).map(([domain, rules]) => (
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
                      <button
                        onClick={() => removeApiPathRule(domain, index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              <ButtonDesigned
                onClick={addApiPathRule}
                className="flex items-center gap-[0.25rem] px-[0.5rem] py-[0.25rem] text-[0.88rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add API Path Rule
              </ButtonDesigned>
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
              {(editingPolicy.policy.allowedPackages || []).map((pkg, index) => (
                <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded">
                  <span className="flex-1 text-[0.88rem] font-mono">{pkg}</span>
                  <button
                    onClick={() => removeArrayItem('allowedPackages', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <ButtonDesigned
                onClick={() => addArrayItem('allowedPackages')}
                className="flex items-center gap-[0.25rem] px-[0.5rem] py-[0.25rem] text-[0.88rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add Package
              </ButtonDesigned>
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
              {(editingPolicy.policy.allowedBinaries || []).map((binary, index) => (
                <div key={index} className="flex items-center gap-[0.5rem] px-[0.5rem] py-[0.25rem] bg-gray-50 rounded">
                  <span className="flex-1 text-[0.88rem] font-mono">{binary}</span>
                  <button
                    onClick={() => removeArrayItem('allowedBinaries', index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <ButtonDesigned
                onClick={() => addArrayItem('allowedBinaries')}
                className="flex items-center gap-[0.25rem] px-[0.5rem] py-[0.25rem] text-[0.88rem] w-fit"
              >
                <Plus className="w-4 h-4" />
                Add Binary
              </ButtonDesigned>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]">
      <div className="text-[1.13rem] px-[0.94rem] flex items-center justify-between">
        <span>Security Policies</span>
        <ButtonDesigned
          onClick={handleCreateNew}
          className="flex items-center gap-[0.25rem] px-[0.75rem] py-[0.38rem] text-[0.88rem]"
        >
          <Plus className="w-4 h-4" />
          Create New Policy
        </ButtonDesigned>
      </div>

      <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[0.5rem]">
        <div className="text-[0.88rem] text-[#737373] mb-[0.5rem]">
          Configure security policies for your 4-layer security system: Domain Control, Language Control, API Path Control, and Package Control.
        </div>

        {policies.length === 0 ? (
          <div className="text-center py-[2rem] text-[#737373]">
            No security policies configured yet. Create your first policy to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-[0.5rem]">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="p-[0.75rem] border border-[#E5E5E5] rounded-[0.25rem] hover:border-[#A3A3A3] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-[0.5rem] mb-[0.25rem]">
                      <span className="font-semibold">{policy.name || 'Untitled Policy'}</span>
                      {policy.tier && (
                        <span className="px-[0.38rem] py-[0.13rem] bg-blue-100 text-blue-800 rounded text-[0.75rem] uppercase">
                          {policy.tier}
                        </span>
                      )}
                    </div>
                    <div className="text-[0.88rem] text-[#737373] flex gap-[1rem]">
                      <span>{policy.allowedDomains.length} domains</span>
                      <span>{Object.keys(policy.apiPathRules).length} API rules</span>
                      <span>{policy.allowedPackages.length} packages</span>
                      <span>{policy.allowedBinaries.length} binaries</span>
                    </div>
                  </div>
                  <div className="flex gap-[0.5rem]">
                    <button
                      onClick={() => handleEdit(policy)}
                      className="p-[0.38rem] text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Edit policy"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => policy.id && handleDelete(policy.id)}
                      className="p-[0.38rem] text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      title="Delete policy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
