import aff from 'dictionary-tr/index.aff'
import dic from 'dictionary-tr/index.dic'
import { Dictionary } from './lib/dictionary'
const dictionary = new Dictionary(aff, dic)
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      issues: dictionary.scan(data.text, data.personal, data.accents)
    })
  } catch {
    self.postMessage({ id: data.id, error: 'dictionary' })
  }
}
