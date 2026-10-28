/** ask_user_question scope shadow: host-controlled wait and timeout behavior. */
import { ToolArgsError, validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'
import { TIMED_WAIT_PARAMETER } from '@deepseek-ai/dsh-user-questions'
import { buildDefaultAnswer } from './default-answer.js'

/** Model-visible notice for the native pending result. */
export const PENDING_QUESTION_NOTICE = 'No answer batch arrived before the timeout. This is pending, not a skipped answer. Continue useful independent work. The user can still answer; their reply will be a user message identified as answer_to_pending_question with this callId and the original questions. Do not treat this as permission.'

/** Compatibility wait field description; the host owns the real wait. */
const COMPATIBILITY_TIMEOUT = {
  type: 'integer',
  description: 'Compatibility wait field. The host controls the wait duration and timeout behavior; any value supplied here is ignored.',
}

function questionRequest(questions, exec) {
  return {
    questions: questions.map(question => ({
      id: question.id,
      question: question.question,
      ...(question.header !== undefined ? { header: question.header } : {}),
      ...(question.options !== undefined ? {
        options: question.options.map(option => ({ ...option })),
      } : {}),
      ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
      ...(question.detail !== undefined ? { detail: question.detail } : {}),
    })),
    ...(exec.agent !== undefined ? { agent: exec.agent } : {}),
    signal: exec.signal,
  }
}

function validateQuestionIds(questions) {
  const ids = new Set()
  for (const question of questions) {
    if (ids.has(question.id)) throw new Error('question id ' + JSON.stringify(question.id) + ' must be unique within this call')
    ids.add(question.id)
  }
}

function answerResult(result) {
  return {
    answers: result.answers.map(answer => ({
      id: answer.id,
      selected: [...answer.selected],
      ...(answer.custom !== undefined ? { custom: answer.custom } : {}),
    })),
    ...(result.autoSelected === true ? { autoSelected: true } : {}),
  }
}

function answersOutputSchema(schema) {
  const next = structuredClone(schema)
  const branches = Array.isArray(next.oneOf) ? next.oneOf : [next]
  for (const branch of branches) {
    if (branch?.properties?.answers !== undefined) {
      branch.properties.autoSelected = {
        type: 'boolean',
        description: 'True when the host selected default options after the wait expired; this is not a user answer.',
      }
    }
  }
  return next
}

function timeoutParameters(parameters) {
  const next = structuredClone(parameters)
  if (next?.properties === undefined) next.properties = {}
  if (next.properties[TIMED_WAIT_PARAMETER] === undefined) {
    next.properties[TIMED_WAIT_PARAMETER] = COMPATIBILITY_TIMEOUT
  } else {
    next.properties[TIMED_WAIT_PARAMETER] = { ...next.properties[TIMED_WAIT_PARAMETER], ...COMPATIBILITY_TIMEOUT }
  }
  return next
}

/**
 * Build the ask_user_question shadow from the currently registered base tool.
 * @param ctx - root host context with userQuestions and optional goals.
 * @param base - existing official ask_user_question definition.
 * @param readConfig - live config reader.
 * @returns a ToolDefinition replacing the base behavior.
 */
export function createBetterAskTool(ctx, base, readConfig) {
  const parameters = timeoutParameters(base.parameters)
  const output = {
    ...base.output,
    schema: answersOutputSchema(base.output.schema),
    render: (_args, value) => [{
      type: 'text',
      text: value?.autoSelected === true
        ? 'auto-selected default answer after the question wait expired; this is not a user answer. Verify before relying on it.\n' + JSON.stringify(value)
        : JSON.stringify(value),
    }],
  }

  const execute = async (args, exec) => {
    const violations = validateJsonSchemaValue(parameters, args, '')
    if (violations.length > 0) throw new ToolArgsError(violations)
    validateQuestionIds(args.questions)

    const userQuestions = ctx.get('userQuestions')
    if (userQuestions === undefined) throw new Error('ask_user_question requires the userQuestions service')

    const config = readConfig()
    const goal = exec.agent === undefined ? undefined : ctx.get('goals')?.get?.(exec.agent)
    const goalActive = goal?.phase === 'active' && goal.activation === 'armed'
    const mode = goalActive ? config.goalTimeoutBehavior : config.timeoutBehavior
    const seconds = config.questionTimeoutSeconds
    const questions = questionRequest(args.questions, exec)
    const defaultAnswer = mode === 'default' && seconds !== -1
      ? buildDefaultAnswer(args.questions)
      : undefined

    if (seconds === -1) {
      const result = await userQuestions.ask({ ...questions, wait: { callId: exec.callId } })
      return answerResult(result)
    }
    if (exec.agent === undefined) throw new Error('timed questions require a live agent')

    const waitMs = seconds * 1000
    const result = await userQuestions.askTimed({
      ...questions,
      agent: exec.agent,
      better: { waitMs, timeoutMode: mode, defaultAnswer },
    }, exec.callId, waitMs)
    if ('pending' in result) {
      if (mode === 'default' && defaultAnswer !== undefined) return defaultAnswer
      return { ...result, message: PENDING_QUESTION_NOTICE }
    }
    return answerResult(result)
  }

  return {
    ...base,
    description: base.description + ' The host controls the wait duration and timeout behavior; the timeout argument is a compatibility field and is ignored.',
    parameters,
    output,
    execute,
  }
}
