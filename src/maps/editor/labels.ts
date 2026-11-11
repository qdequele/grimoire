// The editor's labels that come from data (translated with t() where shown; listed in i18n/keys.ts).
import type { Ground, MapKind } from '../kit/model.ts'

export const MAP_KIND_LABEL: Record<MapKind, string> = { building: 'Bâtiment', underground: 'Souterrain', outdoor: 'Extérieur' }

/** The ground brushes, with a swatch colour. */
export const BRUSHES: { c: Ground; label: string; swatch: string; kinds?: MapKind[] }[] = [
  { c: '#', label: 'Mur', swatch: '#3a2a1a', kinds: ['building', 'outdoor'] },
  { c: '.', label: 'Sol', swatch: '#f7eed7' },
  { c: ' ', label: 'Vide', swatch: '#efe2c2', kinds: ['building', 'outdoor'] },
  { c: ' ', label: 'Roche', swatch: '#cdb27c', kinds: ['underground'] },
  { c: 'd', label: 'Porte', swatch: '#a07a49' },
  { c: 's', label: 'Porte secrète', swatch: '#9a3020' },
  { c: 'w', label: 'Fenêtre', swatch: '#d9e2df', kinds: ['building', 'outdoor'] },
  { c: '~', label: 'Eau', swatch: '#aabfba' },
  { c: '"', label: 'Herbe', swatch: '#c9c88f' },
  { c: '=', label: 'Route', swatch: '#e1d3ad' },
  { c: ':', label: 'Chemin', swatch: '#dcc69a' },
  { c: '+', label: 'Pavés', swatch: '#e6dcc0' },
]
