export const Footer = () => {
  return (
    <div className="mt-[2.5rem]">
      <span className="text-gray-400 dark:text-[#a9a9a9] text-sm font-medium font-inter">Need help? Reach out at </span>
      <span
        className="text-gray-900 dark:text-[#f5f5f5] text-sm font-medium font-inter cursor-pointer hover:underline"
        onClick={() => window.electronAPI.openExternalUrl('mailto:support@keyboard.dev')}
      >
        support@keyboard.dev
      </span>
    </div>
  )
}
