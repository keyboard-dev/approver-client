/**
 * SubscriptionsService handles subscription checkout and payment status
 * from the Keyboard API
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

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

const SUBSCRIPTION_CHECKOUT_URL = 'http://localhost:4000/api/payments/subscriptions/checkout'
const PAYMENT_STATUS_URL = 'http://localhost:4000/api/payments/status'
const STORAGE_DIR = path.join(os.homedir(), '.keyboard-mcp')
const HOSTED_SERVER_STATUS_FILE = path.join(STORAGE_DIR, 'hosted-server-status.json')

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
   * First checks local cache file, then falls back to API
   * @param accessToken - The user's access token for authentication
   * @returns The payment status with subscriptions array or an error response
   */
  async getPaymentStatus(accessToken: string): Promise<PaymentStatusResponse> {
    try {
      // Check if cache file exists and has valid status
      if (fs.existsSync(HOSTED_SERVER_STATUS_FILE)) {
        try {
          const cachedData = JSON.parse(fs.readFileSync(HOSTED_SERVER_STATUS_FILE, 'utf-8'))
          if (cachedData.status === true) {
            // Return cached response
            return cachedData as PaymentStatusSuccess
          }
        }
        catch (cacheError) {
          // If cache read fails, continue to API call
        }
      }

      // Cache miss or invalid - fetch from API
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

      // Cache the response if user has subscriptions
      if (data.success && data.subscriptions && data.subscriptions.length > 0) {
        try {
          // Ensure storage directory exists
          if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 })
          }

          // Write cache file with status: true
          const cacheData = {
            ...data,
            status: true,
          }
          fs.writeFileSync(HOSTED_SERVER_STATUS_FILE, JSON.stringify(cacheData, null, 2), {
            mode: 0o600,
          })
        }
        catch (cacheError) {
          // Log but don't fail if cache write fails
        }
      }

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
