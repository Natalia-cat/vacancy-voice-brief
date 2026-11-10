import { TICKS, type Sector } from '../components/Ring'
import { QUESTIONS } from '../pipeline/questions'
import { wordCount } from '../pipeline/text'
import type { Answer, CheckResult, Slots, Vacancy } from '../pipeline/types'

// State machine брифа — SPEC §7. Все переходы только через reducer, без разрозненных флагов.

export type Phase =
  | 'intro'
  | 'question' // question_ready / listening / paused / text_input — различаются recording и mode
  | 'checking'
  | 'clarify'
  | 'accepted'
  | 'review' // возврат «Назад» к уже принятому ответу
  | 'generating'
  | 'generation_error'
  | 'result'

export type State = {
  phase: Phase
  qIndex: number
  answers: (Answer | null)[]
  sectors: Sector[]
  transcript: string
  interim: string
  recording: 'idle' | 'listening' | 'paused'
  mode: 'voice' | 'text'
  micDenied: boolean
  clarified: boolean
  /** результат проверки, приведшей к уточнению */
  pending: CheckResult | null
  /** слов в ответе до уточнения */
  baseWords: number
  hint: string | null
  demo: boolean
  vacancy: Vacancy | null
}

const emptySectors = (): Sector[] => QUESTIONS.map(() => ({ filled: 0, live: 0, gap: 0 }))

export const initialState = (mode: 'voice' | 'text' = 'voice'): State => ({
  phase: 'intro',
  qIndex: 0,
  answers: QUESTIONS.map(() => null),
  sectors: emptySectors(),
  transcript: '',
  interim: '',
  recording: 'idle',
  mode,
  micDenied: false,
  clarified: false,
  pending: null,
  baseWords: 0,
  hint: null,
  demo: false,
  vacancy: null,
})

export type Action =
  | { type: 'START'; demo?: boolean }
  | { type: 'RESUME'; answers: (Answer | null)[]; sectors: Sector[]; vacancy?: Vacancy | null }
  | { type: 'SET_MODE'; mode: 'voice' | 'text' }
  | { type: 'MIC_DENIED' }
  | { type: 'REC'; recording: State['recording'] }
  | { type: 'TEXT'; text: string; interim?: string }
  | { type: 'HINT'; hint: string | null }
  | { type: 'SUBMIT' }
  | { type: 'CHECK_OK'; result: CheckResult }
  | { type: 'CHECK_FAIL'; fallback: CheckResult }
  | { type: 'SKIP' }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'REWRITE' }
  | { type: 'GEN_OK'; vacancy: Vacancy }
  | { type: 'GEN_FAIL' }
  | { type: 'RETRY' }
  | { type: 'UPDATE_VACANCY'; vacancy: Vacancy }
  | { type: 'RESET'; mode: 'voice' | 'text' }

const setSector = (sectors: Sector[], i: number, s: Sector) => sectors.map((x, k) => (k === i ? s : x))

function accept(state: State, slots: Slots, score: number, gaps: (keyof Slots)[], degraded = false): State {
  const q = QUESTIONS[state.qIndex]
  const filled = degraded ? Math.max(1, state.sectors[state.qIndex].filled + state.sectors[state.qIndex].live) : Math.round(TICKS * score)
  const sector: Sector = { filled, live: 0, gap: filled < TICKS && (gaps.length || degraded) ? TICKS - filled : 0 }
  const answer: Answer = { questionId: q.id, transcript: state.transcript, slots, gaps, score }
  return {
    ...state,
    phase: 'accepted',
    answers: state.answers.map((a, i) => (i === state.qIndex ? answer : a)),
    sectors: setSector(state.sectors, state.qIndex, sector),
    pending: null,
    interim: '',
    recording: 'idle',
    hint: null,
  }
}

const openQuestion = (state: State, qIndex: number): State => {
  const existing = state.answers[qIndex]
  return {
    ...state,
    qIndex,
    phase: existing ? 'review' : 'question',
    transcript: existing?.transcript ?? '',
    interim: '',
    recording: 'idle',
    clarified: false,
    pending: null,
    baseWords: 0,
    hint: null,
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return openQuestion({ ...initialState(state.mode), micDenied: state.micDenied, mode: state.micDenied ? 'text' : state.mode, demo: !!action.demo }, 0)
    case 'RESUME': {
      const next = action.answers.findIndex((a) => !a)
      const base = { ...state, answers: action.answers, sectors: action.sectors, demo: false }
      if (next === -1) return action.vacancy ? { ...base, phase: 'result', vacancy: action.vacancy, qIndex: 3 } : { ...base, phase: 'generating', qIndex: 3 }
      return openQuestion(base, next)
    }
    case 'SET_MODE':
      return { ...state, mode: action.mode, recording: 'idle', hint: null }
    case 'MIC_DENIED':
      return { ...state, micDenied: true, mode: 'text', recording: 'idle' }
    case 'REC':
      return { ...state, recording: action.recording, hint: action.recording === 'listening' ? null : state.hint }
    case 'TEXT': {
      const sector = state.sectors[state.qIndex]
      const full = (action.text + ' ' + (action.interim ?? '')).trim()
      // в уточнении считаем только новые слова — уже заполненные деления не трогаем
      const extra = Math.max(0, wordCount(full) - state.baseWords)
      const live = Math.min(TICKS - sector.filled, Math.min(6, Math.floor(extra / 5)))
      return {
        ...state,
        transcript: action.text,
        interim: action.interim ?? '',
        sectors: setSector(state.sectors, state.qIndex, { filled: sector.filled, live, gap: 0 }),
        hint: null,
      }
    }
    case 'HINT':
      return { ...state, hint: action.hint }
    case 'SUBMIT':
      if (wordCount(state.transcript + ' ' + state.interim) < 3) return { ...state, hint: 'Расскажите чуть подробнее', recording: 'idle' }
      return { ...state, transcript: (state.transcript + ' ' + state.interim).trim(), interim: '', phase: 'checking', recording: 'idle', hint: null }
    case 'CHECK_OK': {
      const r = action.result
      if (r.score >= 1) return accept(state, r.slots, 1, [])
      // второе уточнение не задаём — SPEC §5, D3, AC-5
      if (state.clarified) return accept(state, r.slots, r.score, r.missing)
      return {
        ...state,
        phase: 'clarify',
        clarified: true,
        pending: r,
        baseWords: wordCount(state.transcript),
        sectors: setSector(state.sectors, state.qIndex, { filled: Math.round(TICKS * r.score), live: 0, gap: 0 }),
      }
    }
    case 'CHECK_FAIL':
      // деградация до уровня min, ошибку не показываем — SPEC §6, AC-9
      return accept(state, action.fallback.slots, action.fallback.score, [], true)
    case 'SKIP':
      return state.pending ? accept(state, state.pending.slots, state.pending.score, state.pending.missing) : state
    case 'NEXT': {
      const next = state.answers.findIndex((a, i) => i > state.qIndex && !a)
      if (state.qIndex + 1 < QUESTIONS.length && state.answers[state.qIndex + 1]) return openQuestion(state, state.qIndex + 1)
      if (next !== -1) return openQuestion(state, next)
      const firstEmpty = state.answers.findIndex((a) => !a)
      if (firstEmpty !== -1) return openQuestion(state, firstEmpty)
      return { ...state, phase: 'generating', recording: 'idle' }
    }
    case 'BACK':
      return state.qIndex > 0 ? openQuestion(state, state.qIndex - 1) : state
    case 'REWRITE':
      return {
        ...state,
        phase: 'question',
        transcript: '',
        answers: state.answers.map((a, i) => (i === state.qIndex ? null : a)),
        sectors: setSector(state.sectors, state.qIndex, { filled: 0, live: 0, gap: 0 }),
        clarified: false,
        pending: null,
        baseWords: 0,
      }
    case 'GEN_OK':
      return { ...state, phase: 'result', vacancy: action.vacancy }
    case 'GEN_FAIL':
      return { ...state, phase: 'generation_error' }
    case 'RETRY':
      return { ...state, phase: 'generating' }
    case 'UPDATE_VACANCY':
      return { ...state, vacancy: action.vacancy }
    case 'RESET':
      return { ...initialState(action.mode), micDenied: state.micDenied, mode: state.micDenied ? 'text' : action.mode }
  }
}
