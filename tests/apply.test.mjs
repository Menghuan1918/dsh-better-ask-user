import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../src/index.js'

const base = {
  name: 'ask_user_question',
  description: 'Base official description.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: { type: 'object', properties: { id: { type: 'string' }, question: { type: 'string' } }, required: ['id', 'question'] },
      },
    },
    required: ['questions'],
  },
  output: { schema: { oneOf: [{ type: 'object', properties: { pending: { type: 'boolean' } } }, { type: 'object', properties: { answers: { type: 'array' } } }] } },
  async execute() { return { pending: true, callId: 'c1', message: 'pending' } },
}

test('apply shadows ask_user_question per agent and registers the shared PTC exemption', () => {
  const registered = []
  const ptcCalls = []
  const events = []
  const tools = {
    get: (name) => name === 'ask_user_question' ? base : undefined,
    register: (definition) => { registered.push(definition); return () => {} },
    schemas: () => [base],
  }
  const agent = {
    ctx: { get: (name) => name === 'tools' ? tools : undefined },
  }
  const ctx = {
    inject: (names, callback) => {
      if (names[0] === 'settings') return
      ptcCalls.push(names)
      callback({ betterPtc: { register: (name) => { ptcCalls.push(name); return () => {} } }, effect: () => {} })
    },
    agents: { list: () => [agent] },
    on: (event) => { events.push(event); return () => {} },
    effect: (register) => { const dispose = register(); return dispose },
    get: (name) => name === 'userQuestions' ? {} : undefined,
  }
  apply(ctx, {})
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'ask_user_question')
  assert.match(registered[0].description, /host controls the wait/)
  assert.equal(registered[0].parameters.properties.timeout.type, 'integer')
  assert.equal(registered[0].output.schema.oneOf[1].properties.autoSelected.type, 'boolean')
  assert.deepEqual(ptcCalls, [['betterPtc'], 'ask_user_question'])
  assert.deepEqual(events, ['agent/created', 'agent/disposed', 'system-prompt/assemble'])
})
