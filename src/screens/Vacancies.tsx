import { Icon } from '../components/Icons'
import { lowerFirst } from '../pipeline/text'
import type { SavedVacancy } from '../brief/storage'

type Props = {
  list: SavedVacancy[]
  draft: { step: number } | null
  onOpen: (id: string) => void
  onDraft: () => void
  onNew: () => void
}

const gapsLabel = (n: number) => `Уточнить · ${n}`

export function Vacancies({ list, draft, onOpen, onDraft, onNew }: Props) {
  const needs = list.filter((v) => v.vacancy.toClarify.length).length
  const total = list.length + (draft ? 1 : 0)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Мои вакансии</h1>
          <span className="muted">
            {total} {total === 1 ? 'вакансия' : total < 5 ? 'вакансии' : 'вакансий'}
            {needs > 0 && <> · <span className="accent">{needs} нужно уточнить</span></>}
          </span>
        </div>
      </div>

      {total === 0 ? (
        // пустое состояние — список ещё не создан
        <div className="empty">
          <Icon name="work" size={32} />
          <p style={{ margin: 0, font: 'var(--type-body-l)', color: 'var(--color-text)' }}>Здесь появятся ваши вакансии</p>
          <p style={{ margin: 0 }}>Расскажите о вакансии голосом — описание соберём сами</p>
          <button className="btn btn--filled" onClick={onNew}><Icon name="mic" size={18} /> Создать первую</button>
        </div>
      ) : (
        <div className="list">
          {draft && (
            <button className="vacancy-item vacancy-item--draft" onClick={onDraft}>
              <span className="vacancy-lead"><Icon name="work" /></span>
              <span className="vacancy-text">
                <span className="vacancy-title">Без названия</span>
                <span className="vacancy-sum">Бриф не закончен — продолжить с вопроса {draft.step}</span>
                <span className="vacancy-meta"><span className="badge badge--draft"><span className="dot" />Черновик</span><span className="label">Сегодня</span></span>
              </span>
              <span className="muted"><Icon name="chevron" /></span>
            </button>
          )}
          {list.map(({ id, date, vacancy: v }) => (
            <button key={id} className="vacancy-item" onClick={() => onOpen(id)}>
              <span className="vacancy-lead"><Icon name="work" /></span>
              <span className="vacancy-text">
                <span className="vacancy-title">{v.title || 'Без названия'}</span>
                <span className="vacancy-sum">{v.tasks.map((t, i) => (i ? lowerFirst(t) : t)).join(', ') || v.summary}</span>
                <span className="vacancy-meta">
                  {v.toClarify.length ? (
                    <span className="badge badge--clarify"><span className="dot" />{gapsLabel(v.toClarify.length)}</span>
                  ) : (
                    <span className="badge badge--ready"><span className="dot" />Готова</span>
                  )}
                  <span className="label">{date}</span>
                </span>
              </span>
              <span className="muted"><Icon name="chevron" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
