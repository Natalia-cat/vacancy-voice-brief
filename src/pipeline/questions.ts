import type { QuestionId, Slots } from './types'

// Тексты вопросов переформулированы про будущего сотрудника — решение D2 в SPEC.
export type Question = {
  id: QuestionId
  title: string
  hint: string
  step: string
  required: (keyof Slots)[]
  /** что сказать, если слот пуст */
  clarifications: Partial<Record<keyof Slots, string>>
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'Какие 2–3 задачи новый сотрудник будет решать каждый день?',
    hint: 'Например: «разбирать заявки клиентов, готовить отчёты»',
    step: 'Задачи',
    required: ['tasks'],
    clarifications: { tasks: 'Назовите ещё одну задачу, которую он будет делать регулярно' },
  },
  {
    id: 'q2',
    title: 'Над каким проектом он будет работать первые полгода?',
    hint: 'Что это за проект и какой результат от него нужен',
    step: 'Проект',
    required: ['project', 'goal'],
    clarifications: {
      project: 'Расскажите, что это за проект',
      goal: 'А какой результат по этому проекту нужен через полгода?',
    },
  },
  {
    id: 'q3',
    title: 'Через полгода он продолжит этот проект или возьмётся за другой?',
    hint: 'Если за другой — за какой',
    step: 'Что дальше',
    required: ['decision'],
    clarifications: {
      decision: 'Он продолжит этот проект или перейдёт на другой? Можно сказать «пока не знаем»',
      next_project: 'За какой проект он возьмётся дальше?',
    },
  },
  {
    id: 'q4',
    title: 'Какие инструменты, программы и знания ему нужны?',
    hint: 'Программы, сервисы, области знаний',
    step: 'Навыки',
    required: ['tools', 'knowledge'],
    clarifications: {
      tools: 'Какими программами или сервисами он будет пользоваться?',
      knowledge: 'А какие знания или опыт ему понадобятся, кроме инструментов?',
    },
  },
]

export const questionById = (id: QuestionId) => QUESTIONS.find((q) => q.id === id)!
