import type { Answer, Vacancy } from '../pipeline/types'
import type { Sector } from '../components/Ring'

// localStorage — SPEC §9. Обёрнуто в try/catch: в приватном режиме хранилище может быть недоступно.

export type Progress = { qIndex: number; answers: (Answer | null)[]; sectors: Sector[]; vacancy?: Vacancy | null }

export type SavedVacancy = {
  id: string
  date: string
  vacancy: Vacancy
}

const KEY = 'vacancy-brief:v1'
const LIST = 'vacancy-brief:vacancies:v1'

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* хранилище недоступно — прототип работает и без него */
  }
}

export const loadProgress = () => read<Progress>(KEY)
export const saveProgress = (p: Progress | null) => write(KEY, p)

const SEED: SavedVacancy[] = [
  {
    id: 'seed-1',
    date: '7 ноя',
    vacancy: {
      title: 'Аналитик данных',
      summary: 'Сотрудник будет строить отчёты по продажам и проверять качество данных. Первые полгода — единая витрина продаж.',
      tasks: ['Строить отчёты по продажам', 'Проверять качество данных'],
      project: 'Единая витрина продаж',
      outlook: 'Продолжит развивать этот проект',
      tools: ['SQL', 'Power BI'],
      knowledge: [],
      toClarify: ['Какие знания и опыт ему нужны'],
    },
  },
  {
    id: 'seed-2',
    date: '2 ноя',
    vacancy: {
      title: 'Менеджер по закупкам',
      summary: 'Сотрудник будет вести поставщиков и согласовывать договоры и сроки. Первые полгода — перевод закупок в 1С.',
      tasks: ['Вести поставщиков', 'Согласовывать договоры и сроки'],
      project: 'Перевод закупок в 1С. Чтобы к лету все заявки шли через систему',
      outlook: 'Планы на вторые полгода пока не определены',
      tools: ['1С', 'Excel'],
      knowledge: ['Опыт работы с поставщиками'],
      toClarify: [],
    },
  },
]

export const loadVacancies = () => read<SavedVacancy[]>(LIST) ?? SEED
export const saveVacancies = (list: SavedVacancy[]) => write(LIST, list)

export const today = () => new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')
