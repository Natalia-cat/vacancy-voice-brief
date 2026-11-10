import { questionById } from './questions'
import { capitalize, normalize, splitList, stripFiller, unique, wordCount } from './text'
import { PipelineError, type CheckResult, type Decision, type QuestionId, type Slots } from './types'

// Имитация проверки полноты — правила SPEC §13. Синхронная часть экспортируется
// отдельно, чтобы её можно было тестировать без задержек.

const GOAL_MARKERS = ['чтобы', 'цель', 'результат', 'запуст', 'довести', 'сделать', 'внедр', 'увелич', 'сократ', 'к концу', 'до конца']
const UNKNOWN = ['не знаю', 'не знаем', 'пока не', 'посмотрим', 'неизвестно', 'не решили', 'не определ']
const SWITCH = ['друг', 'перейд', 'перейдёт', 'возьм', 'нов']
const CONTINUE = ['продолж', 'останет', 'тот же', 'этот же', 'дальше будет']
const TOOL_MARKERS = ['программ', 'сервис', 'инструмент', 'таблиц', 'crm']
const KNOWLEDGE_MARKERS = ['знат', 'знани', 'понима', 'опыт', 'умет', 'разбира', 'навык']

/** позиция первого вхождения маркера как начала слова */
const findMarker = (text: string, markers: string[]) => {
  const lower = text.toLowerCase()
  let best: { index: number; marker: string } | null = null
  for (const m of markers) {
    const re = new RegExp(`(^|[^\\p{L}])${m}`, 'iu')
    const hit = re.exec(lower)
    if (hit) {
      const index = hit.index + hit[1].length
      if (!best || index < best.index) best = { index, marker: m }
    }
  }
  return best
}

const afterWord = (text: string, index: number) => {
  // от конца слова, в котором найден маркер
  const rest = text.slice(index).replace(/^[\p{L}-]+/u, '')
  return stripFiller(rest.replace(/^\s*(на|за|в|к)\s+/i, '').replace(/^\s*(другой|новый)\s+(проект)?\s*/i, '').replace(/^[\s—–:-]+/, ''))
}

export function extractSlots(questionId: QuestionId, transcript: string): Slots {
  const text = normalize(transcript)
  switch (questionId) {
    case 'q1': {
      const tasks = unique(splitList(text).map(capitalize))
      return tasks.length ? { tasks } : {}
    }
    case 'q2': {
      const slots: Slots = {}
      // маркер цели считается, только если перед ним есть описание проекта (≥ 2 слов)
      const lower = text.toLowerCase()
      let goalAt = -1
      for (const m of GOAL_MARKERS) {
        const re = new RegExp(`(^|[^\\p{L}])${m}`, 'giu')
        let hit: RegExpExecArray | null
        while ((hit = re.exec(lower))) {
          const i = hit.index + hit[1].length
          if (wordCount(text.slice(0, i)) >= 2 && (goalAt === -1 || i < goalAt)) goalAt = i
        }
      }
      if (wordCount(text) >= 4) slots.project = capitalize(stripFiller(goalAt > -1 ? text.slice(0, goalAt) : text))
      if (goalAt > -1) slots.goal = capitalize(stripFiller(text.slice(goalAt)))
      return slots
    }
    case 'q3': {
      let decision: Decision | undefined
      let at = -1
      const u = findMarker(text, UNKNOWN)
      const s = findMarker(text, SWITCH)
      const c = findMarker(text, CONTINUE)
      if (u) decision = 'unknown'
      else if (s) ((decision = 'switch'), (at = s.index))
      else if (c) decision = 'continue'
      const slots: Slots = decision ? { decision } : {}
      if (decision === 'switch') {
        const next = afterWord(text, at)
        if (wordCount(next) >= 2) slots.next_project = capitalize(next)
      }
      return slots
    }
    case 'q4': {
      const parts = text.split(/[,;.!?\n]|\s(?:и|а также|плюс)\s/i).map((p) => stripFiller(p)).filter(Boolean)
      const knowledge: string[] = []
      const tools: string[] = []
      for (const p of parts) {
        if (findMarker(p, KNOWLEDGE_MARKERS)) {
          knowledge.push(capitalize(p))
          continue
        }
        const latin = p.match(/[A-Za-z][A-Za-z0-9+#.\-]*[A-Za-z0-9+#]|[A-Za-z]{2,}/g) ?? []
        tools.push(...latin)
        if (/(^|\s)1[сc](\s|$)/i.test(p)) tools.push('1С')
        if (!latin.length && findMarker(p, TOOL_MARKERS)) tools.push(capitalize(p))
      }
      const slots: Slots = {}
      if (tools.length) slots.tools = unique(tools)
      if (knowledge.length) slots.knowledge = unique(knowledge)
      return slots
    }
  }
}

export function scoreSlots(questionId: QuestionId, slots: Slots): { score: number; missing: (keyof Slots)[] } {
  switch (questionId) {
    case 'q1': {
      const n = slots.tasks?.length ?? 0
      return { score: n >= 2 ? 1 : n === 1 ? 0.5 : 0, missing: n >= 2 ? [] : ['tasks'] }
    }
    case 'q2': {
      const missing = (['project', 'goal'] as const).filter((k) => !slots[k])
      return { score: (2 - missing.length) / 2, missing: [...missing] }
    }
    case 'q3': {
      if (!slots.decision) return { score: 0, missing: ['decision'] }
      if (slots.decision === 'switch' && !slots.next_project) return { score: 0.5, missing: ['next_project'] }
      return { score: 1, missing: [] }
    }
    case 'q4': {
      const missing = (['tools', 'knowledge'] as const).filter((k) => !slots[k]?.length)
      return { score: (2 - missing.length) / 2, missing: [...missing] }
    }
  }
}

export function checkSync(questionId: QuestionId, transcript: string): CheckResult {
  const slots = extractSlots(questionId, transcript)
  const { score, missing } = scoreSlots(questionId, slots)
  const q = questionById(questionId)
  const clarification = missing.length ? q.clarifications[missing[0]] ?? null : null
  return { score, slots, missing, clarification }
}

const failMode = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('fail') : null)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Асинхронный контракт SPEC §13. Задержка 700–1200 мс — без неё уточнение выглядит как ошибка ввода. */
export async function check(questionId: QuestionId, transcript: string): Promise<CheckResult> {
  await wait(700 + Math.random() * 500)
  if (failMode() === 'check') throw new PipelineError('check failed (?fail=check)')
  return checkSync(questionId, transcript)
}
