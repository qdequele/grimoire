// Sound ids of the legacy engine ↔ shared library ids (spec/sounds.json). One-to-one.

export const AMB_TO_LIBRARY: Record<string, string> = {
  pluie: 'rain',
  pluieforte: 'rain-heavy',
  vitre: 'rain-window',
  orage: 'storm',
  cheminee: 'fireplace',
  horloge: 'clock',
  vent: 'wind',
  venthurle: 'wind-howling',
  corbeaux: 'crows',
  nature: 'nature-day',
  nuit: 'night-crickets',
  villagenuit: 'village-night',
  villagejour: 'village-day',
  rue: 'street',
  foule: 'crowd-indoor',
}

export const SFX_TO_LIBRARY: Record<string, string> = {
  grince: 'door-creak',
  ouvre: 'door-open',
  claque: 'door-slam',
  loquet: 'latch',
  pas: 'footsteps',
  coups: 'knocking',
  tonnerre: 'thunder',
  loup: 'wolf-howl',
  chouette: 'owl',
  chien: 'dog-bark',
  verre: 'glass-break',
  tir: 'gunshot',
  cri: 'scream',
  rugit: 'roar',
  chuchote: 'whispers',
  gratte: 'scratching',
  coeur: 'heartbeat',
  chute: 'object-fall',
}

const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]))
export const LIBRARY_TO_AMB = invert(AMB_TO_LIBRARY)
export const LIBRARY_TO_SFX = invert(SFX_TO_LIBRARY)
