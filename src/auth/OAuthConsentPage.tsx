import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'
import { Epigraph, Masthead } from '@/theme/Masthead'
import { useT } from '@/i18n/t'

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * OAuth consent (Supabase Auth's OAuth server sends the keeper here with ?authorization_id=…):
 * ChatGPT, Claude or another MCP client asks to use the Grimoire connector (supabase/functions/mcp)
 * on the keeper's behalf. Approving or refusing sends the browser back to the client.
 */
export function OAuthConsentPage() {
  const t = useT()
  const id = useSearchParams()[0].get('authorization_id') ?? ''
  const details = useQuery({
    queryKey: ['oauth-authorization', id],
    enabled: !!id,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id)
      if (error) throw error
      // Already approved before: straight back to the client.
      if (!('authorization_id' in data)) window.location.assign(data.redirect_url)
      return data
    },
  })
  const decide = useMutation({
    mutationFn: async (approve: boolean) => {
      const { error } = approve ? await supabase.auth.oauth.approveAuthorization(id) : await supabase.auth.oauth.denyAuthorization(id)
      if (error) throw error
      // supabase-js redirects the browser to the client: keep the buttons disabled meanwhile.
      return new Promise<never>(() => {})
    },
  })

  const d = details.data && 'authorization_id' in details.data ? details.data : null
  const failure = !id ? t('Ce lien d’autorisation est incomplet.') : details.error || decide.error ? t('Cette demande d’autorisation n’est plus valide. Recommence depuis ChatGPT ou Claude.') : null

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-6xl gap-12 px-4 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-[4.5rem]">
      <div className="flex flex-col gap-10">
        <Masthead eyebrow={t('Connexion d’une application')} title="Grimoire" subtitle={t('Le compagnon du gardien, scène par scène')} />

        <div className="flex max-w-md flex-col gap-6" data-testid="oauth-consent">
          {failure ? (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : !d ? (
            <Spinner />
          ) : (
            <>
              <h1 className="font-serif text-2xl">
                {t('{client} veut accéder à ton Grimoire.', { client: d.client.name || hostOf(d.redirect_uri) })}
              </h1>
              <div className="flex flex-col gap-2">
                <p className="eyebrow">{t('Elle pourra')}</p>
                <ul className="flex flex-col gap-1 font-serif">
                  {[t('lire tes histoires privées ;'), t('créer des histoires et modifier tes histoires privées.')].map((line) => (
                    <li key={line} className="flex items-baseline gap-3">
                      <span aria-hidden="true" className="diamond" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  {t('Elle ne voit ni tes investigateurs, ni tes parties, ni ton mot de passe.')}
                </p>
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">{t('Compte')}</dt>
                <dd>{d.user.email}</dd>
                <dt className="text-muted-foreground">{t('Retour vers')}</dt>
                <dd className="font-mono break-all">{hostOf(d.redirect_uri)}</dd>
              </dl>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => decide.mutate(true)} disabled={decide.isPending}>
                  {decide.isPending && decide.variables && <Spinner data-icon="inline-start" />}
                  {t('Autoriser')}
                </Button>
                <Button variant="outline" onClick={() => decide.mutate(false)} disabled={decide.isPending}>
                  {decide.isPending && !decide.variables && <Spinner data-icon="inline-start" />}
                  {t('Refuser')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t('Tu pourras la déconnecter à tout moment dans Réglages.')}</p>
            </>
          )}
        </div>
      </div>

      <div className="lg:pt-2">
        <Epigraph
          quote={t('Un nouveau scribe demande à entrer dans la bibliothèque.')}
          note={t('N’autorise que les applications que tu viens de connecter toi-même.')}
        />
      </div>
    </main>
  )
}
