/* eslint-disable custom/no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const BUILD_START_TIME = Date.now()

// Build step patterns to detect
const STEP_PATTERNS = [
  { pattern: /loaded configuration/i, name: 'Configuration loaded' },
  { pattern: /packaging.*arch=x64/i, name: 'Packaging x64' },
  { pattern: /packaging.*arch=ia32/i, name: 'Packaging ia32' },
  { pattern: /packaging.*arch=arm64/i, name: 'Packaging arm64' },
  { pattern: /building.*target=nsis/i, name: 'Building NSIS installer' },
  { pattern: /building block map/i, name: 'Building block map' },
]

// Tracking state
let currentStep = null
let stepStartTime = null
let lastOutputTime = Date.now()

/**
 * Format elapsed time as HH:MM:SS
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
function formatTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format duration in human readable format
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Get current elapsed time since build start
 * @returns {string}
 */
function getElapsed() {
  return formatTimestamp(Date.now() - BUILD_START_TIME)
}

/**
 * Print a timestamped message
 * @param {string} message - Message to print
 */
function log(message) {
  console.log(`[${getElapsed()}] ${message}`)
}

/**
 * Check if a line matches a build step and handle step transitions
 * @param {string} line - Output line to check
 */
function checkForStepChange(line) {
  for (const step of STEP_PATTERNS) {
    if (step.pattern.test(line)) {
      // If there was a previous step, log its completion
      if (currentStep && stepStartTime) {
        const stepDuration = formatDuration(Date.now() - stepStartTime)
        const totalDuration = formatDuration(Date.now() - BUILD_START_TIME)
        log(`${currentStep} completed (step: ${stepDuration}, total: ${totalDuration})`)
      }

      // Start new step
      currentStep = step.name
      stepStartTime = Date.now()
      log(`${currentStep}...`)
      return
    }
  }
}

async function main() {
  console.log('')
  console.log('Building Windows Universal Installer')
  console.log('====================================')
  console.log('')

  // Clean dist-universal directory to prevent corrupted archive errors
  const distDir = path.join(process.cwd(), 'dist-universal')
  if (fs.existsSync(distDir)) {
    log('Cleaning dist-universal directory...')
    fs.rmSync(distDir, { recursive: true })
    log('Cleaned dist-universal directory')
  }

  log('Starting electron-builder...')

  // Spawn electron-builder
  const child = spawn(
    'npx',
    ['electron-builder', '--win', '--publish=never', '--config', 'electron-builder.config.js'],
    {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    },
  )

  // Buffer for incomplete lines
  let stdoutBuffer = ''
  let stderrBuffer = ''

  // Process stdout
  child.stdout.on('data', (data) => {
    lastOutputTime = Date.now()
    stdoutBuffer += data.toString()

    // Process complete lines
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        checkForStepChange(line)
        // Print the original output with timestamp
        console.log(`  ${line}`)
      }
    }
  })

  // Process stderr
  child.stderr.on('data', (data) => {
    lastOutputTime = Date.now()
    stderrBuffer += data.toString()

    // Process complete lines
    const lines = stderrBuffer.split('\n')
    stderrBuffer = lines.pop() // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        checkForStepChange(line)
        console.log(`  ${line}`)
      }
    }
  })

  // Update elapsed time periodically when no output
  const statusInterval = setInterval(() => {
    const timeSinceOutput = Date.now() - lastOutputTime
    if (timeSinceOutput > 10000 && currentStep) {
      // Show status if no output for 10+ seconds
      const stepElapsed = formatDuration(Date.now() - stepStartTime)
      const totalElapsed = getElapsed()
      const totalDuration = formatDuration(Date.now() - BUILD_START_TIME)
      process.stdout.write(`\r[${totalElapsed}] ${currentStep}... (step: ${stepElapsed}, total: ${totalDuration})    `)
    }
  }, 1000)

  // Handle completion
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      clearInterval(statusInterval)

      // Process any remaining buffered output
      if (stdoutBuffer.trim()) {
        checkForStepChange(stdoutBuffer)
        console.log(`  ${stdoutBuffer}`)
      }
      if (stderrBuffer.trim()) {
        checkForStepChange(stderrBuffer)
        console.log(`  ${stderrBuffer}`)
      }

      // Log final step completion
      if (currentStep && stepStartTime) {
        const stepDuration = formatDuration(Date.now() - stepStartTime)
        const totalDuration = formatDuration(Date.now() - BUILD_START_TIME)
        log(`${currentStep} completed (step: ${stepDuration}, total: ${totalDuration})`)
      }

      console.log('')
      const totalTime = formatDuration(Date.now() - BUILD_START_TIME)

      if (code === 0) {
        log(`Build completed successfully!`)
        console.log('')
        console.log(`Total build time: ${totalTime}`)
        console.log('Output: dist-universal/Keyboard.Approver-Setup-Win-latest.exe')
        console.log('')
        resolve()
      }
      else {
        log(`Build failed with exit code ${code}`)
        console.log('')
        console.log(`Total time before failure: ${totalTime}`)
        reject(new Error(`Build failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      clearInterval(statusInterval)
      log(`Failed to start build process: ${error.message}`)
      reject(error)
    })
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Build error:', error.message)
    process.exit(1)
  })
