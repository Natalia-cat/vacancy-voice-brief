import { motion } from 'framer-motion'
import { useState } from 'react'
import { Icon } from '../components/Icons'
import { vacancyToMarkdown } from '../pipeline/generate'
import type { Vacancy } from '../pipeline/types'

type Props = {
  vacancy: Vacancy
  onChange: (v: Vacancy) => void
  onSave: () => void
  onRestart?: () => void
  onToast: (text: string) => void
  saved?: boolean
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function Result({ vacancy: v, onChange, onSave, onRestart, onToast, saved }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const set = (patch: Partial<Vacancy>) => onChange({ ...v, ...patch })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(vacancyToMarkdown(v))
      onToast('Скопировано')
    } catch {
      onToast('Не удалось скопировать — выделите текст вручную')
    }
  }
  const save = () => {
    setEditing(false)
    onSave()
  }

  const area = (value: string, onValue: (s: string) => void, label: string) => (
    <textarea className="editable" aria-label={label} value={value} rows={2} onChange={(e) => onValue(e.target.value)} />
  )

  const actions = (
    <>
      {onRestart && (
        <button className="btn btn--outlined" onClick={() => setConfirm(true)}>Начать заново</button>
      )}
      <button className="btn btn--filled" onClick={save}>Сохранить</button>
    </>
  )

  return (
    <motion.div className="page" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="page-head">
        <div>
          <span className="label accent">{saved ? 'Вакансия' : 'Вакансия готова'}</span>
          <h1>Проверьте вакансию</h1>
        </div>
        <div className="page-actions">
          <button className="icon-btn" aria-label={editing ? 'Закончить редактирование' : 'Редактировать вакансию'} aria-pressed={editing} onClick={() => setEditing((e) => !e)} style={editing ? { color: 'var(--color-accent)' } : undefined}>
            <Icon name="edit" />
          </button>
          <button className="icon-btn" aria-label="Скопировать вакансию" onClick={copy}>
            <Icon name="copy" />
          </button>
          <span className="divider-v" />
          {actions}
        </div>
      </div>

      <article className={`card ${editing ? 'card--editing' : ''}`}>
        <div className={`title-field ${v.title ? 'title-field--filled' : ''}`}>
          <input aria-label="Название должности" placeholder="Название должности" value={v.title} onChange={(e) => set({ title: e.target.value })} />
          {!v.title && <span className="muted" style={{ font: 'var(--type-small)' }}>Впишите сами — по ответам должность не угадать, а выдумывать не будем</span>}
        </div>

        {(v.summary || editing) && (
          <section className="block">
            <span className="label">Коротко о роли</span>
            {editing ? area(v.summary, (s) => set({ summary: s }), 'Коротко о роли') : <p>{v.summary}</p>}
          </section>
        )}
        {(v.tasks.length > 0 || editing) && (
          <section className="block">
            <span className="label">Задачи</span>
            {editing ? area(v.tasks.join('\n'), (s) => set({ tasks: lines(s) }), 'Задачи, по одной в строке') : <ul>{v.tasks.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        )}
        {(v.project || editing) && (
          <section className="block">
            <span className="label">Проект на первые полгода</span>
            {editing ? area(v.project, (s) => set({ project: s }), 'Проект') : <p>{v.project}</p>}
          </section>
        )}
        {(v.outlook || editing) && (
          <section className="block">
            <span className="label">Что дальше</span>
            {editing ? area(v.outlook, (s) => set({ outlook: s }), 'Что дальше') : <p>{v.outlook}</p>}
          </section>
        )}
        {(v.tools.length + v.knowledge.length > 0 || editing) && (
          <section className="block">
            <span className="label">Инструменты и знания</span>
            {editing ? (
              area([...v.tools, ...v.knowledge].join('\n'), (s) => set({ tools: lines(s), knowledge: [] }), 'Инструменты и знания, по одному в строке')
            ) : (
              <div className="chips">{[...v.tools, ...v.knowledge].map((t) => <span className="chip" key={t}>{t}</span>)}</div>
            )}
          </section>
        )}
        {v.toClarify.length > 0 && (
          <div className="gap-box">
            <span className="label accent">Стоит уточнить</span>
            {v.toClarify.length === 1 ? <span>{v.toClarify[0]} — в ответах этого не было</span> : <ul>{v.toClarify.map((t) => <li key={t}>{t}</li>)}</ul>}
          </div>
        )}
      </article>

      <div className="result-bar">{actions}</div>

      {confirm && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="restart-title" onClick={() => setConfirm(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 id="restart-title">Начать заново?</h2>
            <p>Ответы и эта вакансия удалятся. Сохранённые вакансии останутся в списке.</p>
            <div className="actions">
              <button className="btn btn--text" autoFocus onClick={() => setConfirm(false)}>Отмена</button>
              <button className="btn btn--filled" onClick={() => { setConfirm(false); onRestart?.() }}>Начать заново</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
