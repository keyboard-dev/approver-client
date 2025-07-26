#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
require('@dotenvx/dotenvx').config()
const { execSync } = require('child_process')

console.log('🔍 Checking Apple Developer Code Signing Setup...\n')

try {
  // Check for code signing identities
  console.log('📋 Available Code Signing Identities:')
  const identities = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' })
  console.log(identities)

  // Check if Developer ID Application certificate exists
  const hasDevId = identities.includes('Developer ID Application')
  const hasMacAppStore = identities.includes('Mac Developer') || identities.includes('3rd Party Mac Developer')

  console.log('✅ Certificate Status:')
  console.log(`   Developer ID Application: ${hasDevId ? '✅ Found' : '❌ Missing'}`)
  console.log(`   Mac App Store: ${hasMacAppStore ? '✅ Found' : '❌ Missing'}\n`)

  // Check environment variables
  console.log('🌍 Environment Variables:')
  const requiredEnvVars = ['APPLE_TEAM_ID', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER', 'APPLE_API_KEY', 'CSC_NAME']

  requiredEnvVars.forEach((envVar) => {
    const value = process.env[envVar]
    console.log(`   ${envVar}: ${value ? '✅ Set' : '❌ Missing'}`)
  })

  console.log('\n📝 Next Steps:')
  if (!hasDevId && !hasMacAppStore) {
    console.log('   1. Install Apple Developer certificates in Keychain')
    console.log('   2. See build/code-signing-setup.md for detailed instructions')
  }

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
  if (missingEnvVars.length > 0) {
    console.log('   3. Set missing environment variables in .env file')
    console.log('   4. Update YOUR_TEAM_ID in package.json')
  }

  if (hasDevId && missingEnvVars.length === 0) {
    console.log('   🎉 Ready to build with: npm run build-mac')
  }
}
catch (error) {
  console.error('❌ Error checking certificates:', error.message)
  console.log('\n💡 Make sure you have Xcode and Apple Developer tools installed')
}
