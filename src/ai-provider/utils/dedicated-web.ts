interface WebSearchQueryArgs {
  accessToken: string
  query: string
  company: string

}

export const webSearch = async function (args: WebSearchQueryArgs) {
  const { accessToken, query, company } = args
  const raw = JSON.stringify({
    query: `I need a code or API example for: ${query} in ${company}`,
    company: `${company}`,
  })

  const requestOptions = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: raw,
  }
  const response = await fetch('https://api.keyboard.dev/api/search/developer-docs/web-search', requestOptions)
  const result = await response.json()

  return JSON.stringify(result, null, 2)
}

/**
   * Build initial search query focused on finding code examples
   */
