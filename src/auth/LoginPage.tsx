import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { Epigraph, Masthead, SkinToggle } from '@/theme/Masthead'
import { useT, type T } from '@/i18n/t'
import { LegalLinks } from '@/legal/LegalPage'
import { useAuth } from './auth'
import { returnedOAuthError, signInWithGoogle, useGoogleEnabled } from './oauth'

const makeSchema = (t: T) =>
  z.object({
    email: z.email(t('Adresse e-mail invalide')),
    password: z.string().min(8, t('Au moins 8 caractères')),
    displayName: z.string().max(60).optional(),
  })
type Values = z.infer<ReturnType<typeof makeSchema>>

/** Where to go once signed in: a path on this site only (never another origin, "//host" included). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}
type Mode = 'signin' | 'signup'

// Laid out like the legacy home screen: title block and menu on the left, quote on the right.
export function LoginPage() {
  const { session } = useAuth()
  const t = useT()
  const next = safeNext(useSearchParams()[0].get('next'))
  const schema = useMemo(() => makeSchema(t), [t])
  const [mode, setMode] = useState<Mode>('signin')
  const [error, setError] = useState<string | null>(returnedOAuthError)
  // Where accounts need an e-mail confirmation (hosted Supabase), sign-up returns no session.
  const [confirmTo, setConfirmTo] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', displayName: '' } })

  if (session) return <Navigate to={next} replace />

  async function onSubmit(values: Values) {
    setError(null)
    setConfirmTo(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
      if (error) setError(error.message)
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      // The confirmation link brings the keeper back to this site, signed in.
      // lang: the e-mails (supabase/templates) follow the keeper's language.
      options: { data: { display_name: values.displayName ?? '', lang: t.lang }, emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else if (!data.session) setConfirmTo(values.email)
  }

  const { errors, isSubmitting } = form.formState

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-6xl gap-12 px-4 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-[4.5rem]">
      <div className="flex flex-col gap-10">
        <Masthead eyebrow={t('Écran du gardien')} title="Grimoire" subtitle={t('Le compagnon du gardien, scène par scène')} />

        <div className="flex max-w-sm flex-col gap-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList variant="line">
              <TabsTrigger value="signin">{t('Se connecter')}</TabsTrigger>
              <TabsTrigger value="signup">{t('Créer un compte')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <GoogleButton onError={setError} />
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              {mode === 'signup' && (
                <Field>
                  <FieldLabel htmlFor="displayName">{t('Nom affiché')}</FieldLabel>
                  <Input id="displayName" autoComplete="nickname" {...form.register('displayName')} />
                </Field>
              )}
              <Field data-invalid={!!errors.email || undefined}>
                <FieldLabel htmlFor="email">{t('E-mail')}</FieldLabel>
                <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password || undefined}>
                <FieldLabel htmlFor="password">{t('Mot de passe')}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  aria-invalid={!!errors.password}
                  {...form.register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              {confirmTo && (
                <Alert>
                  <AlertDescription>
                    {t('Compte créé. Ouvre le lien envoyé à {email} pour le confirmer, puis connecte-toi.', { email: confirmTo })}
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{t(error)}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                {mode === 'signin' ? t('Se connecter') : t('Créer mon compte')}
              </Button>
            </FieldGroup>
          </form>
          <SkinToggle />
          <LegalLinks t={t} />
        </div>
      </div>

      <div className="lg:pt-2">
        <Epigraph
          quote={t("La lampe du phare s'est éteinte il y a trois nuits. Quelqu'un doit aller voir.")}
          note={t('Connecte-toi pour retrouver tes investigateurs et tes parties en cours.')}
        />
      </div>
    </main>
  )
}

/** Shown only when Google sign-in is enabled in Supabase Auth (nothing, not even the "or" rule, otherwise). */
function GoogleButton({ onError }: { onError: (message: string | null) => void }) {
  const t = useT()
  const enabled = useGoogleEnabled().data ?? false
  const [pending, setPending] = useState(false)
  if (!enabled) return null

  async function go() {
    onError(null)
    setPending(true)
    const { error } = await signInWithGoogle()
    // On success the browser is already leaving for Google's page.
    if (error) {
      onError(error.message)
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" disabled={pending} onClick={go}>
        {pending ? <Spinner data-icon="inline-start" /> : <GoogleIcon />}
        {t('Continuer avec Google')}
      </Button>
      <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('ou')}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg data-icon="inline-start" viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  )
}
