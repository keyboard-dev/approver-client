import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface AbilityCategory {
  name: string
  description: string
  abilities: Tool[]
  subcategories: Record<string, AbilityCategory>
}

export interface AbilityPath {
  category: string
  subcategory?: string
  abilityName: string
}

/**
 * Filesystem-like organization for MCP abilities
 * Organizes abilities into hierarchical categories for better discovery
 */
export class AbilityFilesystem {
  private root: AbilityCategory = {
    name: 'root',
    description: 'Root directory of all abilities',
    abilities: [],
    subcategories: {},
  }

  private abilityIndex: Map<string, AbilityPath> = new Map()

  constructor(abilities: Tool[] = []) {
    this.organizeAbilities(abilities)
  }

  /**
   * Organize abilities into filesystem structure
   */
  organizeAbilities(abilities: Tool[]): void {
    this.root = {
      name: 'root',
      description: 'Root directory of all abilities',
      abilities: [],
      subcategories: {},
    }
    this.abilityIndex.clear()

    for (const ability of abilities) {
      const path = this.classifyAbility(ability)
      this.addAbilityToPath(ability, path)
    }
  }

  /**
   * Classify ability into appropriate filesystem path
   */
  private classifyAbility(ability: Tool): AbilityPath {
    const name = ability.name.toLowerCase()
    
    // GitHub/Git operations
    if (name.includes('github') || name.includes('git') || name.includes('codespace') || name.includes('repo')) {
      if (name.includes('codespace')) {
        return { category: 'github', subcategory: 'codespaces', abilityName: ability.name }
      } else if (name.includes('workflow') || name.includes('action')) {
        return { category: 'github', subcategory: 'workflows', abilityName: ability.name }
      } else {
        return { category: 'github', subcategory: 'repos', abilityName: ability.name }
      }
    }

    // File operations
    if (name.includes('file') || name.includes('read') || name.includes('write') || name.includes('edit')) {
      if (name.includes('app') || name.includes('template')) {
        return { category: 'files', subcategory: 'app-management', abilityName: ability.name }
      } else {
        return { category: 'files', subcategory: 'operations', abilityName: ability.name }
      }
    }

    // Code execution and building
    if (name.includes('run') || name.includes('execute') || name.includes('build') || name.includes('command')) {
      if (name.includes('background') || name.includes('job')) {
        return { category: 'execution', subcategory: 'background', abilityName: ability.name }
      } else {
        return { category: 'execution', subcategory: 'direct', abilityName: ability.name }
      }
    }

    // Web and network operations
    if (name.includes('fetch') || name.includes('web') || name.includes('http') || name.includes('url')) {
      return { category: 'web', subcategory: 'requests', abilityName: ability.name }
    }

    // Search and discovery
    if (name.includes('search') || name.includes('find') || name.includes('list') || name.includes('get')) {
      if (name.includes('api') || name.includes('service')) {
        return { category: 'discovery', subcategory: 'api', abilityName: ability.name }
      } else {
        return { category: 'discovery', subcategory: 'general', abilityName: ability.name }
      }
    }

    // Planning and management
    if (name.includes('plan') || name.includes('todo') || name.includes('task')) {
      return { category: 'planning', subcategory: 'tasks', abilityName: ability.name }
    }

    // Debug and monitoring
    if (name.includes('debug') || name.includes('monitor') || name.includes('log') || name.includes('trace')) {
      return { category: 'debug', subcategory: 'monitoring', abilityName: ability.name }
    }

    // Default to utilities
    return { category: 'utilities', subcategory: 'misc', abilityName: ability.name }
  }

  /**
   * Add ability to specific path in filesystem
   */
  private addAbilityToPath(ability: Tool, path: AbilityPath): void {
    // Ensure category exists
    if (!this.root.subcategories[path.category]) {
      this.root.subcategories[path.category] = {
        name: path.category,
        description: this.getCategoryDescription(path.category),
        abilities: [],
        subcategories: {},
      }
    }

    const category = this.root.subcategories[path.category]

    if (path.subcategory) {
      // Ensure subcategory exists
      if (!category.subcategories[path.subcategory]) {
        category.subcategories[path.subcategory] = {
          name: path.subcategory,
          description: this.getSubcategoryDescription(path.category, path.subcategory),
          abilities: [],
          subcategories: {},
        }
      }

      // Add ability to subcategory
      category.subcategories[path.subcategory].abilities.push(ability)
    } else {
      // Add ability directly to category
      category.abilities.push(ability)
    }

    // Index the ability for quick lookup
    this.abilityIndex.set(ability.name, path)
  }

  /**
   * Get abilities in a specific directory
   */
  listDirectory(path: string = '/'): AbilityCategory | null {
    const parts = path.split('/').filter(p => p)
    
    if (parts.length === 0) {
      return this.root
    }

    let current = this.root
    for (const part of parts) {
      if (current.subcategories[part]) {
        current = current.subcategories[part]
      } else {
        return null
      }
    }

    return current
  }

  /**
   * Get abilities by category
   */
  getAbilitiesByCategory(category: string): Tool[] {
    const categoryNode = this.root.subcategories[category]
    if (!categoryNode) return []

    const abilities: Tool[] = [...categoryNode.abilities]
    
    // Include abilities from subcategories
    for (const subcategory of Object.values(categoryNode.subcategories)) {
      abilities.push(...subcategory.abilities)
    }

    return abilities
  }

  /**
   * Get available categories
   */
  getCategories(): Array<{ name: string, description: string, abilityCount: number }> {
    return Object.values(this.root.subcategories).map(category => ({
      name: category.name,
      description: category.description,
      abilityCount: this.countAbilitiesInCategory(category),
    }))
  }

  /**
   * Find ability by path
   */
  findAbility(abilityName: string): { ability: Tool, path: AbilityPath } | null {
    const path = this.abilityIndex.get(abilityName)
    if (!path) return null

    const category = this.root.subcategories[path.category]
    if (!category) return null

    let ability: Tool | undefined

    if (path.subcategory) {
      const subcategory = category.subcategories[path.subcategory]
      if (subcategory) {
        ability = subcategory.abilities.find(a => a.name === abilityName)
      }
    } else {
      ability = category.abilities.find(a => a.name === abilityName)
    }

    return ability ? { ability, path } : null
  }

  /**
   * Get filesystem-style listing for display
   */
  getDirectoryListing(path: string = '/'): string {
    const directory = this.listDirectory(path)
    if (!directory) return 'Directory not found'

    let listing = `📁 /${path}\n`

    // List subcategories
    for (const [name, subcategory] of Object.entries(directory.subcategories)) {
      const abilityCount = this.countAbilitiesInCategory(subcategory)
      listing += `  📂 ${name}/ (${abilityCount} abilities) - ${subcategory.description}\n`
    }

    // List abilities in current directory
    if (directory.abilities.length > 0) {
      listing += '  📄 Abilities:\n'
      for (const ability of directory.abilities) {
        listing += `    🔧 ${ability.name} - ${ability.description || 'No description'}\n`
      }
    }

    return listing
  }

  /**
   * Count abilities in category (including subcategories)
   */
  private countAbilitiesInCategory(category: AbilityCategory): number {
    let count = category.abilities.length
    for (const subcategory of Object.values(category.subcategories)) {
      count += this.countAbilitiesInCategory(subcategory)
    }
    return count
  }

  /**
   * Get category description
   */
  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      github: 'GitHub and repository operations',
      files: 'File system operations and app management',
      execution: 'Code execution and command running',
      web: 'Web requests and network operations', 
      discovery: 'Search and discovery abilities',
      planning: 'Task planning and management',
      debug: 'Debugging and monitoring abilities',
      utilities: 'General utility abilities',
    }
    return descriptions[category] || `${category} abilities`
  }

  /**
   * Get subcategory description
   */
  private getSubcategoryDescription(category: string, subcategory: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      github: {
        codespaces: 'GitHub Codespaces management',
        workflows: 'GitHub Actions and workflows',
        repos: 'Repository operations',
      },
      files: {
        'app-management': 'Application file management',
        operations: 'Basic file operations',
      },
      execution: {
        background: 'Background job execution',
        direct: 'Direct command execution',
      },
      web: {
        requests: 'HTTP requests and web fetching',
      },
      discovery: {
        api: 'API and service discovery',
        general: 'General search and listing',
      },
      planning: {
        tasks: 'Task and todo management',
      },
      debug: {
        monitoring: 'Monitoring and debugging',
      },
    }
    return descriptions[category]?.[subcategory] || `${category} ${subcategory}`
  }
}