/** Row configuration page: question wait and timeout behavior. */
import { useCallback, useState } from 'react'
import type { SettingsKey } from './settings-locales.ts'
import { settingsEn } from './settings-locales.ts'

const DEFAULTS = { questionTimeoutSeconds: 120, timeoutBehavior: 'native', goalTimeoutBehavior: 'native' } as const
const MAX_QUESTION_TIMEOUT_SECONDS = 2147483

type Behavior = 'native' | 'default'
interface ConfigValue {
  questionTimeoutSeconds: number
  timeoutBehavior: Behavior
  goalTimeoutBehavior: Behavior
}
interface Draft {
  questionTimeoutSeconds: string
  timeoutBehavior: Behavior
  goalTimeoutBehavior: Behavior
}
interface DraftState {
  revision: number
  value: Draft
}

const fallbackT = (key: SettingsKey): string => settingsEn[key]

function normalize(value: any): ConfigValue {
  const seconds = value?.questionTimeoutSeconds
  return {
    questionTimeoutSeconds: seconds === -1 || (Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_QUESTION_TIMEOUT_SECONDS)
      ? seconds
      : DEFAULTS.questionTimeoutSeconds,
    timeoutBehavior: value?.timeoutBehavior === 'default' ? 'default' : 'native',
    goalTimeoutBehavior: value?.goalTimeoutBehavior === 'default' ? 'default' : 'native',
  }
}

function toDraft(value: ConfigValue): Draft {
  return {
    questionTimeoutSeconds: String(value.questionTimeoutSeconds),
    timeoutBehavior: value.timeoutBehavior,
    goalTimeoutBehavior: value.goalTimeoutBehavior,
  }
}

function parseSeconds(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '-1') return -1
  if (!/^[0-9]+$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_QUESTION_TIMEOUT_SECONDS ? value : undefined
}

function same(left: ConfigValue, right: ConfigValue): boolean {
  return left.questionTimeoutSeconds === right.questionTimeoutSeconds
    && left.timeoutBehavior === right.timeoutBehavior
    && left.goalTimeoutBehavior === right.goalTimeoutBehavior
}

function parseDraft(draft: Draft): ConfigValue | undefined {
  const seconds = parseSeconds(draft.questionTimeoutSeconds)
  if (seconds === undefined) return undefined
  return { questionTimeoutSeconds: seconds, timeoutBehavior: draft.timeoutBehavior, goalTimeoutBehavior: draft.goalTimeoutBehavior }
}

const fieldStyle = { display: 'grid', gap: 6, marginBottom: 18 } as const
const labelStyle = { fontWeight: 600, fontSize: 13 } as const
const hintStyle = { margin: 0, fontSize: 12, opacity: 0.65, lineHeight: 1.45 } as const
const inputStyle = { maxWidth: 320, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit' } as const
const statusStyle = { fontSize: 12, lineHeight: 1.5 } as const

/** Page body, rendered inside the settings host's row config page. */
export function SettingsPage({ form, t = fallbackT }: { form?: any; t?: (key: SettingsKey) => string }) {
  const state = form?.state
  const revision: number | undefined = state?.revision
  const host = state?.status === 'ready' ? normalize(state.value) : null
  const base = host === null ? null : toDraft(host)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const live = draft !== null && draft.revision === revision ? draft.value : base
  const parsed = live === null ? undefined : parseDraft(live)
  const writable = state?.status === 'ready' && state?.writable === true
  const dirty = host !== null && parsed !== undefined && !same(host, parsed)

  const edit = useCallback((mutate: (baseDraft: Draft) => Draft) => {
    setNotice(null)
    if (base === null) return
    setDraft((previous) => {
      const current = previous !== null && previous.revision === revision ? previous.value : base
      return { revision: revision ?? 0, value: mutate(current) }
    })
  }, [base, revision])

  const save = useCallback(async () => {
    if (form === undefined || host === null || parsed === undefined) return
    if (!writable || busy || !dirty) return
    const ops: Array<{ op: 'set'; path: string[]; value: unknown }> = []
    if (host.questionTimeoutSeconds !== parsed.questionTimeoutSeconds) {
      ops.push({ op: 'set', path: ['questionTimeoutSeconds'], value: parsed.questionTimeoutSeconds })
    }
    if (host.timeoutBehavior !== parsed.timeoutBehavior) {
      ops.push({ op: 'set', path: ['timeoutBehavior'], value: parsed.timeoutBehavior })
    }
    if (host.goalTimeoutBehavior !== parsed.goalTimeoutBehavior) {
      ops.push({ op: 'set', path: ['goalTimeoutBehavior'], value: parsed.goalTimeoutBehavior })
    }
    if (ops.length === 0) return
    setBusy(true)
    setNotice(null)
    try {
      const accepted = await form.mutate(ops, revision)
      if (accepted) setNotice({ tone: 'ok', text: t('saved') })
      else { setDraft(null); setNotice({ tone: 'error', text: t('conflict') }) }
    } catch (error) {
      setNotice({ tone: 'error', text: t('saveFailed') + String((error as any)?.message ?? error) })
    } finally {
      setBusy(false)
    }
  }, [busy, dirty, form, host, parsed, revision, t, writable])

  if (state === undefined) {
    return <div style={{ padding: 4 }}><p style={statusStyle}>{t('waiting')}</p></div>
  }
  if (state.status === 'loading') {
    return <div style={{ padding: 4 }}><p style={statusStyle}>{t('loading')}</p></div>
  }
  if (host === null || live === null) {
    return <div style={{ padding: 4 }}><p style={statusStyle}>{t('unavailable')}</p></div>
  }

  const invalid = parsed === undefined
  const status = notice !== null
    ? <span style={{ ...statusStyle, color: notice.tone === 'ok' ? '#2f8f4e' : '#c0392b' }}>{notice.text}</span>
    : invalid
      ? <span style={{ ...statusStyle, color: '#c0392b' }}>{t('invalidWait')}</span>
      : dirty
        ? <span style={statusStyle}>{t('dirty')}</span>
        : null

  return (
    <div style={{ padding: '4px 2px', maxWidth: 720 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('title')}</h3>
      <p style={{ ...hintStyle, marginBottom: 18 }}>{t('intro')}</p>
      {writable ? null : <p style={{ ...statusStyle, marginBottom: 14 }}>{t('readonly')}</p>}

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="better-ask-user-wait">{t('waitLabel')}</label>
        <input
          id="better-ask-user-wait"
          type="number"
          min={-1}
          max={MAX_QUESTION_TIMEOUT_SECONDS}
          step={1}
          style={inputStyle}
          value={live.questionTimeoutSeconds}
          disabled={!writable || busy}
          onChange={(event) => {
            const next = event.target.value
            edit((current) => ({ ...current, questionTimeoutSeconds: next }))
          }}
        />
        <p style={hintStyle}>{t('waitHint')}</p>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="better-ask-user-behavior">{t('behaviorLabel')}</label>
        <select
          id="better-ask-user-behavior"
          style={inputStyle}
          value={live.timeoutBehavior}
          disabled={!writable || busy}
          onChange={(event) => {
            const next = event.target.value === 'default' ? 'default' : 'native'
            edit((current) => ({ ...current, timeoutBehavior: next }))
          }}
        >
          <option value="native">{t('native')}</option>
          <option value="default">{t('default')}</option>
        </select>
        <p style={hintStyle}>{t(live.timeoutBehavior === 'default' ? 'defaultHint' : 'nativeHint')}</p>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="better-ask-user-goal-behavior">{t('goalBehaviorLabel')}</label>
        <select
          id="better-ask-user-goal-behavior"
          style={inputStyle}
          value={live.goalTimeoutBehavior}
          disabled={!writable || busy}
          onChange={(event) => {
            const next = event.target.value === 'default' ? 'default' : 'native'
            edit((current) => ({ ...current, goalTimeoutBehavior: next }))
          }}
        >
          <option value="native">{t('native')}</option>
          <option value="default">{t('default')}</option>
        </select>
        <p style={hintStyle}>{t(live.goalTimeoutBehavior === 'default' ? 'defaultHint' : 'nativeHint')}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          disabled={!writable || busy || !dirty || invalid}
          onClick={() => { void save() }}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(127,127,127,.35)', background: 'rgba(127,127,127,.12)', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
        >
          {busy ? t('saving') : t('save')}
        </button>
        {status}
      </div>
    </div>
  )
}

/** Row-config entry component: list summary plus the page body. */
export function SettingsEntry(props: any) {
  const t = props.t ?? fallbackT
  if (props.view === 'summary') return <span>{t('summary')}</span>
  return <SettingsPage form={props.form} t={t} />
}
