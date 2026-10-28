/** The shadow must keep the official tool contract byte-for-byte. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBetterAskTool } from '../src/ask-tool.js'

const calls = []
const base = {
  name: 'ask_user_question',
  description: 'Official base description.',
  parameters: {
    type: 'object',
    properties: { questions: { type: 'array', description: 'Questions.' } },
    required: ['questions'],
  },
  output: {
    schema: { type: 'object', properties: { answers: { type: 'array' } } },
    render: () => [{ type: 'text', text: 'official' }],
  },
  timeoutMs: 123,
  async execute(args, exec) {
    calls.push({ args, exec })
    return { answers: [{ id: 'q', selected: ['A'] }] }
  },
}

function makeTool(config = { questionTimeoutSeconds: 120 }) {
  return createBetterAskTool({}, base, () => config)
}

test('shadow preserves the official name, description, parameters, output and timeoutMs', () => {
  const tool = makeTool()
  assert.equal(tool.name, base.name)
  assert.equal(tool.description, base.description)
  assert.deepEqual(tool.parameters, base.parameters)
  assert.deepEqual(tool.output, base.output)
  assert.equal(tool.timeoutMs, base.timeoutMs)
})

test('omitted model timeout falls back to the ask-user configured default', async () => {
  calls.length = 0
  const result = await makeTool({ questionTimeoutSeconds: 5 }).execute({ questions: [] }, {})
  assert.deepEqual(calls[0].args, { questions: [], timeout: 5 })
  assert.deepEqual(result, { answers: [{ id: 'q', selected: ['A'] }] })
})

test('explicit model timeout is forwarded unchanged', async () => {
  calls.length = 0
  await makeTool({ questionTimeoutSeconds: 5 }).execute({ questions: [], timeout: 9 }, {})
  assert.deepEqual(calls[0].args, { questions: [], timeout: 9 })
})

test('configured -1 is forwarded as -1', async () => {
  calls.length = 0
  await makeTool({ questionTimeoutSeconds: -1 }).execute({ questions: [] }, {})
  assert.deepEqual(calls[0].args, { questions: [], timeout: -1 })
})

test('the official execute result and errors pass through unchanged', async () => {
  calls.length = 0
  const result = await makeTool().execute({ questions: [] }, { agent: 'a' })
  assert.deepEqual(result, { answers: [{ id: 'q', selected: ['A'] }] })
  assert.equal(calls[0].exec.agent, 'a')
  const throwingBase = { ...base, async execute() { throw new Error('official error text') } }
  const tool = createBetterAskTool({}, throwingBase, () => ({ questionTimeoutSeconds: 120 }))
  await assert.rejects(() => tool.execute({ questions: [] }, {}), /official error text/)
})
