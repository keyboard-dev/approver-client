const PROVIDER_DOMAIN_MAP: Record<string, string> = {
  x: 'x.com',
  google: 'google.com',
  github: 'github.com',
  microsoft: 'microsoft.com',
  linear: 'linear.app',
  slack: 'slack.com',
  notion: 'notion.so',
  atlassian: 'atlassian.com',
  attio: 'attio.com',
}

export const getProviderIcon = (logoUrl: string | undefined, providerName: string): string => {
  // Use provided logoUrl, or map provider name to domain, or use provider name as-is
  const baseUrl = logoUrl || PROVIDER_DOMAIN_MAP[providerName.toLowerCase()] || providerName
  return `https://img.logo.dev/${baseUrl}?token=pk_J_hJ3vucTNK-YUVaagza_w&retina=true`
}
