import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { strToU8, zipSync } from 'fflate'
import { Download, ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useT } from '@/i18n/t'
import { DIRECTORY_LISTING } from '@/legal/info'
import { LEGAL_PATHS } from '@/legal/paths'
import { CHATGPT_PLUGINS_URL, claudeAddLink, connectorUrl } from './connectorUrl'
import skill from '../../skills/grimoire-story/SKILL.md?raw'

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

  return (
    <section className="flex flex-col gap-5" aria-labelledby="chat-connectors">
      <header className="flex flex-col gap-1">
        <h2 id="chat-connectors" className="font-heading text-2xl">{t('ChatGPT et Claude')}</h2>
        <p className="text-muted-foreground">
          {t('Crée et modifie tes histoires en discutant avec ChatGPT ou Claude : ils écrivent, Grimoire vérifie et range l’histoire dans ta bibliothèque. Ils t’aident aussi à créer des investigateurs, vérifiés selon les règles de création.')}
        </p>
      </header>

      {/* Claude: its install link opens the add-connector dialog already filled in, until Grimoire is in
          its directory. ChatGPT has no such link: the button opens the page where the address is pasted. */}
      <div className="flex flex-wrap gap-3" data-testid="connector-buttons">
        <Button nativeButton={false} render={<a href={DIRECTORY_LISTING.claude || claudeAddLink(url)} target="_blank" rel="noreferrer" />}>
          <ExternalLink data-icon="inline-start" />
          {t('Ajouter à Claude')}
        </Button>
        <Button
          variant={DIRECTORY_LISTING.chatgpt ? 'default' : 'outline'}
          nativeButton={false}
          render={<a href={DIRECTORY_LISTING.chatgpt || CHATGPT_PLUGINS_URL} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink data-icon="inline-start" />
          {DIRECTORY_LISTING.chatgpt ? t('Ajouter à ChatGPT') : t('Ouvrir ChatGPT')}
        </Button>
      </div>
      {/* When the install link opens no dialog (e.g. a Team or Enterprise member, where only an Owner adds
          connectors) or for ChatGPT: the help page gives the address and the steps by hand. */}
      <p className="-mt-2 text-sm text-muted-foreground">
        {t('Rien ne s’ouvre, ou tu préfères le faire toi-même ?')}{' '}
        <Link to={LEGAL_PATHS.help[t.lang]} className="text-gold underline underline-offset-4">{t('Ajouter Grimoire à la main')}</Link>
      </p>

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
