import * as crypto from 'crypto';

export interface OAuthProvider {
  id: string;
  name: string;
  icon?: string;
  clientId: string;
  clientSecret?: string; // Some providers don't require client secret for PKCE
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  usePKCE: boolean;
  redirectUri: string;
  additionalParams?: Record<string, string>;
}

export interface ProviderTokens {
  providerId: string;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  scope?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    [key: string]: any; // Allow provider-specific user data
  };
}

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  providerId: string;
  sessionId?: string; // For server providers
}

// Simple interface for server providers
export interface ServerProvider {
  id: string;
  name: string;
  url: string; // e.g., "http://localhost:4000"
}

// Response from server authorize endpoint
export interface ServerAuthorizeResponse {
  success: boolean;
  provider: string;
  authorization_url: string;
  session_id: string;
  state: string;
  redirect_uri: string;
  use_pkce: boolean;
  expires_in: number;
}

// Response from server providers endpoint
export interface ServerProviderInfo {
  name: string;
  scopes: string[];
  configured: boolean;
}

export interface ServerProvidersResponse {
  success: boolean;
  count: number;
  providers: ServerProviderInfo[];
  redirect_uri: string;
}

// Provider configurations
export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  google: {
    id: 'google',
    name: 'Google',
    icon: '🔍',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo',
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive.file'
    ],
    usePKCE: true,
    redirectUri: 'http://localhost:8082/callback',
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent'
    }
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'repo'],
    usePKCE: false, // GitHub doesn't support PKCE yet
    redirectUri: 'http://localhost:8082/callback'
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    icon: '🪟',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    usePKCE: true,
    redirectUri: 'http://localhost:8082/callback'
  }
};

export class OAuthProviderManager {
  private customProtocol: string;
  private serverProviders: Map<string, ServerProvider> = new Map();

  constructor(customProtocol: string = 'mcpauth') {
    this.customProtocol = customProtocol;
  }

  /**
   * Get a provider configuration by ID
   */
  getProvider(providerId: string): OAuthProvider | null {
    return OAUTH_PROVIDERS[providerId] || null;
  }

  /**
   * Get all available providers that have client IDs configured
   */
  getAvailableProviders(): OAuthProvider[] {
    return Object.values(OAUTH_PROVIDERS).filter(provider => provider.clientId);
  }

  /**
   * Generate PKCE parameters for OAuth flow
   */
  generatePKCE(providerId: string): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    return {
      codeVerifier,
      codeChallenge,
      state,
      providerId
    };
  }

  /**
   * Build authorization URL for a provider
   */
  buildAuthorizationUrl(provider: OAuthProvider, pkceParams?: PKCEParams): string {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scopes.join(' '),
      response_type: 'code',
      state: pkceParams?.state || crypto.randomBytes(16).toString('hex')
    });

    // Add PKCE parameters if the provider supports it
    if (provider.usePKCE && pkceParams) {
      params.append('code_challenge', pkceParams.codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    // Add additional provider-specific parameters
    if (provider.additionalParams) {
      for (const [key, value] of Object.entries(provider.additionalParams)) {
        params.append(key, value);
      }
    }

    return `${provider.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    provider: OAuthProvider, 
    code: string, 
    pkceParams?: PKCEParams
  ): Promise<ProviderTokens> {
    const body: Record<string, string> = {
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      code: code,
      grant_type: 'authorization_code'
    };

    // Add client secret if provider requires it
    if (provider.clientSecret) {
      body.client_secret = provider.clientSecret;
    }

    // Add PKCE verifier if provider supports it
    if (provider.usePKCE && pkceParams) {
      body.code_verifier = pkceParams.codeVerifier;
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(body).toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json() as any;

    // Fetch user info if userInfoUrl is provided
    let userData = null;
    if (provider.userInfoUrl && tokenData.access_token) {
      try {
        const userResponse = await fetch(provider.userInfoUrl, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });

        if (userResponse.ok) {
          userData = await userResponse.json();
          userData = this.normalizeUserData(provider.id, userData);
        }
      } catch (error) {
        console.warn(`Failed to fetch user info for ${provider.id}:`, error);
      }
    }

    return {
      providerId: provider.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type || 'Bearer',
      expires_in: tokenData.expires_in || 3600,
      expires_at: Date.now() + ((tokenData.expires_in || 3600) * 1000),
      scope: tokenData.scope,
      user: userData
    };
  }

  /**
   * Refresh tokens for a provider
   */
  async refreshTokens(provider: OAuthProvider, refreshToken: string): Promise<ProviderTokens> {
    const body: Record<string, string> = {
      client_id: provider.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    if (provider.clientSecret) {
      body.client_secret = provider.clientSecret;
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(body).toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json() as any;

    return {
      providerId: provider.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken, // Some providers don't return new refresh token
      token_type: tokenData.token_type || 'Bearer',
      expires_in: tokenData.expires_in || 3600,
      expires_at: Date.now() + ((tokenData.expires_in || 3600) * 1000),
      scope: tokenData.scope
    };
  }

  /**
   * Add a server provider
   */
  addServerProvider(server: ServerProvider): void {
    this.serverProviders.set(server.id, server);
    console.log(`🔗 Added server provider: ${server.name} at ${server.url}`);
  }

  /**
   * Remove a server provider
   */
  removeServerProvider(serverId: string): void {
    const server = this.serverProviders.get(serverId);
    if (server) {
      this.serverProviders.delete(serverId);
      console.log(`🗑️ Removed server provider: ${server.name}`);
    }
  }

  /**
   * Get all server providers
   */
  getServerProviders(): ServerProvider[] {
    return Array.from(this.serverProviders.values());
  }

  /**
   * Fetch available OAuth providers from a server provider
   */
  async fetchServerProviders(serverId: string, accessToken?: string): Promise<ServerProviderInfo[]> {
    const server = this.serverProviders.get(serverId);
    if (!server) {
      throw new Error(`Server provider ${serverId} not found`);
    }

    const url = `${server.url}/api/oauth/providers`;
    
    console.log(`🔍 Fetching providers from: ${url}`);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };

      // Add JWT authentication if access token is provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as ServerProvidersResponse;
      
      if (!data.success) {
        throw new Error('Server returned unsuccessful response');
      }

      console.log(`✅ Found ${data.count} providers from ${server.name}:`, data.providers.map(p => p.name));
      
      return data.providers;
    } catch (error) {
      console.error(`❌ Failed to fetch providers from ${server.name}:`, error);
      throw error;
    }
  }

  /**
   * Get a server provider by ID
   */
  getServerProvider(serverId: string): ServerProvider | null {
    return this.serverProviders.get(serverId) || null;
  }

  /**
   * Fetch authorization URL from a server provider
   */
  async fetchServerAuthorizationUrl(
    serverId: string, 
    provider: string, 
    state?: string,
    accessToken?: string
  ): Promise<{ authUrl: string; sessionId: string; state: string }> {
    const server = this.serverProviders.get(serverId);
    if (!server) {
      throw new Error(`Server provider ${serverId} not found`);
    }

    const url = `${server.url}/api/oauth/authorize/${provider}`;
    const params = new URLSearchParams();
    
    if (state) {
      params.append('state', state);
    }
    
    const fullUrl = `${url}?${params.toString()}`;
    
    console.log(`🔗 Fetching authorization URL from: ${fullUrl}`);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };

      // Add JWT authentication if access token is provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as ServerAuthorizeResponse;
      
      if (!data.success) {
        throw new Error('Server returned unsuccessful response');
      }

      console.log(`✅ Got authorization URL from server: ${data.authorization_url.substring(0, 100)}...`);
      
      return {
        authUrl: data.authorization_url,
        sessionId: data.session_id,
        state: data.state
      };
    } catch (error) {
      console.error(`❌ Failed to fetch authorization URL from ${server.name}:`, error);
      throw error;
    }
  }

  /**
   * Exchange code for tokens using server provider
   */
  async exchangeServerCodeForTokens(
    serverId: string,
    provider: string,
    code: string,
    state: string,
    sessionId: string,
    accessToken?: string
  ): Promise<ProviderTokens> {
    const server = this.serverProviders.get(serverId);
    if (!server) {
      throw new Error(`Server provider ${serverId} not found`);
    }

    const url = `${server.url}/api/oauth/token/${provider}`;
    
    const body = {
      code: code,
      state: state,
      session_id: sessionId,
      grant_type: 'authorization_code'
    };

    console.log(`🔄 Exchanging code with server: ${url}`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add JWT authentication if access token is provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json() as any;

      if (!tokenData.success) {
        throw new Error('Server token exchange was unsuccessful');
      }

      console.log(`✅ Successfully exchanged code for tokens via ${server.name}`);

      return {
        providerId: provider, // Use just the provider name (e.g., "google") instead of combined ID
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in || 3600,
        expires_at: Date.now() + ((tokenData.expires_in || 3600) * 1000),
        scope: tokenData.scope,
        user: tokenData.user
      };
    } catch (error) {
      console.error(`❌ Token exchange failed with ${server.name}:`, error);
      throw error;
    }
  }

  /**
   * Normalize user data from different providers to a common format
   */
  private normalizeUserData(providerId: string, userData: any): any {
    switch (providerId) {
      case 'google':
        return {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          firstName: userData.given_name,
          lastName: userData.family_name,
          picture: userData.picture,
          verified_email: userData.verified_email,
          locale: userData.locale
        };
      
      case 'github':
        return {
          id: userData.id?.toString(),
          email: userData.email,
          name: userData.name || userData.login,
          firstName: userData.name?.split(' ')[0],
          lastName: userData.name?.split(' ').slice(1).join(' '),
          picture: userData.avatar_url,
          login: userData.login,
          company: userData.company,
          location: userData.location
        };
      
      case 'microsoft':
        return {
          id: userData.id,
          email: userData.mail || userData.userPrincipalName,
          name: userData.displayName,
          firstName: userData.givenName,
          lastName: userData.surname,
          picture: userData.photo,
          jobTitle: userData.jobTitle,
          department: userData.department
        };
      
      default:
        return userData;
    }
  }
} 