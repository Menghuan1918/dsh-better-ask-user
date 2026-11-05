/** Row configuration page: question wait and timeout behavior. */
import { useCallback, useId, useState, type ReactNode } from 'react'
import type { SettingsKey } from './settings-locales.ts'
import { settingsEn } from './settings-locales.ts'
import css from './settings.module.css'

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

/** Compact settings row with an optional dependency description. */
function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <span className={css.rowTitle} id={`${id}-label`}>{label}</span>
        {hint ? <span className={css.rowDesc} id={`${id}-hint`}>{hint}</span> : null}
      </div>
      <div className={css.control}>{children}</div>
    </div>
  )
}

/** Native radio semantics with one compact, fully styled choice surface. */
function Choices({ id, value, options, disabled, describedBy, onChange }: {
  id: string
  value: string
  options: Array<{ value: string; label: string }>
  disabled: boolean
  describedBy?: string
  onChange: (value: string) => void
}) {
  const name = useId()
  return (
    <div className={css.choices} id={id} role="radiogroup" aria-labelledby={`${id}-label`} aria-disabled={disabled}>
      {options.map((option) => (
        <label className={css.choice} key={option.value}>
          <input
            id={`${id}-${option.value}`}
            type="radio" name={name} value={option.value}
            checked={value === option.value} disabled={disabled}
            aria-describedby={describedBy}
            onChange={() => { onChange(option.value) }}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

/** Page body, rendered inside the settings host's row config page. */
export function SettingsPage({ form, t = fallbackT }: { form?: any; t?: (key: SettingsKey) => string }) {
  const state = form?.state
  const revision: number | undefined = state?.revision
  const host = state?.status === 'ready' ? normalize(state.value) : null
  const base = host === null ? null : toDraft(host)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [busy, setBusy] = useState(false)
  const [timedSeconds, setTimedSeconds] = useState(String(DEFAULTS.questionTimeoutSeconds))
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const live = draft !== null && draft.revision === revision ? draft.value : base
  const parsed = live === null ? undefined : parseDraft(live)
  const writable = state?.status === 'ready' && state?.writable === true
  const dirty = host !== null && (parsed === undefined || !same(host, parsed))

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
      else setNotice({ tone: 'error', text: t('conflict') })
    } catch (error) {
      setNotice({ tone: 'error', text: t('saveFailed') + String((error as any)?.message ?? error) })
    } finally {
      setBusy(false)
    }
  }, [busy, dirty, form, host, parsed, revision, t, writable])

  if (state === undefined) {
    return <div className={css.cfg}><p className={css.note} role="status">{t('waiting')}</p></div>
  }
  if (state.status === 'loading') {
    return <div className={css.cfg}><p className={css.note} role="status">{t('loading')}</p></div>
  }
  if (host === null || live === null) {
    return <div className={css.cfg}><p className={css.note} role="alert">{t('unavailable')}</p></div>
  }

  const invalid = parsed === undefined
  const unlimited = live.questionTimeoutSeconds === '-1'
  const controlsDisabled = !writable || busy
  const behaviors = [{ value: 'native', label: t('native') }, { value: 'default', label: t('default') }]

  return (
    <div className={css.cfg} aria-busy={busy} data-settings-dirty={dirty} data-settings-busy={busy}>
      <div className={css.pageHead}>
        <h2 className={css.title} id="better-ask-user-title">{t('title')}</h2>
        {writable ? null : <span className={css.badge} role="status">{t('readonly')}</span>}
      </div>
      <section className={css.group} aria-label={t('title')}>
        <Row id="better-ask-user-wait-mode" label={t('waitLabel')}>
          <Choices
            id="better-ask-user-wait-mode" value={unlimited ? 'unlimited' : 'timed'}
            options={[{ value: 'timed', label: t('timed') }, { value: 'unlimited', label: t('unlimited') }]}
            disabled={controlsDisabled} describedBy="better-ask-user-wait-hint"
            onChange={(value) => {
              const nextUnlimited = value === 'unlimited'
              if (nextUnlimited && !invalid) setTimedSeconds(live.questionTimeoutSeconds)
              edit(current => ({ ...current, questionTimeoutSeconds: nextUnlimited ? '-1' : timedSeconds }))
            }}
          />
          {unlimited ? null : <span className={css.duration}>
            <input
              id="better-ask-user-wait" className={css.input}
              aria-label={t('durationLabel')}
              aria-describedby={invalid ? 'better-ask-user-error' : 'better-ask-user-wait-hint'}
              type="text" inputMode="numeric" aria-invalid={invalid || undefined}
              value={live.questionTimeoutSeconds} disabled={controlsDisabled}
              onChange={(event) => { edit(current => ({ ...current, questionTimeoutSeconds: event.target.value })) }}
            />
            <span className={css.unit}>{t('seconds')}</span>
          </span>}
        </Row>
        <p className={css.srOnly} id="better-ask-user-wait-hint">{t(unlimited ? 'unlimitedHint' : 'waitHint')}</p>
        {invalid && <p className={css.fieldError} id="better-ask-user-error" role="alert">{t('invalidWait')}</p>}
        {!unlimited && <>
          <h3 className={css.sectionLabel}>{t('timeoutTitle')}</h3>
          <Row id="better-ask-user-behavior" label={t('behaviorLabel')}>
            <Choices
              id="better-ask-user-behavior" value={live.timeoutBehavior} options={behaviors}
              disabled={controlsDisabled} describedBy="better-ask-user-timeout-hint"
              onChange={(value) => { edit(current => ({ ...current, timeoutBehavior: value as Behavior })) }}
            />
          </Row>
          <p className={css.srOnly} id="better-ask-user-timeout-hint">{t(live.timeoutBehavior === 'default' ? 'defaultHint' : 'nativeHint')}</p>
          <details className={css.advanced}>
            <summary>
              <span>{t('advanced')}</span>
              {live.goalTimeoutBehavior !== DEFAULTS.goalTimeoutBehavior && <span className={css.advancedValue}>{t('goalBehaviorLabel')} · {t(live.goalTimeoutBehavior)}</span>}
              <span className={css.chevron} aria-hidden="true" />
            </summary>
            <Row id="better-ask-user-goal-behavior" label={t('goalBehaviorLabel')}>
              <Choices
                id="better-ask-user-goal-behavior" value={live.goalTimeoutBehavior} options={behaviors}
                disabled={controlsDisabled} describedBy="better-ask-user-goal-hint"
                onChange={(value) => { edit(current => ({ ...current, goalTimeoutBehavior: value as Behavior })) }}
              />
            </Row>
            <p className={css.srOnly} id="better-ask-user-goal-hint">{t(live.goalTimeoutBehavior === 'default' ? 'defaultHint' : 'nativeHint')}</p>
          </details>
        </>}
      </section>
      {notice !== null && <p className={notice.tone === 'ok' ? css.status : css.fieldError} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      {dirty && <div className={css.footer} id="better-ask-user-settings-footer">
        <span className={css.status}>{t('dirty')}</span>
        <button type="button" className={css.button} id="better-ask-user-discard" disabled={controlsDisabled} onClick={() => {
          setDraft(null)
          setNotice(null)
          setTimedSeconds(String(host.questionTimeoutSeconds === -1 ? DEFAULTS.questionTimeoutSeconds : host.questionTimeoutSeconds))
        }}>{t('discard')}</button>
        <button
          type="button" className={css.primary} data-settings-save disabled={controlsDisabled || invalid}
          aria-busy={busy} onClick={() => { void save() }}
        >
          {busy && <span className={css.spinner} aria-hidden="true" />}
          {busy ? t('saving') : t('save')}
        </button>
      </div>}
    </div>
  )
}

/** Row-config entry component: list summary plus the page body. */
export function SettingsEntry(props: any) {
  const t = props.t ?? fallbackT
  if (props.view === 'summary') return <span>{t('summary')}</span>
  return <SettingsPage form={props.form} t={t} />
}
