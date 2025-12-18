/**
 * SubscriptionsService handles subscription checkout and payment status
 * from the Keyboard API
 */

export interface SubscriptionCheckoutSuccess {
  success: true
  checkout_url: string
  session_id: string
}

export interface SubscriptionCheckoutError {
  success: false
  error: string
}

export type SubscriptionCheckoutResponse = SubscriptionCheckoutSuccess | SubscriptionCheckoutError

export interface Subscription {
  id: string
  status: string
  plan: string
  [key: string]: unknown
}

export interface PaymentStatusSuccess {
  success: true
  subscriptions: Subscription[]
  [key: string]: unknown
}

export interface PaymentStatusError {
  success: false
  error: string
}

export type PaymentStatusResponse = PaymentStatusSuccess | PaymentStatusError

const SUBSCRIPTION_CHECKOUT_URL = 'https://api.keyboard.dev/api/payments/subscriptions/checkout'
const PAYMENT_STATUS_URL = 'https://api.keyboard.dev/api/payments/status'

export class SubscriptionsService {
  /**
   * Create a subscription checkout session
   * @param accessToken - The user's access token for authentication
   * @returns The checkout URL or an error response
   */
  async createCheckoutSession(accessToken: string): Promise<SubscriptionCheckoutResponse> {
    try {
      const response = await fetch(SUBSCRIPTION_CHECKOUT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to create checkout session: ${response.statusText}`,
        }
      }

      const data = await response.json() as SubscriptionCheckoutSuccess
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
   * Get the current payment status including active subscriptions
   * @param accessToken - The user's access token for authentication
   * @returns The payment status with subscriptions array or an error response
   */
  async getPaymentStatus(accessToken: string): Promise<PaymentStatusResponse> {
    try {
      const response = await fetch(PAYMENT_STATUS_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch payment status: ${response.statusText}`,
        }
      }

      const data = await response.json() as PaymentStatusSuccess
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
export const subscriptionsService = new SubscriptionsService()
