/**
 * The MCP connector's address (supabase/functions/mcp): www.legrimoire.quest/mcp in production and
 * previews (vercel.json rewrites it to the function), the function itself when running locally.
 */
export function connectorUrl(): string {
  const configured = import.meta.env.VITE_MCP_URL as string | undefined
  if (configured) return configured
  const { hostname, origin } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1' ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp` : `${origin}/mcp`
}

/**
 * claude.ai's "Add custom connector" dialog with Grimoire's name and address filled in (documented
 * install link: claude.com/docs/connectors/building/directory-vs-custom). Claude shows that the values
 * come from a link; the keeper confirms, then signs in to Grimoire. Works on every Claude plan.
 */
export function claudeAddLink(url: string = connectorUrl()): string {
  const query = new URLSearchParams({ modal: 'add-custom-connector', connectorName: 'Grimoire', connectorUrl: url })
  return `https://claude.ai/customize/connectors?${query}`
}

/** ChatGPT's page for custom MCP servers: no prefill link exists, the keeper pastes the address there. */
export const CHATGPT_PLUGINS_URL = 'https://chatgpt.com/plugins'
