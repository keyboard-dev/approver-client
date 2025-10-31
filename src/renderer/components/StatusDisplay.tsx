import { useOAuthProviders } from '../hooks/useOAuthProviders'

const StatusDisplay = () => {
  // OAuth providers hook is available for future use

  const { providers, isLoading, error, getGroupedProviders } = useOAuthProviders()
  console.log('providers', providers)
  console.log('isLoading', isLoading)
  console.log('error', error)
  console.log('getGroupedProviders', getGroupedProviders())

  return (
    <div
      className="px-[0.75rem] py-[0.25rem] rounded-full bg-[#EBEBEB] flex items-center gap-[0.63rem]"
    >
      <div
        className="w-[10px] h-[10px] rounded-full bg-[#0B8A1C]"
      />
      <div
        className="text-[#737373]"
      >
        All systems are
        {' '}
        <span className="text-[#0B8A1C] font-semibold">
          normal
        </span>
      </div>
    </div>
  )
}

export default StatusDisplay
