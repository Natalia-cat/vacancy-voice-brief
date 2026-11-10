// Утилиты разбора речи. Распознанная речь приходит без пунктуации или с ней —
// правила должны работать в обоих случаях.

export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()

export const words = (s: string) => normalize(s).split(' ').filter((w) => /[\p{L}\d]/u.test(w))

export const wordCount = (s: string) => words(s).length

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export const lowerFirst = (s: string) =>
  // не опускаем аббревиатуры и латиницу: «CRM», «B2B»
  s && !/^[A-ZА-ЯЁ0-9]{2,}/.test(s) ? s[0].toLowerCase() + s.slice(1) : s

const LEADING_FILLER = [
  /^(ну|так|вот|значит|в общем|короче)\s+/i,
  /^(в первую очередь|прежде всего|во-первых|во-вторых|в-третьих|также|ещё|еще|потом|затем|а также)\s+/i,
  /^(он|она|сотрудник|человек|они)\s+/i,
  /^(будет|должен|должна|нужно|надо|сможет|станет|умеет)\s+/i,
  /^(уметь|иметь)\s+/i,
]

/** Срезает вводные слова в начале фрагмента: «в первую очередь он будет разбирать» → «разбирать» */
export const stripFiller = (s: string) => {
  let out = normalize(s).replace(/^[,;.:—–-]+\s*/, '').replace(/[,;.:—–-]+$/, '')
  let changed = true
  while (changed) {
    changed = false
    for (const re of LEADING_FILLER) {
      const next = out.replace(re, '')
      if (next !== out && wordCount(next) >= 1) {
        out = next
        changed = true
      }
    }
  }
  return out.trim()
}

/** Делит перечисление на части. Короткие хвосты (< minWords) приклеиваются к предыдущей части. */
export const splitList = (s: string, minWords = 2) => {
  const raw = normalize(s)
    .split(/[,;.!?\n]|\s(?:и|а также|затем|потом|ещё|еще|плюс)\s/i)
    .map((p) => stripFiller(p))
    .filter(Boolean)
  const out: string[] = []
  for (const part of raw) {
    if (wordCount(part) < minWords && out.length) out[out.length - 1] += ' и ' + part
    else if (wordCount(part) >= minWords) out.push(part)
  }
  return out
}

export const unique = (items: string[]) => {
  const seen = new Set<string>()
  return items.filter((i) => {
    const k = i.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const joinRu = (items: string[]) =>
  items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' и ' + items[items.length - 1]
