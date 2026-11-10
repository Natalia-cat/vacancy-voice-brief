import type { ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icons'

export type Settings = { defaultMode: 'voice' | 'text'; hints: boolean }

type Props = {
  settings: Settings
  onSettings: (s: Settings) => void
  created: number
  onToast: (t: string) => void
}

function Row({ icon, title, sub, value, children, onClick, danger }: { icon: IconName; title: string; sub?: string; value?: string; children?: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button className={`row ${danger ? 'row--danger' : ''}`} onClick={onClick}>
      <span className="row-icon"><Icon name={icon} /></span>
      <span className="row-text">
        {title}
        {sub && <small>{sub}</small>}
      </span>
      {value && <span className="row-value">{value}</span>}
      {children}
    </button>
  )
}

export function Profile({ settings, onSettings, created, onToast }: Props) {
  return (
    <div className="page">
      <div className="page-head"><h1>Профиль</h1></div>
      <div className="profile">
        <div>
          <div className="user-card">
            <span className="avatar avatar--l">АП</span>
            <div>
              <h2>Алексей Петров</h2>
              <div className="muted">Руководитель отдела поддержки</div>
              <div className="muted">ООО «Северный ветер»</div>
            </div>
          </div>
          <div className="stats">
            <div className="stat"><b>{created}</b><span>вакансий создано</span></div>
            <div className="stat"><b>Бизнес</b><span>тариф · до 15 дек</span></div>
          </div>
        </div>

        <div className="settings">
          <div className="settings-group">
            <span className="label">Бриф</span>
            <div className="settings-box">
              <Row icon="globe" title="Язык распознавания" sub="Для голосовых ответов" value="Русский" onClick={() => onToast('В прототипе доступен только русский')} />
              <Row
                icon={settings.defaultMode === 'voice' ? 'mic' : 'keyboard'}
                title="Ответ по умолчанию"
                sub="Можно переключить на любом вопросе"
                value={settings.defaultMode === 'voice' ? 'Голосом' : 'Текстом'}
                onClick={() => onSettings({ ...settings, defaultMode: settings.defaultMode === 'voice' ? 'text' : 'voice' })}
              />
              <Row icon="keyboard" title="Подсказки к вопросам" sub="Примеры под каждым вопросом" onClick={() => onSettings({ ...settings, hints: !settings.hints })}>
                <span className="switch" role="switch" aria-checked={settings.hints} aria-label="Подсказки к вопросам"><i /></span>
              </Row>
            </div>
          </div>
          <div className="settings-group">
            <span className="label">Аккаунт</span>
            <div className="settings-box">
              <Row icon="bell" title="Уведомления" sub="Когда вакансия ждёт уточнения" onClick={() => onToast('В прототипе уведомления не настраиваются')}>
                <span className="muted"><Icon name="chevron" /></span>
              </Row>
              <Row icon="logout" title="Выйти" danger onClick={() => onToast('В прототипе выход отключён')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
