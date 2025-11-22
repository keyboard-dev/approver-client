import { aiRuntime } from './runtime'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'
import { KeyboardProvider } from './providers/keyboard'

export function initializeAIProviders(): void {
  aiRuntime.registerProvider(new KeyboardProvider())
  aiRuntime.registerProvider(new OpenAIProvider())
  aiRuntime.registerProvider(new AnthropicProvider())
  aiRuntime.registerProvider(new GeminiProvider())
}

export { aiRuntime }
