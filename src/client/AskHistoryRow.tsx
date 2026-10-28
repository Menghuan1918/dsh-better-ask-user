/** History row for ask_user_question: compact summary plus a replay button. */
import { IconQuestionOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps, UserQuestionRecord } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions/types'
import type { QuestionKey } from './locales.ts'
import css from './AskHistoryRow.module.css'

type AskHistoryRowProps = ToolCallViewProps & PropsLocale<'question'> & {
  revealPanel: (callId: string) => boolean
  reviewPanel: (callId: string, record: UserQuestionRecord) => boolean
}

interface AnswerEntry {
  id: string
  selected: string[]
  custom?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function resultText(content: readonly unknown[]): string | undefined {
  const parts: string[] = []
  for (const block of content) {
    if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') continue
    parts.push(block.text)
  }
  return parts.length === 0 ? undefined : parts.join('\n')
}

function questionList(argsRaw: string): AskUserQuestionItem[] | undefined {
  const parsed = parseJson(argsRaw)
  if (!isRecord(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length === 0) return undefined
  const questions: AskUserQuestionItem[] = []
  for (const candidate of parsed.questions) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.question !== 'string') return undefined
    questions.push({
      id: candidate.id,
      question: candidate.question,
      ...(typeof candidate.header === 'string' ? { header: candidate.header } : {}),
      ...(Array.isArray(candidate.options)
        ? {
            options: candidate.options.flatMap(option => isRecord(option) && typeof option.label === 'string'
              ? [{
                  label: option.label,
                  ...(typeof option.description === 'string' ? { description: option.description } : {}),
                }]
              : []),
          }
        : {}),
      ...(typeof candidate.multi_select === 'boolean' ? { multi_select: candidate.multi_select } : {}),
    })
  }
  return questions
}

function answerList(text: string | undefined): AnswerEntry[] | undefined {
  if (text === undefined) return undefined
  const parsed = parseJson(text)
  if (!isRecord(parsed) || !Array.isArray(parsed.answers)) return undefined
  const answers: AnswerEntry[] = []
  for (const candidate of parsed.answers) {
    if (!isRecord(candidate)
      || typeof candidate.id !== 'string'
      || !Array.isArray(candidate.selected)
      || !candidate.selected.every(value => typeof value === 'string')
      || (candidate.custom !== undefined && typeof candidate.custom !== 'string')) return undefined
    answers.push({
      id: candidate.id,
      selected: candidate.selected,
      ...(candidate.custom === undefined ? {} : { custom: candidate.custom }),
    })
  }
  return answers
}

function isPending(text: string | undefined): boolean {
  if (text === undefined) return false
  const parsed = parseJson(text)
  return isRecord(parsed) && parsed.pending === true
}

/** The compact history re-entry for one ask call, top-level or nested. */
export function AskHistoryRow({
  callId,
  block,
  phase,
  revealPanel,
  reviewPanel,
  t,
}: AskHistoryRowProps): React.JSX.Element {
  const argsRaw = 'kind' in block ? block.call?.argsRaw ?? '' : block.argsRaw
  const output = 'kind' in block ? resultText(block.content) : undefined
  const questions = questionList(argsRaw)
  const answers = answerList(output)
  const record: UserQuestionRecord | undefined = questions !== undefined && answers !== undefined
    ? { questions, answers }
    : undefined
  const summary = questions?.[0]?.question.split('\n').find(line => line.trim() !== '')?.trim() ?? t('history.title')
  const review = record !== undefined
  const action = review
    ? () => { reviewPanel(callId, record) }
    : isPending(output) || phase === 'start'
      ? () => { revealPanel(callId) }
      : undefined

  return (
    <div className={css.row}>
      <span className={css.icon} aria-hidden="true"><IconQuestionOutline14 /></span>
      <span className={css.title}>{t('history.title')}</span>
      <span className={css.summary} title={summary}>{summary}</span>
      {action !== undefined && (
        <button
          type="button"
          className={css.open}
          onClick={action}
          aria-label={review ? t('history.review') : t('history.reopen')}
        >
          {review ? t('history.review') : t('history.reopen')}
        </button>
      )}
    </div>
  )
}
