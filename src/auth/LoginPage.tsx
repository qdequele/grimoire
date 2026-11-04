import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth'

const schema = z.object({
  email: z.email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  displayName: z.string().max(60).optional(),
})
type Values = z.infer<typeof schema>
type Mode = 'signin' | 'signup'

export function LoginPage() {
  const { session } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', displayName: '' } })

  if (session) return <Navigate to="/" replace />

  async function onSubmit(values: Values) {
    setError(null)
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
        : await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: { data: { display_name: values.displayName ?? '' } },
          })
    if (error) setError(error.message)
  }

  const { errors, isSubmitting } = form.formState

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-3xl">Grimoire</CardTitle>
          <CardDescription>L'écran du gardien, scène par scène.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="signin">Se connecter</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>
          </Tabs>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              {mode === 'signup' && (
                <Field>
                  <FieldLabel htmlFor="displayName">Nom affiché</FieldLabel>
                  <Input id="displayName" autoComplete="nickname" {...form.register('displayName')} />
                </Field>
              )}
              <Field data-invalid={!!errors.email || undefined}>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password || undefined}>
                <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  aria-invalid={!!errors.password}
                  {...form.register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
