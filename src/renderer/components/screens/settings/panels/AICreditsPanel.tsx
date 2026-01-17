import React, { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../components/ui/dialog'
import type { CreditsBalance } from '../../../../../preload'

interface CreditsState {
  loading: boolean
  error: string | null
  balance: CreditsBalance | null
}

const PRESET_AMOUNTS = [5, 10, 20, 50, 100]

export const AICreditsPanel: React.FC = () => {
  const [credits, setCredits] = useState<CreditsState>({
    loading: true,
    error: null,
    balance: null,
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState<number>(20)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const fetchCreditsBalance = useCallback(async () => {
    setCredits(prev => ({ ...prev, loading: true, error: null }))

    const response = await window.electronAPI.getCreditsBalance()

    if (response.success) {
      setCredits({
        loading: false,
        error: null,
        balance: response as CreditsBalance,
      })
    }
    else {
      setCredits({
        loading: false,
        error: 'error' in response ? response.error : 'Failed to fetch balance',
        balance: null,
      })
    }
  }, [])

  useEffect(() => {
    fetchCreditsBalance()
  }, [fetchCreditsBalance])

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getAmountInCents = (): number => {
    if (isCustom) {
      const parsed = parseFloat(customAmount)
      return isNaN(parsed) ? 0 : Math.round(parsed * 100)
    }
    return selectedAmount * 100
  }

  const getDisplayAmount = (): string => {
    if (isCustom) {
      const parsed = parseFloat(customAmount)
      return isNaN(parsed) ? '$0.00' : `$${parsed.toFixed(2)}`
    }
    return `$${selectedAmount.toFixed(2)}`
  }

  const isValidAmount = (): boolean => {
    const cents = getAmountInCents()
    return cents >= 100 && cents <= 100000
  }

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount)
    setIsCustom(false)
    setCustomAmount('')
    setCheckoutError(null)
  }

  const handleCustomInputChange = (value: string) => {
    // Allow only valid numeric input with up to 2 decimal places
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCustomAmount(value)
      setIsCustom(true)
      setCheckoutError(null)
    }
  }

  const handleCheckout = async () => {
    const amountCents = getAmountInCents()

    if (!isValidAmount()) {
      setCheckoutError('Amount must be between $1.00 and $1,000.00')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError(null)

    const response = await window.electronAPI.createCreditsCheckout(amountCents)

    setCheckoutLoading(false)

    if (response.success) {
      setDialogOpen(false)
      // Reset dialog state
      setSelectedAmount(20)
      setCustomAmount('')
      setIsCustom(false)
    }
    else {
      setCheckoutError('error' in response ? response.error : 'Failed to create checkout session')
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      // Reset state when closing
      setSelectedAmount(20)
      setCustomAmount('')
      setIsCustom(false)
      setCheckoutError(null)
    }
  }

  return (
    <div className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem]">
      <div className="text-[1.13rem] px-[0.94rem]">
        AI Credits
      </div>

      {credits.loading && (
        <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex items-center justify-center">
          <div className="text-[#737373]">Loading credits balance...</div>
        </div>
      )}

      {credits.error && (
        <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[0.63rem]">
          <div className="text-red-500">{credits.error}</div>
          <button
            onClick={fetchCreditsBalance}
            className="px-[0.63rem] py-[0.38rem] bg-[#171717] text-white rounded-[0.25rem] w-fit hover:bg-[#404040] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {credits.balance && (
        <>
          {/* Current Balance Card */}
          <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[0.63rem]">
            <div className="flex justify-between items-center">
              <div className="text-[#737373]">Current Balance</div>
              <button
                onClick={fetchCreditsBalance}
                className="text-[#737373] hover:text-[#171717] text-sm transition-colors"
              >
                Refresh
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[2rem] font-semibold text-[#171717]">
                $
                {credits.balance.balance_usd}
              </div>
              <button
                onClick={() => setDialogOpen(true)}
                className="px-[0.75rem] py-[0.5rem] bg-[#171717] text-white rounded-[0.38rem] font-medium hover:bg-[#404040] transition-colors"
              >
                Buy Credits
              </button>
            </div>
          </div>

          {/* Usage Breakdown */}
          <div className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[0.63rem]">
            <div className="text-[#737373]">Usage Breakdown</div>

            <div className="grid grid-cols-3 gap-[0.94rem]">
              <div className="flex flex-col">
                <div className="text-sm text-[#737373]">Total Purchased</div>
                <div className="text-[1.13rem] font-medium text-[#171717]">
                  $
                  {credits.balance.total_purchased_usd}
                </div>
              </div>

              <div className="flex flex-col">
                <div className="text-sm text-[#737373]">Total Earned</div>
                <div className="text-[1.13rem] font-medium text-green-600">
                  $
                  {credits.balance.total_earned_usd}
                </div>
              </div>

              <div className="flex flex-col">
                <div className="text-sm text-[#737373]">Total Spent</div>
                <div className="text-[1.13rem] font-medium text-[#171717]">
                  $
                  {credits.balance.total_spent_usd}
                </div>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="px-[0.94rem] text-sm text-[#737373]">
            Last updated:
            {' '}
            {formatDate(credits.balance.updated_at)}
          </div>
        </>
      )}

      {/* Buy Credits Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle>Buy AI Credits</DialogTitle>
            <DialogDescription>
              Select an amount or enter a custom amount to purchase credits.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-[1rem] py-[1rem]">
            {/* Preset amounts */}
            <div className="flex flex-wrap gap-[0.5rem]">
              {PRESET_AMOUNTS.map(amount => (
                <button
                  key={amount}
                  onClick={() => handlePresetClick(amount)}
                  className={`px-[1rem] py-[0.5rem] rounded-[0.38rem] border transition-colors ${
                    !isCustom && selectedAmount === amount
                      ? 'bg-[#171717] text-white border-[#171717]'
                      : 'bg-white text-[#171717] border-[#E5E5E5] hover:border-[#171717]'
                  }`}
                >
                  $
                  {amount}
                </button>
              ))}
            </div>

            {/* Custom amount input */}
            <div className="flex flex-col gap-[0.5rem]">
              <label className="text-sm text-[#737373]">Custom Amount</label>
              <div className="relative">
                <span className="absolute left-[0.75rem] top-1/2 -translate-y-1/2 text-[#737373]">$</span>
                <input
                  type="text"
                  value={customAmount}
                  onChange={e => handleCustomInputChange(e.target.value)}
                  onFocus={() => setIsCustom(true)}
                  placeholder="Enter amount"
                  className={`w-full pl-[1.5rem] pr-[0.75rem] py-[0.5rem] border rounded-[0.38rem] outline-none transition-colors ${
                    isCustom
                      ? 'border-[#171717]'
                      : 'border-[#E5E5E5] focus:border-[#171717]'
                  }`}
                />
              </div>
              <div className="text-xs text-[#737373]">
                Min: $1.00 · Max: $1,000.00
              </div>
            </div>

            {/* Amount summary */}
            <div className="flex justify-between items-center pt-[0.5rem] border-t border-[#E5E5E5]">
              <span className="text-[#737373]">Total</span>
              <span className="text-[1.25rem] font-semibold text-[#171717]">
                {getDisplayAmount()}
              </span>
            </div>

            {/* Error message */}
            {checkoutError && (
              <div className="text-red-500 text-sm">
                {checkoutError}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-[1rem] py-[0.5rem] text-[#737373] hover:text-[#171717] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || !isValidAmount()}
              className="px-[1rem] py-[0.5rem] bg-[#171717] text-white rounded-[0.38rem] font-medium hover:bg-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? 'Processing...' : 'Continue to Checkout'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
