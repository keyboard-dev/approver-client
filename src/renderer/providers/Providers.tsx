import React, { ReactNode } from 'react'
import { AuthProvider } from '../hooks/useAuth'
import { InboxProvider } from '../hooks/useInbox'
import { OAuthProvidersProvider } from '../hooks/useOAuthProviders'
import { PopupProvider } from '../hooks/usePopup'
import { DatabaseProvider } from './DatabaseProvider'

// Define the props interface for our composed providers
interface ProvidersProps {
  children: ReactNode
}

/**
 * Composed Providers Component
 *
 * This component eliminates the "Christmas tree" nesting of providers
 * by using the reduceRight pattern to compose them cleanly.
 *
 * Benefits:
 * - Easy to add/remove providers
 * - Clean, readable structure
 * - Type-safe provider configuration
 * - No deep nesting
 */
export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  // Define provider configurations in a clean array format
  const providers = [
    // DatabaseProvider - handles IndexedDB message storage (must be first)
    { component: DatabaseProvider, props: {} },
    // AuthProvider - handles authentication state
    { component: AuthProvider, props: {} },
    // OAuthProvidersProvider - handles OAuth provider statuses
    { component: OAuthProvidersProvider, props: {} },
    // InboxProvider - handles inbox notifications (updates, expired providers, etc.)
    { component: InboxProvider, props: {} },
    // PopupProvider - handles modal/popup state
    { component: PopupProvider, props: {} },
    // Add new providers here as your app grows:
    // { component: ThemeProvider, props: { theme: 'dark' } },
    // { component: QueryProvider, props: { client: queryClient } },
    // { component: RouterProvider, props: { router } },
  ]

  // Use reduceRight to compose providers without nesting
  return providers.reduceRight(
    (acc, { component: Provider, props }) => (
      <Provider {...props}>{acc}</Provider>
    ),
    children,
  ) as React.ReactElement
}

/**
 * Alternative Implementation: Explicit Provider Composition
 *
 * If you prefer a more explicit approach, you can use this instead:
 */
// export const ExplicitProviders: React.FC<ProvidersProps> = ({ children }) => {
//   return (
//     <AuthProvider>
//       <PopupProvider>
//         {children}
//       </PopupProvider>
//     </AuthProvider>
//   )
// }

/**
 * Advanced Pattern: Provider Factory
 *
 * For even more flexibility, you can create a provider factory:
 */
// type ProviderConfig<T = Record<string, unknown>> = {
//   component: React.ComponentType<T & { children: ReactNode }>
//   props?: Omit<T, 'children'>
// }

// export const createProviders = <T extends Record<string, unknown>>(
//   configs: ProviderConfig[],
// ) => {
//   return ({ children, ...props }: { children: ReactNode } & T) => {
//     return configs.reduceRight(
//       (acc, { component: Provider, props: providerProps = {} }) => (
//         <Provider {...providerProps} {...props}>
//           {acc}
//         </Provider>
//       ),
//       children,
//     ) as React.ReactElement
//   }
// }

// Example usage of the provider factory:
// export const AppProviders = createProviders([
//   { component: AuthProvider },
//   { component: PopupProvider },
//   { component: ThemeProvider, props: { defaultTheme: 'light' } }
// ])
