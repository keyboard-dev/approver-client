// Test client for approval functionality
const WebSocket = require('ws');

class ApprovalTestClient {
    constructor() {
        this.ws = null;
        this.connect();
    }

    connect() {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.on('open', () => {
            // Send test approval messages
            setTimeout(() => this.sendApprovalMessages(), 1000);
        });

        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                } catch (error) {
                }
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });

        this.ws.on('close', () => {
            });
    }

    sendApprovalMessages() {
        const messages = [
            {
                id: `approval-${Date.now()}-1`,
                title: 'Code Deployment Request',
                body: 'Request to deploy new feature to production environment.\n\nChanges include:\n- New user authentication system\n- Updated API endpoints\n- Database schema changes\n\nPlease review and approve.',
                timestamp: Date.now(),
                priority: 'high',
                sender: 'CI/CD Pipeline',
                status: 'pending',
                requiresResponse: true
            },
            {
                id: `approval-${Date.now()}-2`,
                title: 'Budget Approval Required',
                body: 'Request approval for additional cloud infrastructure costs.\n\nEstimated monthly increase: $500\nReason: Increased user traffic requires scaling\n\nPlease approve or provide feedback.',
                timestamp: Date.now() + 1000,
                priority: 'normal',
                sender: 'DevOps Team',
                status: 'pending',
                requiresResponse: true
            },
            {
                id: `approval-${Date.now()}-3`,
                title: 'Security Policy Update',
                body: 'New security policy requires approval before implementation.\n\nKey changes:\n- Multi-factor authentication mandatory\n- Password complexity requirements\n- Session timeout reduced to 30 minutes\n\nReview attached policy document.',
                timestamp: Date.now() + 2000,
                priority: 'high',
                sender: 'Security Team',
                status: 'pending',
                requiresResponse: true
            }
        ];

        messages.forEach((message, index) => {
            setTimeout(() => {
                this.ws.send(JSON.stringify(message));
            }, index * 2000);
        });

        // Close connection after all messages are sent
        setTimeout(() => {
            }, messages.length * 2000);
    }
}

// Create the test client
new ApprovalTestClient(); 