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

export interface CheckoutSuccess {
  success: true
  checkout_url: string
  session_id: string
}

export interface CheckoutError {
  success: false
  error: string
}

export type CheckoutResponse = CheckoutSuccess | CheckoutError

const CREDITS_API_URL = 'https://api.keyboard.dev/api/credits/balance'
const CHECKOUT_API_URL = 'https://api.keyboard.dev/api/payments/checkout/custom'

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

  /**
   * Create a Stripe checkout session for purchasing credits
   * @param accessToken - The user's access token for authentication
   * @param amountCents - The amount in cents to purchase (min 100, max 100000)
   * @returns The checkout URL or an error response
   */
  async createCheckoutSession(accessToken: string, amountCents: number): Promise<CheckoutResponse> {
    try {
      if (amountCents < 100 || amountCents > 100000) {
        return {
          success: false,
          error: 'Amount must be between $1.00 and $1,000.00',
        }
      }

      const response = await fetch(CHECKOUT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount_cents: amountCents }),
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to create checkout session: ${response.statusText}`,
        }
      }

      const data = await response.json() as CheckoutSuccess
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
