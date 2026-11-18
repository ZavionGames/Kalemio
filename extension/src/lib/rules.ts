export type Issue = {
  start: number
  end: number
  word: string
  choices: string[]
  kind: 'spell' | 'accent'
}
export const lower = (s: string) => s.toLocaleLowerCase('tr-TR')
export const fold = (s: string) =>
  lower(s).normalize('NFD').replace(/\p{M}/gu, '').replaceAll('ı', 'i')
export function matchCase(original: string, suggestion: string) {
  if (original.length > 1 && original === original.toLocaleUpperCase('tr-TR'))
    return suggestion.toLocaleUpperCase('tr-TR')
  if (original[0] !== lower(original[0]))
    return suggestion[0].toLocaleUpperCase('tr-TR') + suggestion.slice(1)
  return suggestion
}
const common: Record<string, string[]> = {
  yinede: ['yine de'],
  bende: ['ben de'],
  sende: ['sen de'],
  bizde: ['biz de'],
  tabiki: ['tabii ki'],
  iyiki: ['iyi ki'],
  demekki: ['demek ki'],
  halbuki: [],
  oysaki: [],
  turkce: ['Türkçe'],
  yazim: ['yazım'],
  bugun: ['bugün'],
  cok: ['çok'],
  guzel: ['güzel'],
  disari: ['dışarı'],
  cikmak: ['çıkmak']
}
export function rule(word: string): string[] {
  const w = lower(word)
  if (Object.hasOwn(common, w)) return common[w].map((s) => matchCase(word, s))
  const q =
    /^(.*(?:yor|acak|ecek|dı|di|du|dü|tın|tin|sun|sın|sin|sün|lar|ler|güzel|hazır|var|geldin|geldiniz))(m[ıiuü](?:s[ıiuü]n(?:[ıiuü]z)?|y[ıiuü]m|y[ıiuü]z)?)$/u.exec(
      w
    )
  if (q) return [matchCase(word, q[1] + ' ' + q[2])]
  const name =
    /^(ankara|istanbul|izmir|türkiye|atatürk)(da|de|ta|te|dan|den|ya|ye|nin|nın|in|un|ün)$/u.exec(
      w
    )
  if (name)
    return [
      name[1][0].toLocaleUpperCase('tr-TR') + name[1].slice(1) + "'" + name[2]
    ]
  return []
}
