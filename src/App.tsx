import { useEffect, useMemo, useReducer, useState } from 'react'
import { initialState, reducer } from './brief/machine'
import { loadProgress, loadVacancies, saveProgress, saveVacancies, today, type SavedVacancy } from './brief/storage'
import { Icon, type IconName } from './components/Icons'
import type { Vacancy } from './pipeline/types'
import { Brief } from './screens/Brief'
import { Profile, type Settings } from './screens/Profile'
import { Result } from './screens/Result'
import { Vacancies } from './screens/Vacancies'

type Tab = 'home' | 'vacancies' | 'profile'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'vacancies', label: 'Вакансии', icon: 'work' },
  { id: 'profile', label: 'Профиль', icon: 'person' },
]

const SETTINGS_KEY = 'vacancy-brief:settings:v1'
const loadSettings = (): Settings => {
  try {
    return { defaultMode: 'voice', hints: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return { defaultMode: 'voice', hints: true }
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [state, dispatch] = useReducer(reducer, settings.defaultMode, initialState)
  const [tab, setTab] = useState<Tab>('home')
  const [list, setList] = useState<SavedVacancy[]>(loadVacancies)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [stored, setStored] = useState(loadProgress)

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(null), 1800)
  }

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* без хранилища настройки живут до перезагрузки */
    }
    if (state.phase === 'intro') dispatch({ type: 'SET_MODE', mode: settings.defaultMode })
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // сохраняем прогресс после каждого принятого ответа — SPEC §9 (демо не сохраняем)
  useEffect(() => {
    if (state.demo || state.phase === 'intro') return
    if (!state.answers.some(Boolean)) return
    const p = { qIndex: state.qIndex, answers: state.answers, sectors: state.sectors, vacancy: state.vacancy }
    saveProgress(p)
    setStored(p)
  }, [state.answers, state.vacancy, state.demo]) // eslint-disable-line react-hooks/exhaustive-deps

  const inProgress = state.phase !== 'intro' && state.phase !== 'result' && state.answers.some(Boolean) && !state.demo
  const draftFromStore = stored && stored.answers.some(Boolean) && !stored.vacancy ? stored : null
  const draft = inProgress
    ? { step: (state.answers.findIndex((a) => !a) + 1) || 4 }
    : draftFromStore && state.phase === 'intro'
      ? { step: (draftFromStore.answers.findIndex((a) => !a) + 1) || 4 }
      : null

  const resume = () => {
    if (stored) dispatch({ type: 'RESUME', answers: stored.answers, sectors: stored.sectors, vacancy: stored.vacancy })
  }
  const clearDraft = () => {
    saveProgress(null)
    setStored(null)
    dispatch({ type: 'RESET', mode: settings.defaultMode })
  }

  const saveCurrent = () => {
    if (!state.vacancy) return
    const next = [{ id: crypto.randomUUID?.() ?? String(Date.now()), date: today(), vacancy: state.vacancy }, ...list]
    setList(next)
    saveVacancies(next)
    clearDraft()
    setOpenedId(null)
    setTab('vacancies')
    showToast('Вакансия сохранена')
  }

  const opened = useMemo(() => list.find((v) => v.id === openedId) ?? null, [list, openedId])
  const updateOpened = (vacancy: Vacancy) => setList((l) => l.map((x) => (x.id === openedId ? { ...x, vacancy } : x)))

  const go = (t: Tab) => {
    setOpenedId(null)
    setTab(t)
  }

  let screen
  if (tab === 'vacancies' && opened) {
    screen = (
      <Result
        saved
        vacancy={opened.vacancy}
        onChange={updateOpened}
        onSave={() => {
          saveVacancies(list)
          setOpenedId(null)
          showToast('Изменения сохранены')
        }}
        onToast={showToast}
      />
    )
  } else if (tab === 'vacancies') {
    screen = (
      <Vacancies
        list={list}
        draft={draft}
        onOpen={setOpenedId}
        onDraft={() => {
          if (!inProgress) resume()
          go('home')
        }}
        onNew={() => {
          go('home')
          dispatch({ type: 'START' })
        }}
      />
    )
  } else if (tab === 'profile') {
    screen = <Profile settings={settings} onSettings={setSettings} created={list.length} onToast={showToast} />
  } else if (state.phase === 'result' && state.vacancy) {
    screen = (
      <Result
        vacancy={state.vacancy}
        onChange={(vacancy) => dispatch({ type: 'UPDATE_VACANCY', vacancy })}
        onSave={saveCurrent}
        onRestart={clearDraft}
        onToast={showToast}
      />
    )
  } else {
    screen = <Brief state={state} dispatch={dispatch} showHints={settings.hints} hasDraft={!!draftFromStore} onResume={resume} onDiscardDraft={clearDraft} />
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeDasharray="2 2" /></svg>
          Голосовой бриф
        </div>
        <nav className="tabs" aria-label="Разделы">
          {TABS.map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <Icon name={t.icon} size={20} /> {t.label}
            </button>
          ))}
        </nav>
        <span className="avatar avatar--s" aria-label="Алексей Петров">АП</span>
      </header>

      <main className="main">{screen}</main>

      <nav className="bottom-nav" aria-label="Разделы">
        {TABS.map((t) => (
          <button key={t.id} className="nav-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <span className="indicator"><Icon name={t.icon} /></span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
