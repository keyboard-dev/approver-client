export const extractJsonFromCodeApproval = (messageBody: string): any => {
  try {
    // First, try to parse the entire body as JSON (in case it's already clean JSON)
    return JSON.parse(messageBody)
  }
  catch (error) {
    // If that fails, try to extract JSON from the text
    try {
      // Look for JSON patterns - find text that starts with { and ends with }
      // The 's' flag is not supported in ES2017 or lower, so use a workaround
      const jsonMatch = messageBody.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const jsonStr = jsonMatch[0]
        return JSON.parse(jsonStr)
      }

      // Alternative: look for patterns like "response:" or "result:" followed by JSON
      // The 's' flag is not supported in ES2017 or lower, so avoid using it.
      // This regex will match "response:", "result:", "data:", or "codespace:" followed by a JSON object.
      const colonMatch = messageBody.match(/(?:response|result|data|codespace):\s*(\{[\s\S]*\})/i)
      if (colonMatch) {
        return JSON.parse(colonMatch[1])
      }

      // If no JSON found, return a fallback structure
      return {
        stdout: messageBody,
        stderr: '',
        success: false,
        raw: true,
      }
    }
    catch (parseError) {
      // If all parsing attempts fail, return the original text
      return {
        stdout: messageBody,
        stderr: '',
        success: false,
        raw: true,
      }
    }
  }
}
