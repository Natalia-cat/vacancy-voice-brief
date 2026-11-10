import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type Dispatch } from 'react'
import { DEMO_CHAR_MS, DEMO_SCRIPT } from '../brief/demo'
import type { Action, State } from '../brief/machine'
import { speechSupported, useSpeech } from '../brief/useSpeech'
import { Icon } from '../components/Icons'
import { Ring } from '../components/Ring'
import { check, checkSync } from '../pipeline/check'
import { generate } from '../pipeline/generate'
import { QUESTIONS } from '../pipeline/questions'
import { wordCount } from '../pipeline/text'
import type { Answer } from '../pipeline/types'

type Props = {
  state: State
  dispatch: Dispatch<Action>
  showHints: boolean
  hasDraft: boolean
  onResume: () => void
  onDiscardDraft: () => void
}

const GEN_PHASES = ['Собираю задачи', 'Описываю проект', 'Формулирую требования']
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)

export function Brief({ state, dispatch, showHints, hasDraft, onResume, onDiscardDraft }: Props) {
  const reduce = useReducedMotion()
  const q = QUESTIONS[state.qIndex]
  const [draft, setDraft] = useState('')
  const [genPhase, setGenPhase] = useState(0)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const voice = state.mode === 'voice' && speechSupported && !state.micDenied
  const live = useRef<HTMLDivElement>(null)
  // ответ до уточнения — к нему дописывается дополнение
  const clarifyBase = useRef('')
  if (state.phase !== 'clarify') clarifyBase.current = state.transcript

  const speech = useSpeech({
    onText: (text, interim) => dispatch({ type: 'TEXT', text, interim }),
    onSilence: () => finishRecording(),
    onDenied: () => {
      speech.stop()
      dispatch({ type: 'MIC_DENIED' })
    },
    onNetwork: () => {
      speech.stop()
      dispatch({ type: 'REC', recording: 'idle' })
      dispatch({ type: 'HINT', hint: 'Связь прервалась. Сказанное сохранено' })
    },
  })

  const startRecording = () => {
    if (!voice) return
    dispatch({ type: 'REC', recording: 'listening' })
    speech.start(state.transcript)
  }
  function finishRecording() {
    speech.stop()
    dispatch({ type: 'SUBMIT' })
  }
  const cancelRecording = () => {
    speech.stop()
    dispatch({ type: 'REC', recording: 'idle' })
  }

  // браузер без Web Speech API — сразу текстовый режим (AC-8)
  useEffect(() => {
    if (!speechSupported && state.mode === 'voice') dispatch({ type: 'SET_MODE', mode: 'text' })
  }, [state.mode, dispatch])

  // проверка ответа
  useEffect(() => {
    if (state.phase !== 'checking') return
    let alive = true
    check(q.id, state.transcript)
      .then((result) => alive && dispatch({ type: 'CHECK_OK', result }))
      .catch(() => alive && dispatch({ type: 'CHECK_FAIL', fallback: checkSync(q.id, state.transcript) }))
    return () => {
      alive = false
    }
  }, [state.phase, q.id, state.transcript, dispatch])

  // принято → через 600 мс следующий вопрос
  useEffect(() => {
    if (state.phase !== 'accepted') return
    const id = setTimeout(() => dispatch({ type: 'NEXT' }), 600)
    return () => clearTimeout(id)
  }, [state.phase, dispatch])

  // генерация
  useEffect(() => {
    if (state.phase !== 'generating') return
    let alive = true
    setGenPhase(0)
    const t = setInterval(() => setGenPhase((p) => (p + 1) % GEN_PHASES.length), 2000)
    generate(state.answers.filter(Boolean) as Answer[])
      .then((vacancy) => alive && dispatch({ type: 'GEN_OK', vacancy }))
      .catch(() => alive && dispatch({ type: 'GEN_FAIL' }))
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [state.phase, state.answers, dispatch])

  // переключение вкладки во время записи → пауза (SPEC §9)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && state.recording === 'listening') {
        speech.stop()
        dispatch({ type: 'REC', recording: 'paused' })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [state.recording, speech, dispatch])

  // клавиатура: пробел — запись/стоп, Esc — отмена записи (SPEC §14)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || state.demo) return
      if (e.code === 'Space' && voice && (state.phase === 'question' || state.phase === 'clarify')) {
        e.preventDefault()
        if (state.recording === 'listening') finishRecording()
        else startRecording()
      }
      if (e.code === 'Escape' && state.recording === 'listening') cancelRecording()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // новый вопрос — чистим поле ввода
  useEffect(() => setDraft(''), [state.qIndex, state.phase === 'clarify'])

  // демо: печатаем ответы сами
  useEffect(() => {
    if (!state.demo) return
    const step = DEMO_SCRIPT[state.qIndex]
    let text = ''
    let base = ''
    if (state.phase === 'question') text = step.answer
    else if (state.phase === 'clarify') {
      if (step.clarify === 'skip') {
        const id = setTimeout(() => dispatch({ type: 'SKIP' }), 1600)
        return () => clearTimeout(id)
      }
      if (!step.clarify) return
      base = state.transcript + ' '
      text = step.clarify
    } else return
    let i = 0
    let id: ReturnType<typeof setTimeout>
    const tick = () => {
      i = Math.min(text.length, i + 2)
      dispatch({ type: 'TEXT', text: (base + text.slice(0, i)).trim() })
      if (i < text.length) id = setTimeout(tick, DEMO_CHAR_MS * 2)
      else id = setTimeout(() => dispatch({ type: 'SUBMIT' }), 500)
    }
    id = setTimeout(tick, state.phase === 'clarify' ? 1400 : 700)
    return () => clearTimeout(id)
  }, [state.demo, state.phase, state.qIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitText = () => {
    const extra = draft.trim()
    const text = state.phase === 'clarify' ? `${clarifyBase.current} ${extra}`.trim() : extra
    if (wordCount(state.phase === 'clarify' ? extra : text) < (state.phase === 'clarify' ? 1 : 3)) {
      dispatch({ type: 'HINT', hint: 'Расскажите чуть подробнее — минимум 3 слова' })
      return
    }
    dispatch({ type: 'TEXT', text })
    dispatch({ type: 'SUBMIT' })
  }
  const onDraft = (v: string) => {
    setDraft(v)
    const text = state.phase === 'clarify' ? `${clarifyBase.current} ${v}` : v
    dispatch({ type: 'TEXT', text: text.trim() })
  }

  const transition = reduce ? { duration: 0.15 } : { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const }
  const screenKey = ['intro', 'generating', 'generation_error'].includes(state.phase) ? state.phase : `q${state.qIndex}`

  // ===== intro =====
  if (state.phase === 'intro') {
    return (
      <div className="brief">
        <div className="brief-body intro">
          <Ring sectors={state.sectors} active={null} label="Бриф не начат">
            <button className="rec-btn" aria-label="Начать бриф" onClick={() => dispatch({ type: 'START' })}>
              <Icon name="mic" size={30} strokeWidth={1.7} />
            </button>
          </Ring>
          <h1>Расскажите о вакансии голосом — описание соберём сами</h1>
          <p>Четыре вопроса о том, чем будет заниматься новый сотрудник. Отвечайте своими словами, как коллеге.</p>
          <span className="label">4 вопроса · около 3 минут · можно текстом</span>
          {hasDraft ? (
            <div className="actions">
              <button className="btn btn--filled" onClick={onResume}>Продолжить бриф</button>
              <button className="btn btn--outlined" onClick={onDiscardDraft}>Начать заново</button>
            </div>
          ) : (
            <div className="actions">
              <button className="btn btn--filled" onClick={() => dispatch({ type: 'START' })}>Начать</button>
              <button className="btn btn--text" onClick={() => dispatch({ type: 'START', demo: true })}>
                <Icon name="play" size={18} /> Посмотреть демо
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ===== generating / error =====
  if (state.phase === 'generating' || state.phase === 'generation_error') {
    const failed = state.phase === 'generation_error'
    return (
      <div className="brief">
        <div className="brief-body">
          <Ring sectors={state.sectors} active={null} complete={!failed} label="Все ответы приняты" />
          <div className="question" aria-live="polite">
            <h1>{failed ? 'Не получилось собрать вакансию' : 'Собираю вакансию'}</h1>
            {failed ? (
              <p>Ответы сохранены — можно попробовать ещё раз.</p>
            ) : (
              <span className="label accent">{GEN_PHASES[genPhase]}…</span>
            )}
          </div>
          {failed && (
            <button className="btn btn--filled" onClick={() => dispatch({ type: 'RETRY' })}>
              <Icon name="refresh" size={18} /> Попробовать снова
            </button>
          )}
        </div>
      </div>
    )
  }

  // ===== вопросы =====
  const listening = state.recording === 'listening'
  const busy = state.phase === 'checking' || state.phase === 'accepted' || state.demo
  const showTranscript = state.transcript || state.interim
  const hint =
    state.hint ??
    (speech.noSpeech ? 'Не слышу вас — говорите ближе к микрофону или ответьте текстом' : null)

  return (
    <div className="brief">
      <div className="brief-top">
        <div className="brief-top-left">
          {state.qIndex > 0 && !busy && state.recording !== 'listening' && (
            <button className="btn btn--text" onClick={() => dispatch({ type: 'BACK' })}>
              <Icon name="back" size={18} /> Назад
            </button>
          )}
          <span className="label">Вопрос {state.qIndex + 1} из 4</span>
          {state.demo && <span className="badge badge--ready"><span className="dot" />Демо</span>}
          {state.demo && (
            <button className="btn btn--text" onClick={() => dispatch({ type: 'START' })}>Попробовать самому</button>
          )}
        </div>
        {state.micDenied && (
          <span className="notice" role="status">
            <span className="dot" /> Микрофон недоступен — отвечайте текстом ·{' '}
            <a className="accent" href="https://support.google.com/chrome/answer/2693767?hl=ru" target="_blank" rel="noreferrer">Как включить</a>
          </span>
        )}
        {!speechSupported && !state.micDenied && (
          <span className="notice" role="status">
            <span className="dot" /> Голосовой ввод работает в Chrome и Edge — здесь отвечайте текстом
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          className="brief-body"
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -24 }}
          transition={transition}
        >
          <div className="question">
            <h1>{q.title}</h1>
            {showHints && <p>{q.hint}</p>}
          </div>

          <Ring sectors={state.sectors} active={state.qIndex} label={`Вопрос ${state.qIndex + 1} из 4`}>
            {voice ? (
              <button
                className={`rec-btn ${listening ? 'rec-btn--on' : ''}`}
                aria-label={listening ? 'Остановить запись и отправить ответ' : 'Начать запись ответа'}
                aria-pressed={listening}
                disabled={busy || state.phase === 'review'}
                onClick={() => (listening ? finishRecording() : startRecording())}
              >
                {listening ? <span style={{ width: 26, height: 26, borderRadius: 6, background: 'currentColor' }} /> : <Icon name="mic" size={30} strokeWidth={1.7} />}
              </button>
            ) : (
              <span className="label">{state.qIndex + 1} / 4</span>
            )}
          </Ring>

          <div ref={live} aria-live="polite" style={{ display: 'contents' }}>
            {listening && (
              <div className="status-line label accent"><span className="dot dot--rec" /> Слушаю</div>
            )}
            {state.recording === 'paused' && <span className="notice notice--info"><span className="dot" />Запись на паузе</span>}
            {showTranscript && (voice || state.phase !== 'question') && (
              <div className={`transcript ${state.phase !== 'question' ? 'transcript--done' : ''}`}>
                {!voice && state.phase === 'clarify' ? clarifyBase.current : state.transcript} <span className="interim">{state.interim}</span>
              </div>
            )}
            {state.phase === 'checking' && <span className="label">Проверяю ответ…</span>}
            {state.phase === 'accepted' && <span className="label accent">Принято</span>}
            {state.phase === 'clarify' && state.pending?.clarification && (
              <div className="clarify">
                <div>
                  <span className="label accent">Почти готово</span>
                  <p>{state.pending.clarification}</p>
                </div>
              </div>
            )}
            {hint && <span className="notice notice--info"><span className="dot" />{hint}</span>}
          </div>

          {/* действия */}
          {state.phase === 'review' && (
            <div className="actions">
              <button className="btn btn--outlined" onClick={() => dispatch({ type: 'REWRITE' })}>Перезаписать</button>
              <button className="btn btn--filled" onClick={() => dispatch({ type: 'NEXT' })}>Далее</button>
            </div>
          )}

          {!voice && (state.phase === 'question' || state.phase === 'clarify') && !state.demo && (
            <div className={`text-field ${state.hint ? 'text-field--error' : ''}`}>
              <span className="label">{state.phase === 'clarify' ? 'Дополните ответ' : 'Ваш ответ'}</span>
              <textarea
                ref={textRef}
                value={draft}
                autoFocus
                rows={2}
                placeholder="Напишите ответ своими словами"
                onChange={(e) => onDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitText()
                  }
                }}
              />
              <div className="text-field-footer">
                <span>{state.hint ?? 'Enter — отправить, Shift+Enter — новая строка'}</span>
                <button className="btn btn--filled" disabled={wordCount(draft) < (state.phase === 'clarify' ? 1 : 3)} onClick={submitText}>
                  Готово
                </button>
              </div>
            </div>
          )}

          {voice && !state.demo && (
            <div className="actions">
              {state.phase === 'question' && listening && (
                <button className="btn btn--filled" onClick={finishRecording}>Готово</button>
              )}
              {state.phase === 'question' && !listening && state.transcript && (
                <>
                  <button className="btn btn--outlined" onClick={startRecording}>Продолжить запись</button>
                  <button className="btn btn--filled" onClick={() => dispatch({ type: 'SUBMIT' })}>Готово</button>
                </>
              )}
              {state.phase === 'question' && !listening && !state.transcript && (
                <span className="muted" style={{ font: 'var(--type-small)' }}>Нажмите и говорите · пробел</span>
              )}
              {state.phase === 'clarify' && !listening && (
                <button className="btn btn--filled" onClick={startRecording}>
                  <Icon name="mic" size={18} /> Дополнить голосом
                </button>
              )}
              {state.phase === 'clarify' && listening && (
                <button className="btn btn--filled" onClick={finishRecording}>Готово</button>
              )}
            </div>
          )}

          {!state.demo && (state.phase === 'question' || state.phase === 'clarify') && !listening && (
            <div className="actions">
              {state.phase === 'clarify' && (
                <button className="btn btn--text" onClick={() => dispatch({ type: 'SKIP' })}>Пропустить</button>
              )}
              {speechSupported && !state.micDenied && (
                <button className="btn btn--text" onClick={() => dispatch({ type: 'SET_MODE', mode: voice ? 'text' : 'voice' })}>
                  <Icon name={voice ? 'keyboard' : 'mic'} size={18} /> {voice ? 'Ответить текстом' : 'Ответить голосом'}
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
