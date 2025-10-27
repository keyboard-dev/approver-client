export const CODE_APPROVAL_ORDER = ['never', 'low', 'medium', 'high'] as const
export type CodeApprovalLevel = typeof CODE_APPROVAL_ORDER[number]

export const RESPONSE_APPROVAL_ORDER = ['never', 'success only', 'always'] as const
export type ResponseApprovalLevel = typeof RESPONSE_APPROVAL_ORDER[number]
