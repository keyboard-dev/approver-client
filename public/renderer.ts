import { ElectronAPI } from '../src/preload'
import { Message } from '../src/types'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Renderer process script
class MessageViewer {
  private currentMessage: Message | null = null
  private messages: Message[] = []

  // DOM elements
  private messageList: HTMLElement
  private messageDetail: HTMLElement
  private emptyState: HTMLElement

  // Detail view elements
  private messageTitle: HTMLElement
  private messageSender: HTMLElement
  private messageTime: HTMLElement
  private messagePriority: HTMLElement
  private messageBody: HTMLElement

  // Buttons
  private refreshBtn: HTMLButtonElement
  private backBtn: HTMLButtonElement
  private markReadBtn: HTMLButtonElement
  private deleteBtn: HTMLButtonElement

  constructor() {
    this.initializeUI()
    this.loadMessages()
    this.setupEventListeners()
  }

  private initializeUI(): void {
    // Get DOM elements
    this.messageList = this.getElementById('messageList')
    this.messageDetail = this.getElementById('messageDetail')
    this.emptyState = this.getElementById('emptyState')

    // Detail view elements
    this.messageTitle = this.getElementById('messageTitle')
    this.messageSender = this.getElementById('messageSender')
    this.messageTime = this.getElementById('messageTime')
    this.messagePriority = this.getElementById('messagePriority')
    this.messageBody = this.getElementById('messageBody')

    // Buttons
    this.refreshBtn = this.getElementById('refreshBtn') as HTMLButtonElement
    this.backBtn = this.getElementById('backBtn') as HTMLButtonElement
    this.markReadBtn = this.getElementById('markReadBtn') as HTMLButtonElement
    this.deleteBtn = this.getElementById('deleteBtn') as HTMLButtonElement
  }

  private getElementById(id: string): HTMLElement {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Element with id '${id}' not found`)
    }
    return element
  }

  private setupEventListeners(): void {
    // Button event listeners
    this.refreshBtn.addEventListener('click', () => this.loadMessages())
    this.backBtn.addEventListener('click', () => this.showMessageList())
    this.markReadBtn.addEventListener('click', () => this.markCurrentMessageRead())
    this.deleteBtn.addEventListener('click', () => this.deleteCurrentMessage())

    // Listen for messages from main process
    window.electronAPI.onShowMessage((event, message) => {
      this.showMessageDetail(message)
    })
  }

  private async loadMessages(): Promise<void> {
    try {
      this.messages = await window.electronAPI.getMessages()
      this.renderMessageList()
    }
    catch (error) {

    }
  }

  private renderMessageList(): void {
    // Clear existing messages except empty state
    const messageItems = this.messageList.querySelectorAll('.message-item')
    messageItems.forEach(item => item.remove())

    if (this.messages.length === 0) {
      this.emptyState.style.display = 'block'
      return
    }

    this.emptyState.style.display = 'none'

    // Sort messages by timestamp (newest first)
    const sortedMessages = [...this.messages].sort((a, b) => b.timestamp - a.timestamp)

    sortedMessages.forEach((message) => {
      const messageElement = this.createMessageElement(message)
      this.messageList.appendChild(messageElement)
    })
  }

  private createMessageElement(message: Message): HTMLElement {
    const messageDiv = document.createElement('div')
    messageDiv.className = `message-item ${!message.read ? 'unread' : ''}`
    messageDiv.addEventListener('click', () => this.showMessageDetail(message))

    const formattedTime = this.formatTime(message.timestamp)
    const preview = message.body.length > 100
      ? message.body.substring(0, 100) + '...'
      : message.body

    messageDiv.innerHTML = `
            <div class="message-item-header">
                <div class="message-item-title">${this.escapeHtml(message.title)}</div>
                <div class="message-item-time">${formattedTime}</div>
            </div>
            <div class="message-item-preview">${this.escapeHtml(preview)}</div>
            <div class="message-item-meta">
                <div class="message-item-sender">${message.sender ? `From: ${this.escapeHtml(message.sender)}` : ''}</div>
                ${message.priority ? `<span class="priority-badge ${message.priority}">${message.priority}</span>` : ''}
            </div>
        `

    return messageDiv
  }

  private showMessageDetail(message: Message): void {
    this.currentMessage = message

    // Populate detail view
    this.messageTitle.textContent = message.title
    this.messageSender.textContent = message.sender ? `From: ${message.sender}` : 'Unknown sender'
    this.messageTime.textContent = this.formatTime(message.timestamp)
    this.messageBody.textContent = message.body

    // Set priority badge
    if (message.priority) {
      this.messagePriority.textContent = message.priority
      this.messagePriority.className = `priority-badge ${message.priority}`
      this.messagePriority.style.display = 'inline-block'
    }
    else {
      this.messagePriority.style.display = 'none'
    }

    // Update mark read button state
    this.markReadBtn.textContent = message.read ? '✓ Read' : '✓ Mark Read'
    this.markReadBtn.disabled = !!message.read

    // Show detail view
    this.messageDetail.classList.remove('hidden')
  }

  private showMessageList(): void {
    this.messageDetail.classList.add('hidden')
    this.currentMessage = null
    // Refresh the list to show updated read status
    this.loadMessages()
  }

  private async markCurrentMessageRead(): Promise<void> {
    if (!this.currentMessage) return

    try {
      await window.electronAPI.markMessageRead(this.currentMessage.id)
      this.currentMessage.read = true
      this.markReadBtn.textContent = '✓ Read'
      this.markReadBtn.disabled = true
    }
    catch (error) {

    }
  }

  private async deleteCurrentMessage(): Promise<void> {
    if (!this.currentMessage) return

    if (confirm('Are you sure you want to delete this message?')) {
      try {
        await window.electronAPI.deleteMessage(this.currentMessage.id)
        this.showMessageList()
      }
      catch (error) {

      }
    }
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    }
    else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize the message viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MessageViewer()
})
