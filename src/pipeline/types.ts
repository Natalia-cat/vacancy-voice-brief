// Контракт пайплайна — SPEC §13. В прототипе реализован правилами на клиенте,
// в продакшне эти же функции уходят на сервер к LLM без изменения интерфейса.

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4'

export type Decision = 'continue' | 'switch' | 'unknown'

export type Slots = {
  tasks?: string[]
  project?: string
  goal?: string
  decision?: Decision
  next_project?: string
  tools?: string[]
  knowledge?: string[]
}

export type CheckResult = {
  /** 0..1 — полнота ответа по правилам SPEC §5 */
  score: number
  slots: Slots
  /** незаполненные обязательные слоты */
  missing: (keyof Slots)[]
  /** null, если score = 1 */
  clarification: string | null
}

export type Answer = {
  questionId: QuestionId
  transcript: string
  slots: Slots
  /** слоты, которые остались пустыми после уточнения или пропуска */
  gaps: (keyof Slots)[]
  score: number
}

export type Vacancy = {
  /** пустая строка — пользователь вписывает сам (SPEC §15: не выдумываем) */
  title: string
  summary: string
  tasks: string[]
  project: string
  outlook: string
  tools: string[]
  knowledge: string[]
  toClarify: string[]
}

export class PipelineError extends Error {}
