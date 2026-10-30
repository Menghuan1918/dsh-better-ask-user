/** Row configuration page: question wait and timeout behavior. */
import { useCallback, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
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

/** Native radios retain the browser's arrow-key and focus behavior. */
function ChoiceGroup({ id, label, value, options, disabled, hint, onChange }: {
  id: string; label: string; value: string; options: Array<{ value: string; label: string }>;
  disabled: boolean; hint: string; onChange: (value: string) => void
}) {
  return (
    <fieldset className={css.choiceGroup} id={id} disabled={disabled} aria-describedby={hint}>
      <legend className={css.rowTitle}>{label}</legend>
      <div className={css.choices}>
        {options.map(option => (
          <label className={css.choice} key={option.value}>
            <input
              className={css.choiceInput}
              id={`${id}-${option.value}`}
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              aria-describedby={hint}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
    return <div className={css.cfg}><p className={css.note} role="status">{t('waiting')}</p></div>
  }
  if (state.status === 'loading') {
    return <div className={css.cfg}><p className={css.note} role="status">{t('loading')}</p></div>
  }
  if (host === null || live === null) {
    return <div className={css.cfg}><p className={css.note} role="alert">{t('unavailable')}</p></div>
  }

  const invalid = parsed === undefined
  const status = notice !== null
    ? <span className={`${css.status} ${notice.tone === 'ok' ? css.statusOk : css.statusError}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</span>
    : invalid
      ? <span className={`${css.status} ${css.statusError}`} id="better-ask-user-error" role="alert">{t('invalidWait')}</span>
      : dirty
        ? <span className={css.status} role="status">{t('dirty')}</span>
        : null

  const unlimited = live.questionTimeoutSeconds === '-1'
  const controlsDisabled = !writable || busy

  return (
    <div className={css.cfg} aria-busy={busy}>
      <h2 className={css.title} id="better-ask-user-title">{t('title')}</h2>
      {writable ? null : <p className={css.note} role="status">{t('readonly')}</p>}
      <section className={css.group} aria-label={t('title')}>
        <div className={css.waitSection}>
          <ChoiceGroup
            id="better-ask-user-wait-mode"
            label={t('waitLabel')}
            value={unlimited ? 'unlimited' : 'timed'}
            options={[{ value: 'timed', label: t('timed') }, { value: 'unlimited', label: t('unlimited') }]}
            disabled={controlsDisabled}
            hint="better-ask-user-wait-hint"
            onChange={(value) => {
              const nextUnlimited = value === 'unlimited'
              if (nextUnlimited && !invalid) setTimedSeconds(live.questionTimeoutSeconds)
              edit(current => ({ ...current, questionTimeoutSeconds: nextUnlimited ? '-1' : timedSeconds }))
            }}
          />
          {unlimited ? null : <div className={css.duration}>
            <label htmlFor="better-ask-user-wait">{t('durationLabel')}</label>
            <div className={css.durationControl}>
              <input
                id="better-ask-user-wait"
                className={css.input}
                aria-describedby={invalid ? 'better-ask-user-error' : 'better-ask-user-wait-hint'}
                type="number"
                min={1}
                max={MAX_QUESTION_TIMEOUT_SECONDS}
                step={1}
                inputMode="numeric"
                aria-invalid={invalid || undefined}
                value={live.questionTimeoutSeconds}
                disabled={controlsDisabled}
                onChange={(event) => {
                  const next = event.target.value
                  edit(current => ({ ...current, questionTimeoutSeconds: next }))
                }}
              />
              <span className={css.unit}>{t('seconds')}</span>
            </div>
          </div>}
          <p className={css.dependency} id="better-ask-user-wait-hint">{t(unlimited ? 'unlimitedHint' : 'waitHint')}</p>
        </div>
        <div className={css.timeoutSection}>
          <h3 className={css.sectionTitle}>{t('timeoutTitle')}</h3>
          <div className={css.timeoutChoices}>
            <ChoiceGroup
              id="better-ask-user-behavior"
              label={t('behaviorLabel')}
              value={live.timeoutBehavior}
              options={[{ value: 'native', label: t('native') }, { value: 'default', label: t('default') }]}
              disabled={controlsDisabled || unlimited}
              hint="better-ask-user-timeout-hint"
              onChange={(value) => {
                const next = value === 'default' ? 'default' : 'native'
                edit(current => ({ ...current, timeoutBehavior: next }))
              }}
            />
            <ChoiceGroup
              id="better-ask-user-goal-behavior"
              label={t('goalBehaviorLabel')}
              value={live.goalTimeoutBehavior}
              options={[{ value: 'native', label: t('native') }, { value: 'default', label: t('default') }]}
              disabled={controlsDisabled || unlimited}
              hint="better-ask-user-timeout-hint"
              onChange={(value) => {
                const next = value === 'default' ? 'default' : 'native'
                edit(current => ({ ...current, goalTimeoutBehavior: next }))
              }}
            />
          </div>
          <p className={css.dependency} id="better-ask-user-timeout-hint">
            {t(unlimited ? 'timeoutDisabled' : live.timeoutBehavior === 'default' || live.goalTimeoutBehavior === 'default' ? 'defaultHint' : 'nativeHint')}
          </p>
        </div>
      </section>

      <div className={css.footer} id="better-ask-user-settings-footer">
        <div className={css.statusSlot}>{status}</div>
        <Button
          variant="outline"
          className={css.discard}
          id="better-ask-user-discard"
          disabled={controlsDisabled || ((draft === null || draft.revision !== revision) && notice === null)}
          onClick={() => {
            setDraft(null)
            setNotice(null)
            setTimedSeconds(String(host.questionTimeoutSeconds === -1 ? DEFAULTS.questionTimeoutSeconds : host.questionTimeoutSeconds))
          }}
        >
          {t('discard')}
        </Button>
        <Button
          variant="primary"
          className={css.button}
          disabled={!writable || busy || !dirty || invalid}
          onClick={() => { void save() }}
        >
          {busy ? t('saving') : t('save')}
        </Button>
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
