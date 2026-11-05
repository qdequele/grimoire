import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
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
import { useAuth } from './auth'

const makeSchema = (t: T) =>
  z.object({
    email: z.email(t('Adresse e-mail invalide')),
    password: z.string().min(8, t('Au moins 8 caractères')),
    displayName: z.string().max(60).optional(),
  })
type Values = z.infer<ReturnType<typeof makeSchema>>
type Mode = 'signin' | 'signup'

// Laid out like the legacy home screen: title block and menu on the left, quote on the right.
export function LoginPage() {
  const { session } = useAuth()
  const t = useT()
  const schema = useMemo(() => makeSchema(t), [t])
  const [mode, setMode] = useState<Mode>('signin')
  const [error, setError] = useState<string | null>(null)
  // Where accounts need an e-mail confirmation (hosted Supabase), sign-up returns no session.
  const [confirmTo, setConfirmTo] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', displayName: '' } })

  if (session) return <Navigate to="/" replace />

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
