export const extractJsonFromCodeApproval = (messageBody: string) => {
  try {
    // First, try to parse the entire body as JSON (in case it's already clean JSON)
    return JSON.parse(messageBody)
  }
  catch {
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
    catch {
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

export const getCodeApprovalMessageBodyWithStdMessage = ({
  messageBody,
  stdout,
  stderr,
}: {
  messageBody: string
  stdout: string
  stderr: string
}) => {
  try {
    // First, try to find and extract the JSON part from the message
    const jsonMatch = messageBody.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const jsonStr = jsonMatch[0]
      const jsonData = JSON.parse(jsonStr)

      // Update the stdout and stderr in the data object
      if (jsonData.data) {
        jsonData.data.stdout = stdout
        jsonData.data.stderr = stderr
      }
      else {
        // If no data object, update at root level
        jsonData.stdout = stdout
        jsonData.stderr = stderr
      }

      // Replace the original JSON in the message with the updated JSON
      const updatedJsonStr = JSON.stringify(jsonData)
      return messageBody.replace(jsonMatch[0], updatedJsonStr)
    }

    // If no JSON found, return original message
    return messageBody
  }
  catch (error) {
    // If parsing fails, return original message
    console.error('Failed to update stdout/stderr in message:', error)
    return messageBody
  }
}
