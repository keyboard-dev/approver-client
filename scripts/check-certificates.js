#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
require('@dotenvx/dotenvx').config()
const { execSync } = require('child_process')


try {
  // Check for code signing identities
  const identities = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' })

  // Check if Developer ID Application certificate exists
  const hasDevId = identities.includes('Developer ID Application')
  const hasMacAppStore = identities.includes('Mac Developer') || identities.includes('3rd Party Mac Developer')


  // Check environment variables
  const requiredEnvVars = ['APPLE_TEAM_ID', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER', 'APPLE_API_KEY', 'CSC_NAME']

  requiredEnvVars.forEach((envVar) => {
    const value = process.env[envVar]
  })

  if (!hasDevId && !hasMacAppStore) {
  }

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
  if (missingEnvVars.length > 0) {
  }

  if (hasDevId && missingEnvVars.length === 0) {
  }
}
catch (error) {
  console.error('❌ Error checking certificates:', error.message)
}
