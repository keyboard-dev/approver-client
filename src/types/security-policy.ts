/**
 * Security Policy Types
 *
 * Defines the structure for the 4-layer security policy system:
 * 1. Domain Control - Which domains can be accessed
 * 2. Language Control - Which programming languages (Node.js only)
 * 3. API Path Control - Which specific API endpoints
 * 4. Package Control - Which npm packages and binaries
 */

/**
 * HTTP methods for API path rules
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | '*';

/**
 * API path rule for Layer 3: API Path Control
 */
export interface ApiPathRule {
  /** HTTP method (e.g., 'GET', 'POST', or '*' for all) */
  method: HttpMethod;
  /** API path pattern (supports wildcards with *) */
  path: string;
  /** Whether this path is allowed or blocked */
  allow: boolean;
  /** Optional description of what this rule does */
  description?: string;
}

/**
 * API path rules organized by domain
 */
export interface ApiPathRules {
  [domain: string]: ApiPathRule[];
}

/**
 * Complete security policy configuration
 */
export interface SecurityPolicy {
  /** Unique identifier for this policy */
  id?: string;
  /** Human-readable name for this policy */
  name?: string;
  /** Policy tier (e.g., 'free', 'pro', 'enterprise', 'custom') */
  tier?: string;

  /** Layer 1: Domain Control - Allowed domains for HTTP requests */
  allowedDomains: string[];

  /** Layer 3: API Path Control - Path-level filtering per domain */
  apiPathRules: ApiPathRules;

  /** Layer 4: Package Control - Allowed npm packages */
  allowedPackages: string[];

  /** Layer 4: Package Control - Allowed system binaries */
  allowedBinaries: string[];

  /** User who created this policy */
  created_by?: string;
  /** User ID this policy belongs to */
  user_id?: string;
  /** Whether this is an organization-level policy */
  org_policy?: boolean;
  /** Organization ID if applicable */
  org?: string | null;
  /** Team ID if applicable */
  team?: string | null;

  /** Metadata */
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Input type for creating/updating security policies via API
 */
export interface SecurityPolicyInput {
  name?: string;
  tier?: string;
  allowedDomains?: string[];
  apiPathRules?: ApiPathRules;
  allowedPackages?: string[];
  allowedBinaries?: string[];
  org_policy?: boolean;
  org?: string | null;
  team?: string | null;
}

/**
 * Default/empty security policy
 */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  name: 'Default Policy',
  tier: 'custom',
  allowedDomains: [],
  apiPathRules: {},
  allowedPackages: [],
  allowedBinaries: [],
};

/**
 * Example: Free tier policy
 */
export const FREE_TIER_POLICY: SecurityPolicy = {
  name: 'Free Tier',
  tier: 'free',
  allowedDomains: ['api.github.com'],
  apiPathRules: {
    'api.github.com': [
      { method: 'GET', path: '/users/*', allow: true, description: 'Read user profiles' },
      { method: 'GET', path: '/repos/*', allow: true, description: 'Read repositories' },
    ],
  },
  allowedPackages: ['axios', 'lodash'],
  allowedBinaries: [],
};

/**
 * Example: Pro tier policy
 */
export const PRO_TIER_POLICY: SecurityPolicy = {
  name: 'Pro Tier',
  tier: 'pro',
  allowedDomains: ['api.stripe.com', 'api.github.com'],
  apiPathRules: {
    'api.stripe.com': [
      { method: 'GET', path: '/v1/products/*', allow: true, description: 'Read Stripe products' },
      { method: 'POST', path: '/v1/products', allow: true, description: 'Create Stripe products' },
    ],
    'api.github.com': [
      { method: 'GET', path: '/*', allow: true, description: 'Read GitHub API' },
    ],
  },
  allowedPackages: ['stripe', 'axios', 'lodash'],
  allowedBinaries: [],
};

/**
 * Example: Enterprise tier policy
 */
export const ENTERPRISE_TIER_POLICY: SecurityPolicy = {
  name: 'Enterprise Tier',
  tier: 'enterprise',
  allowedDomains: [
    'api.stripe.com',
    'api.openai.com',
    'api.github.com',
    's3.amazonaws.com',
  ],
  apiPathRules: {
    'api.stripe.com': [
      { method: '*', path: '/v1/products/*', allow: true, description: 'Full Stripe products API' },
      { method: '*', path: '/v1/customers/*', allow: true, description: 'Full Stripe customers API' },
    ],
    'api.openai.com': [
      { method: 'POST', path: '/v1/chat/completions', allow: true, description: 'OpenAI chat completions' },
    ],
    'api.github.com': [
      { method: '*', path: '/*', allow: true, description: 'Full GitHub API access' },
    ],
  },
  allowedPackages: ['stripe', 'axios', 'openai', 'aws-sdk'],
  allowedBinaries: ['ffmpeg', 'ffprobe', 'convert'],
};
