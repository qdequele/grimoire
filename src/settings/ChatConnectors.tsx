import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { strToU8, zipSync } from 'fflate'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { Rich } from '@/i18n/Rich'
import { useT } from '@/i18n/t'
import skill from '../../skills/grimoire-story/SKILL.md?raw'

/**
 * The MCP connector's address (supabase/functions/mcp): www.legrimoire.quest/mcp in production and
 * previews (vercel.json rewrites it to the function), the function itself when running locally.
 */
function connectorUrl(): string {
  const configured = import.meta.env.VITE_MCP_URL as string | undefined
  if (configured) return configured
  const { hostname, origin } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1' ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp` : `${origin}/mcp`
}

const GRANTS_KEY = ['oauth-grants'] as const

/** Applications the keeper allowed on /oauth/consent (Supabase Auth's OAuth server). */
function useGrants() {
  return useQuery({
    queryKey: GRANTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.listGrants()
      if (error) throw error
      return data
    },
  })
}

function useRevokeGrant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.auth.oauth.revokeGrant({ clientId })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: GRANTS_KEY }),
  })
}

function downloadSkill() {
  const zip = zipSync({ 'grimoire-story/SKILL.md': strToU8(skill) }, { level: 6 })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  a.download = 'grimoire-story.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Réglages → ChatGPT et Claude: connect a chat app to create and revise stories (MCP connector). */
export function ChatConnectors() {
  const t = useT()
  const url = connectorUrl()
  const grants = useGrants()
  const revoke = useRevokeGrant()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('Adresse copiée.'))
    } catch {
      toast.error(t('Impossible de copier l’adresse.'))
    }
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="chat-connectors">
      <header className="flex flex-col gap-1">
        <h2 id="chat-connectors" className="font-heading text-2xl">{t('ChatGPT et Claude')}</h2>
        <p className="text-muted-foreground">
          {t('Crée et modifie tes histoires en discutant avec ChatGPT ou Claude : ils écrivent, Grimoire vérifie et range l’histoire dans ta bibliothèque.')}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor="connector-url" className="eyebrow">{t('Adresse du connecteur')}</label>
        <div className="flex gap-2">
          <Input id="connector-url" readOnly value={url} className="font-mono" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" onClick={copy}>
            <Copy data-icon="inline-start" />
            {t('Copier')}
          </Button>
        </div>
      </div>

      <ol className="flex list-decimal flex-col gap-2 pl-5 font-serif">
        <li><Rich text={t('**Claude** (site ou application) : Réglages → Connecteurs → Ajouter un connecteur personnalisé. Colle l’adresse, puis connecte-toi à Grimoire.')} /></li>
        <li><Rich text={t('**ChatGPT** : Réglages → Applications et connecteurs → Paramètres avancés → active le mode développeur, puis Créer. Colle l’adresse, choisis OAuth, puis connecte-toi à Grimoire.')} /></li>
        <li>{t('Demande par exemple : « Crée-moi une histoire Grimoire dans un village de pêcheurs en 1925, pour trois joueurs. »')}</li>
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={downloadSkill}>
          <Download data-icon="inline-start" />
          {t('Compétence pour Claude (.zip)')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('Facultatif : à ajouter dans Claude, Réglages → Capacités → Compétences.')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="eyebrow">{t('Applications connectées')}</h3>
        {grants.isPending ? (
          <Skeleton className="h-9 w-64" />
        ) : !grants.data?.length ? (
          <p className="text-sm text-muted-foreground">{t('Aucune application connectée.')}</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="oauth-grants">
            {grants.data.map((g) => (
              <li key={g.client.id} className="flex flex-wrap items-center gap-3">
                <span className="font-serif">{g.client.name || g.client.id}</span>
                <span className="text-sm text-muted-foreground">{t('depuis le {date}', { date: t.date(g.granted_at) })}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutateAsync(g.client.id).then(
                      () => toast.success(t('{name} est déconnectée.', { name: g.client.name || g.client.id })),
                      (e: Error) => toast.error(t(e.message)),
                    )
                  }
                >
                  {t('Déconnecter')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
