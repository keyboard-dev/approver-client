import React, { useCallback, useEffect, useState } from 'react'
import type { CreditsBalance } from '../../../../../preload'

interface CreditsState {
  loading: boolean
  error: string | null
  balance: CreditsBalance | null
}

export const AICreditsPanel: React.FC = () => {
  const [credits, setCredits] = useState<CreditsState>({
    loading: true,
    error: null,
    balance: null,
  })

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
            <div className="text-[2rem] font-semibold text-[#171717]">
              $
              {credits.balance.balance_usd}
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
    </div>
  )
}
