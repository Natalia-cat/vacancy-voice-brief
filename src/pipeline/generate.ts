import { joinRu, lowerFirst, unique } from './text'
import { PipelineError, type Answer, type Slots, type Vacancy } from './types'

// Имитация генерации — шаблон SPEC §13. Правило: ничего не выдумываем.
// Чего нет в ответах — уходит в «Стоит уточнить», а не дописывается.

const GAP_TEXT: Record<keyof Slots, string> = {
  tasks: 'Ещё одна регулярная задача сотрудника',
  project: 'Что за проект на первые полгода',
  goal: 'Какой результат по проекту нужен через полгода',
  decision: 'Чем сотрудник займётся после первых полугода',
  next_project: 'Какой проект будет следующим',
  tools: 'Какими программами и сервисами он будет пользоваться',
  knowledge: 'Какие знания и опыт ему нужны',
}

export function generateSync(answers: Answer[]): Vacancy {
  const slots: Slots = Object.assign({}, ...answers.map((a) => a.slots))
  const gaps = answers.flatMap((a) => a.gaps)
  const tasks = slots.tasks ?? []
  const project = slots.project ?? ''

  const summaryParts: string[] = []
  if (tasks.length) summaryParts.push(`Сотрудник будет ${joinRu(tasks.map(lowerFirst))}.`)
  if (project) summaryParts.push(`Первые полгода — ${lowerFirst(project)}${slots.goal ? `: ${lowerFirst(slots.goal)}` : ''}.`)

  const outlook =
    slots.decision === 'continue'
      ? 'Продолжит развивать этот проект'
      : slots.decision === 'switch'
        ? slots.next_project
          ? `Перейдёт на ${lowerFirst(slots.next_project)}`
          : 'Перейдёт на другой проект'
        : slots.decision === 'unknown'
          ? 'Планы на вторые полгода пока не определены'
          : ''

  return {
    title: '',
    summary: summaryParts.join(' '),
    tasks,
    project: project + (slots.goal ? `. ${slots.goal}` : ''),
    outlook,
    tools: unique(slots.tools ?? []),
    knowledge: unique(slots.knowledge ?? []),
    toClarify: unique(gaps.map((g) => GAP_TEXT[g])),
  }
}

export function vacancyToMarkdown(v: Vacancy): string {
  const lines: string[] = []
  lines.push(`# ${v.title || 'Название должности'}`, '')
  if (v.summary) lines.push(v.summary, '')
  if (v.tasks.length) lines.push('## Задачи', ...v.tasks.map((t) => `- ${t}`), '')
  if (v.project) lines.push('## Проект на первые полгода', v.project, '')
  if (v.outlook) lines.push('## Что дальше', v.outlook, '')
  const skills = [...v.tools, ...v.knowledge]
  if (skills.length) lines.push('## Инструменты и знания', ...skills.map((t) => `- ${t}`), '')
  return lines.join('\n').trim() + '\n'
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generate(answers: Answer[]): Promise<Vacancy> {
  await wait(2600)
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('fail') === 'generate')
    throw new PipelineError('generate failed (?fail=generate)')
  return generateSync(answers)
}
