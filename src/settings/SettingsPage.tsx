import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SKIN_LABEL, useSkin, type Skin } from '@/theme/skin'
import { useT } from '@/i18n/t'
import { LANG_LABEL, useLang, type Lang } from './lang'

/** Réglages: theme and language, remembered on this device. */
export function SettingsPage() {
  const t = useT()
  const { skin, setSkin } = useSkin()
  const { lang, setLang } = useLang()
  return (
    <section className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-4xl">{t('Réglages')}</h1>
        <p className="text-muted-foreground">{t('Gardés sur cet appareil.')}</p>
      </header>
      <FieldSet>
        <FieldGroup>
          <Field>
            <FieldLabel>{t('Thème')}</FieldLabel>
            <Tabs value={skin} onValueChange={(v) => setSkin(v as Skin)}>
              <TabsList aria-label={t('Thème')}>
                {(Object.keys(SKIN_LABEL) as Skin[]).map((k) => <TabsTrigger key={k} value={k}>{t(SKIN_LABEL[k])}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <FieldDescription>{t("Art déco : noir et or. Classique : vert sombre, typographie d'époque.")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t('Langue')}</FieldLabel>
            <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <TabsList aria-label={t('Langue')}>
                {(Object.keys(LANG_LABEL) as Lang[]).map((k) => <TabsTrigger key={k} value={k}>{LANG_LABEL[k]}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <FieldDescription>
              {t("Langue de l'application et de l'écran de jeu, et langue proposée pour les imports. Les histoires gardent leur propre langue.")}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>
    </section>
  )
}
