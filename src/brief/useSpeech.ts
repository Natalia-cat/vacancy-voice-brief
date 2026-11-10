import { useCallback, useEffect, useRef, useState } from 'react'
import { wordCount } from '../pipeline/text'

// Web Speech API, ru-RU. Аудио нигде не сохраняется (SPEC §15).
// Тайминги — SPEC §7: автостоп после 3 с тишины при ≥ 3 словах, подсказка после 8 с без речи, лимит 120 с.

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

const Ctor: (new () => Recognition) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined
    : undefined

export const speechSupported = !!Ctor

export type SpeechEvents = {
  onText: (finalText: string, interim: string) => void
  onSilence: () => void
  onDenied: () => void
  onNetwork: () => void
}

export function useSpeech(events: SpeechEvents) {
  const ev = useRef(events)
  ev.current = events
  const rec = useRef<Recognition | null>(null)
  const want = useRef(false)
  const base = useRef('')
  const finalText = useRef('')
  const startedAt = useRef(0)
  const lastSpeech = useRef(0)
  const [listening, setListening] = useState(false)
  const [noSpeech, setNoSpeech] = useState(false)

  const stop = useCallback(() => {
    want.current = false
    rec.current?.stop()
    setListening(false)
    setNoSpeech(false)
  }, [])

  const start = useCallback((prefix: string) => {
    if (!Ctor) return
    base.current = prefix ? prefix.trim() + ' ' : ''
    finalText.current = ''
    want.current = true
    startedAt.current = Date.now()
    lastSpeech.current = 0
    setNoSpeech(false)
    const r = new Ctor()
    r.lang = 'ru-RU'
    r.continuous = true
    r.interimResults = true
    r.onstart = () => setListening(true)
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText.current += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      lastSpeech.current = Date.now()
      setNoSpeech(false)
      ev.current.onText((base.current + finalText.current).replace(/\s+/g, ' ').trim(), interim.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        want.current = false
        ev.current.onDenied()
      } else if (e.error === 'network') {
        want.current = false
        ev.current.onNetwork()
      }
    }
    r.onend = () => {
      // Chrome сам завершает распознавание после паузы — перезапускаем, пока запись не остановлена
      if (want.current) {
        base.current = (base.current + finalText.current).replace(/\s+/g, ' ').trim() + ' '
        finalText.current = ''
        try {
          r.start()
        } catch {
          setListening(false)
        }
      } else setListening(false)
    }
    rec.current = r
    try {
      r.start()
    } catch {
      ev.current.onDenied()
    }
  }, [])

  // таймеры тишины
  useEffect(() => {
    if (!listening) return
    const id = setInterval(() => {
      const now = Date.now()
      const text = base.current + finalText.current
      if (now - startedAt.current > 120_000) return ev.current.onSilence()
      if (!lastSpeech.current && now - startedAt.current > 8000) setNoSpeech(true)
      if (lastSpeech.current && wordCount(text) >= 3 && now - lastSpeech.current > 3000) ev.current.onSilence()
    }, 250)
    return () => clearInterval(id)
  }, [listening])

  useEffect(() => () => {
    want.current = false
    rec.current?.abort()
  }, [])

  return { start, stop, listening, noSpeech }
}
