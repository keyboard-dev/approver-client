/**
 * CreditsService handles fetching and managing AI credits balance
 * from the Keyboard API
 */

export interface CreditsBalance {
  success: boolean
  balance_cents: number
  balance_usd: string
  total_earned_cents: number
  total_earned_usd: string
  total_purchased_cents: number
  total_purchased_usd: string
  total_spent_cents: number
  total_spent_usd: string
  created_at: string
  updated_at: string
}

export interface CreditsError {
  success: false
  error: string
}

export type CreditsResponse = CreditsBalance | CreditsError

const CREDITS_API_URL = 'https://api.keyboard.dev/api/credits/balance'

export class CreditsService {
  /**
   * Fetch the current credits balance from the API
   * @param accessToken - The user's access token for authentication
   * @returns The credits balance or an error response
   */
  async getBalance(accessToken: string): Promise<CreditsResponse> {
    try {
      const response = await fetch(CREDITS_API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch credits balance: ${response.statusText}`,
        }
      }

      const data = await response.json() as CreditsBalance
      return data
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}

// Export singleton instance
export const creditsService = new CreditsService()
