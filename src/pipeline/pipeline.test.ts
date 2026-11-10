import { describe, expect, it } from 'vitest'
import { checkSync } from './check'
import { generateSync } from './generate'
import type { Answer, QuestionId } from './types'

const answer = (questionId: QuestionId, transcript: string, gaps: Answer['gaps'] = []): Answer => {
  const r = checkSync(questionId, transcript)
  return { questionId, transcript, slots: r.slots, gaps, score: r.score }
}

describe('check — q1 задачи (SPEC §5, AC-3, AC-4)', () => {
  it('две задачи через «и» — полный ответ', () => {
    const r = checkSync('q1', 'в первую очередь он будет разбирать входящие заявки от клиентов и готовить еженедельные отчёты')
    expect(r.score).toBe(1)
    expect(r.slots.tasks).toEqual(['Разбирать входящие заявки от клиентов', 'Готовить еженедельные отчёты'])
    expect(r.clarification).toBeNull()
  })
  it('одна задача — 0.5 и уточнение', () => {
    const r = checkSync('q1', 'В первую очередь он будет разбирать входящие заявки от клиентов.')
    expect(r.score).toBe(0.5)
    expect(r.clarification).toMatch(/ещё одну задачу/)
  })
  it('короткий хвост после «и» не считается отдельной задачей', () => {
    const r = checkSync('q1', 'обрабатывать заявки и обращения')
    expect(r.slots.tasks).toHaveLength(1)
  })
})

describe('check — q2 проект', () => {
  it('проект и цель', () => {
    const r = checkSync('q2', 'личный кабинет для партнёров, чтобы к марту перевести туда все заказы')
    expect(r.score).toBe(1)
    expect(r.slots.goal).toMatch(/^Чтобы/)
  })
  it('без цели — уточнение про результат', () => {
    const r = checkSync('q2', 'Запуск личного кабинета для партнёров')
    expect(r.score).toBe(0.5)
    expect(r.missing).toEqual(['goal'])
  })
})

describe('check — q3 что дальше', () => {
  it('«пока не знаем» — полный ответ без уточнения', () => {
    expect(checkSync('q3', 'пока не знаем, посмотрим по результатам').score).toBe(1)
  })
  it('переход с названием проекта', () => {
    const r = checkSync('q3', 'скорее всего перейдёт на запуск мобильного приложения для курьеров')
    expect(r.slots.decision).toBe('switch')
    expect(r.slots.next_project).toBe('Запуск мобильного приложения для курьеров')
    expect(r.score).toBe(1)
  })
  it('переход без проекта — 0.5', () => {
    const r = checkSync('q3', 'возьмётся за другой')
    expect(r.score).toBe(0.5)
    expect(r.missing).toEqual(['next_project'])
  })
  it('продолжит', () => {
    expect(checkSync('q3', 'продолжит этот проект').slots.decision).toBe('continue')
  })
})

describe('check — q4 инструменты и знания', () => {
  it('инструменты латиницей и знания', () => {
    const r = checkSync('q4', 'Excel, amoCRM и Jira, нужно знать процессы поддержки и иметь опыт с B2B-клиентами')
    expect(r.slots.tools).toEqual(['Excel', 'amoCRM', 'Jira'])
    expect(r.slots.knowledge).toEqual(['Знать процессы поддержки', 'Опыт с B2B-клиентами'])
    expect(r.score).toBe(1)
  })
  it('только инструменты — уточнение про знания', () => {
    const r = checkSync('q4', 'Excel и 1С')
    expect(r.slots.tools).toEqual(['Excel', '1С'])
    expect(r.missing).toEqual(['knowledge'])
  })
})

describe('generate (SPEC §13, AC-13, AC-14)', () => {
  const answers = [
    answer('q1', 'разбирать входящие заявки клиентов и готовить еженедельные отчёты'),
    answer('q2', 'Запуск личного кабинета для партнёров', ['goal']),
    answer('q3', 'перейдёт на запуск мобильного приложения для курьеров'),
    answer('q4', 'Excel, amoCRM, нужно знать процессы поддержки'),
  ]
  const v = generateSync(answers)
  it('не придумывает должность', () => expect(v.title).toBe(''))
  it('пробел попадает в «Стоит уточнить»', () =>
    expect(v.toClarify).toEqual(['Какой результат по проекту нужен через полгода']))
  it('собирает краткое описание из ответов', () =>
    expect(v.summary).toBe(
      'Сотрудник будет разбирать входящие заявки клиентов и готовить еженедельные отчёты. Первые полгода — запуск личного кабинета для партнёров.',
    ))
  it('ничего лишнего (зарплата, формат работы)', () => expect(JSON.stringify(v)).not.toMatch(/зарплат|удалён|офис/i))
})
