export const getProviderIcon = (logoUrl: string | undefined, providerName: string): string => {
  const baseUrl = logoUrl || providerName
  return `https://img.logo.dev/${baseUrl}?token=pk_J_hJ3vucTNK-YUVaagza_w&retina=true`
}