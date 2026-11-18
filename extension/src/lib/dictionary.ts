import { fold, lower, matchCase, rule, type Issue } from './rules'
// This tr_TR edition uses numeric, unconditional, single-suffix flags.
// Reverse lookup avoids expanding several million inflected forms into RAM.
export class Dictionary {
  private roots = new Map<string, string>()
  private accents = new Map<string, string[]>()
  private suffix = new Map<string, string[]>()
  private suffixAccents = new Map<string, string[]>()
  constructor(aff: string, dic: string) {
    const append = (map: Map<string, string[]>, key: string, value: string) => {
      const values = map.get(key)
      if (values) values.push(value)
      else map.set(key, [value])
    }
    for (const line of aff.split(/\r?\n/)) {
      const m = /^SFX (\d+) 0 (\S+) \.$/.exec(line)
      if (m) {
        append(this.suffix, m[2], m[1])
        if (!this.suffixAccents.get(fold(m[2]))?.includes(m[2]))
          append(this.suffixAccents, fold(m[2]), m[2])
      }
    }
    for (const row of dic.split(/\r?\n/).slice(1)) {
      if (!row) continue
      const [word, flags = ''] = row.split('/')
      this.roots.set(word, ',' + flags + ',')
      if (fold(word) !== word) append(this.accents, fold(word), word)
    }
  }
  private accepts(root: string, suffix: string) {
    const flags = this.roots.get(root)
    return (
      flags &&
      this.suffix.get(suffix)?.some((flag) => flags.includes(',' + flag + ','))
    )
  }
  correct(word: string) {
    if (this.roots.has(word)) return true
    for (let i = 1; i < word.length; i++)
      if (this.accepts(word.slice(0, i), word.slice(i))) return true
    return false
  }
  private variants(word: string) {
    const normalized = fold(word)
    const found = new Set(this.accents.get(normalized) || [])
    for (let i = 1; i < normalized.length; i++) {
      const endings = this.suffixAccents.get(normalized.slice(i))
      if (!endings) continue
      const stem = normalized.slice(0, i)
      for (const root of [stem, ...(this.accents.get(stem) || [])]) {
        for (const end of endings)
          if (this.accepts(root, end)) found.add(root + end)
      }
    }
    return [...found].filter((s) => lower(s) !== lower(word)).slice(0, 5)
  }
  private nearby(word: string) {
    const found = new Set<string>()
    const add = (s: string) => {
      if (this.roots.has(s)) found.add(s)
    }
    for (let i = 0; i <= word.length && found.size < 5; i++) {
      const a = word.slice(0, i),
        b = word.slice(i)
      add(a + b.slice(1))
      if (b.length > 1) add(a + b[1] + b[0] + b.slice(2))
      for (const letter of 'aeıiuüoöbcçdfgğhjklmnprsştvyz') {
        add(a + letter + b)
        if (b) add(a + letter + b.slice(1))
      }
    }
    return [...found].slice(0, 5)
  }
  scan(text: string, personal: string[], accents = false): Issue[] {
    const ignored = new Set(personal.map(lower)),
      issues: Issue[] = []
    for (const match of text.matchAll(
      /https?:\/\/\S+|[\w.+%-]+@[\w.-]+\.[a-z]+|[\p{L}]+(?:['’][\p{L}]+)*/giu
    )) {
      const word = match[0],
        plain = lower(word.replaceAll('’', "'"))
      if (
        word.length < 2 ||
        word.length > 60 ||
        /[@:/]/.test(word) ||
        ignored.has(plain)
      )
        continue
      const tips = rule(word)
      const valid = this.correct(word) || this.correct(plain)
      if (!tips.length && valid && !accents) continue
      const variants = tips.length ? tips : this.variants(word)
      if (valid && !variants.length) continue
      const choices = variants.length ? variants : this.nearby(plain)
      const kind =
        valid || variants.some((s) => fold(s) === fold(word))
          ? 'accent'
          : 'spell'
      issues.push({
        start: match.index!,
        end: match.index! + word.length,
        word,
        kind,
        choices: [...new Set(choices.map((s) => matchCase(word, s)))].filter(
          (s) => s !== word
        )
      })
    }
    return issues
  }
}
