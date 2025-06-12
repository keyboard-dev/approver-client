class MessageViewer {
    constructor() {
        this.currentMessage = null;
        this.messages = [];
        this.initializeUI();
        this.loadMessages();
        this.setupEventListeners();
    }
    initializeUI() {
        this.messageList = this.getElementById('messageList');
        this.messageDetail = this.getElementById('messageDetail');
        this.emptyState = this.getElementById('emptyState');
        this.messageTitle = this.getElementById('messageTitle');
        this.messageSender = this.getElementById('messageSender');
        this.messageTime = this.getElementById('messageTime');
        this.messagePriority = this.getElementById('messagePriority');
        this.messageBody = this.getElementById('messageBody');
        this.refreshBtn = this.getElementById('refreshBtn');
        this.backBtn = this.getElementById('backBtn');
        this.markReadBtn = this.getElementById('markReadBtn');
        this.deleteBtn = this.getElementById('deleteBtn');
    }
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element with id '${id}' not found`);
        }
        return element;
    }
    setupEventListeners() {
        this.refreshBtn.addEventListener('click', () => this.loadMessages());
        this.backBtn.addEventListener('click', () => this.showMessageList());
        this.markReadBtn.addEventListener('click', () => this.markCurrentMessageRead());
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentMessage());
        window.electronAPI.onShowMessage((event, message) => {
            this.showMessageDetail(message);
        });
    }
    async loadMessages() {
        try {
            this.messages = await window.electronAPI.getMessages();
            this.renderMessageList();
        }
        catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    renderMessageList() {
        const messageItems = this.messageList.querySelectorAll('.message-item');
        messageItems.forEach(item => item.remove());
        if (this.messages.length === 0) {
            this.emptyState.style.display = 'block';
            return;
        }
        this.emptyState.style.display = 'none';
        const sortedMessages = [...this.messages].sort((a, b) => b.timestamp - a.timestamp);
        sortedMessages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            this.messageList.appendChild(messageElement);
        });
    }
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-item ${!message.read ? 'unread' : ''}`;
        messageDiv.addEventListener('click', () => this.showMessageDetail(message));
        const formattedTime = this.formatTime(message.timestamp);
        const preview = message.body.length > 100 ?
            message.body.substring(0, 100) + '...' :
            message.body;
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
        `;
        return messageDiv;
    }
    showMessageDetail(message) {
        this.currentMessage = message;
        this.messageTitle.textContent = message.title;
        this.messageSender.textContent = message.sender ? `From: ${message.sender}` : 'Unknown sender';
        this.messageTime.textContent = this.formatTime(message.timestamp);
        this.messageBody.textContent = message.body;
        if (message.priority) {
            this.messagePriority.textContent = message.priority;
            this.messagePriority.className = `priority-badge ${message.priority}`;
            this.messagePriority.style.display = 'inline-block';
        }
        else {
            this.messagePriority.style.display = 'none';
        }
        this.markReadBtn.textContent = message.read ? '✓ Read' : '✓ Mark Read';
        this.markReadBtn.disabled = !!message.read;
        this.messageDetail.classList.remove('hidden');
    }
    showMessageList() {
        this.messageDetail.classList.add('hidden');
        this.currentMessage = null;
        this.loadMessages();
    }
    async markCurrentMessageRead() {
        if (!this.currentMessage)
            return;
        try {
            await window.electronAPI.markMessageRead(this.currentMessage.id);
            this.currentMessage.read = true;
            this.markReadBtn.textContent = '✓ Read';
            this.markReadBtn.disabled = true;
        }
        catch (error) {
            console.error('Error marking message as read:', error);
        }
    }
    async deleteCurrentMessage() {
        if (!this.currentMessage)
            return;
        if (confirm('Are you sure you want to delete this message?')) {
            try {
                await window.electronAPI.deleteMessage(this.currentMessage.id);
                this.showMessageList();
            }
            catch (error) {
                console.error('Error deleting message:', error);
            }
        }
    }
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        else if (diffInHours < 24 * 7) {
            return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }
        else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    }
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new MessageViewer();
});
export {};
