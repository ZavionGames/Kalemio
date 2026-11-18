import limits from '../../shared/limits.json'

export const config = {
  worker: 'https://kalemio.contactkalemio.workers.dev',
  ...limits,
  timeout: 15_000
} as const
export const modes = [
  'fix',
  'fluent',
  'formal',
  'friendly',
  'polite',
  'concise',
  'email',
  'translate_tr_en',
  'translate_en_tr',
  'analyze'
] as const
export type Mode = (typeof modes)[number]
