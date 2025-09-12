export const Footer = () => {
    return (
        <div style={{ marginTop: 'auto' }} className="w-full max-w-md text-center">
            <span className="text-gray-400 text-sm font-medium font-inter">Need help? </span>
            <span
                className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
                onClick={() => window.electronAPI.openExternal('https://discord.com/invite/UxsRWtV6M2')}
            >
                Ask in our Discord
            </span>
            <span className="text-gray-400 text-sm font-medium font-inter"> or read the </span>
            <span
                className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
                onClick={() => window.electronAPI.openExternal('https://docs.keyboard.dev')}
            >
                docs
            </span>
            <span className="text-gray-400 text-sm font-medium font-inter">.</span>
        </div>
    )
}