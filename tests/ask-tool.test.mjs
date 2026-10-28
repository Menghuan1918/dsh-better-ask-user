import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBetterAskTool } from '../src/ask-tool.js'

const base = {
  name: 'ask_user_question',
  description: 'Base official description.',
  parameters: {
    type: 'object',
    properties: {
      timeout: { type: 'integer' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: { label: { type: 'string' }, description: { type: 'string' } },
                required: ['label'],
              },
            },
            multi_select: { type: 'boolean' },
          },
          required: ['id', 'question'],
        },
      },
    },
    required: ['questions'],
  },
  output: {
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: { pending: { type: 'boolean' }, callId: { type: 'string' }, message: { type: 'string' } },
          required: ['pending', 'callId', 'message'],
        },
        {
          type: 'object',
          properties: { answers: { type: 'array' } },
          required: ['answers'],
        },
      ],
    },
    render: () => [{ type: 'text', text: 'base' }],
  },
  async execute() { throw new Error('base execute must not run') },
}

const questions = [
  { id: 'one', question: 'One?', options: [{ label: 'A' }, { label: 'B' }] },
  { id: 'multi', question: 'Multi?', multi_select: true, options: [{ label: 'X' }, { label: 'Y (Recommended)' }] },
  { id: 'none', question: 'Free?' },
]

const args = { questions }

function makeHarness({ goal, config, timed = { pending: true, callId: 'c1' }, asked } = {}) {
  const calls = { timed: [], plain: [] }
  const ctx = {
    get(name) {
      if (name === 'userQuestions') {
        return {
          ask: async request => { calls.plain.push(request); return asked ?? { answers: [{ id: 'one', selected: ['A'] }, { id: 'multi', selected: [] }, { id: 'none', selected: [] }] } },
          askTimed: async (request, callId, timeoutMs) => { calls.timed.push({ request, callId, timeoutMs }); return timed },
        }
      }
      if (name === 'goals') {
        return { get: () => goal }
      }
      return undefined
    },
  }
  const readConfig = () => ({ questionTimeoutSeconds: 5, timeoutBehavior: 'native', goalTimeoutBehavior: 'native', ...config })
  const definition = createBetterAskTool(ctx, base, readConfig)
  const exec = { agent: {}, callId: 'c1', signal: new AbortController().signal }
  return { definition, exec, calls }
}

test('native behavior forwards the wait and returns the official pending shape', async () => {
  const harness = makeHarness()
  const result = await harness.definition.execute(args, harness.exec)
  assert.equal(result.pending, true)
  assert.match(result.message, /No answer batch arrived/)
  assert.equal(harness.calls.timed.length, 1)
  assert.equal(harness.calls.timed[0].timeoutMs, 5000)
  assert.equal(harness.calls.timed[0].request.agent, harness.exec.agent)
  assert.equal(harness.calls.timed[0].request.better.waitMs, 5000)
  assert.equal(harness.calls.timed[0].request.better.timeoutMode, 'native')
  assert.equal(harness.calls.timed[0].request.better.defaultAnswer, undefined)
  assert.equal(harness.calls.plain.length, 0)
})

test('default behavior backstops a pending result with the default batch', async () => {
  const harness = makeHarness({ config: { timeoutBehavior: 'default' } })
  const result = await harness.definition.execute(args, harness.exec)
  assert.deepEqual(result, {
    answers: [
      { id: 'one', selected: ['A'] },
      { id: 'multi', selected: ['Y (Recommended)'] },
      { id: 'none', selected: [] },
    ],
    autoSelected: true,
  })
  const better = harness.calls.timed[0].request.better
  assert.deepEqual(better.defaultAnswer, result)
  assert.equal(better.timeoutMode, 'default')
})

test('goal-active mode uses goalTimeoutBehavior', async () => {
  const harness = makeHarness({
    goal: { phase: 'active', activation: 'armed' },
    config: { timeoutBehavior: 'native', goalTimeoutBehavior: 'default' },
  })
  const result = await harness.definition.execute(args, harness.exec)
  assert.equal(result.autoSelected, true)
  assert.equal(harness.calls.timed[0].request.better.timeoutMode, 'default')
})

test('disabled wait uses the plain ask path with the official call id', async () => {
  const harness = makeHarness({ config: { questionTimeoutSeconds: -1 } })
  const result = await harness.definition.execute(args, harness.exec)
  assert.deepEqual(result.answers.map(answer => answer.id), ['one', 'multi', 'none'])
  assert.equal(harness.calls.plain.length, 1)
  assert.equal(harness.calls.plain[0].wait.callId, 'c1')
  assert.equal(harness.calls.plain[0].agent, harness.exec.agent)
  assert.equal(harness.calls.timed.length, 0)
})

test('a client auto answer is preserved and warned about in render', async () => {
  const auto = {
    answers: [
      { id: 'one', selected: ['A'] },
      { id: 'multi', selected: ['X'] },
      { id: 'none', selected: [] },
    ],
    autoSelected: true,
  }
  const harness = makeHarness({ timed: auto })
  const result = await harness.definition.execute(args, harness.exec)
  assert.deepEqual(result, auto)
  const rendered = harness.definition.output.render(args, result)
  assert.match(rendered[0].text, /not a user answer/)
})

test('shadow schema advertises autoSelected and a host-controlled timeout', () => {
  const harness = makeHarness()
  assert.match(harness.definition.description, /host controls the wait/)
  assert.match(harness.definition.parameters.properties.timeout.description, /ignored/)
  const branches = harness.definition.output.schema.oneOf
  const answers = branches.find(branch => branch.properties?.answers !== undefined)
  assert.equal(answers.properties.autoSelected.type, 'boolean')
})
