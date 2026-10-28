/** Built-closure and carrier behavior tests. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

let entry
globalThis.window = {
  __ModuleLoader__: {
    load(value) { entry = value },
  },
}
await import(pathToFileURL(new URL('../lib/client.js', import.meta.url).pathname).href)
const react = {
  memo: (component) => component,
  createElement: () => null,
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
  useSyncExternalStore: () => undefined,
  createContext: () => ({ Provider: () => null }),
  Fragment: Symbol('Fragment'),
}
const jsxRuntime = { jsx: () => null, jsxs: () => null, Fragment: react.Fragment }
const fakeRequire = (id) => {
  if (id === 'react') return react
  if (id === 'react/jsx-runtime') return jsxRuntime
  if (id === '@deepseek-ai/dsh-client-store') return { defineStore: () => ({}) }
  return {}
}
const bundle = entry.factory(fakeRequire)
const PendingQuestion = bundle.PendingQuestion

test('bundle is one loader closure exposing the client contract', () => {
  assert.equal(entry.id, 'dsh-better-ask-user')
  assert.equal(typeof bundle.apply, 'function')
  assert.ok(Array.isArray(bundle.inject))
  assert.equal(typeof PendingQuestion, 'function')
})

function harness(settings) {
  const questions = [{ id: 'q', question: 'Pick', options: [{ label: 'A' }, { label: 'B' }] }]
  const pending = new PendingQuestion('session', questions, 'call', undefined, undefined, settings)
  let resolved
  let rejected
  const channel = {
    deadline: Date.now() + 5000,
    resolve: (answer) => { resolved = answer },
    reject: (code) => { rejected = code },
    delegate: () => {},
  }
  pending.attachWaterfall(channel)
  return { pending, channel, get resolved() { return resolved }, get rejected() { return rejected } }
}

test('input bump resets the countdown to the configured window', () => {
  const h = harness({ waitMs: 5000, timeoutMode: 'native' })
  assert.equal(h.pending.snapshot().waitMs, 5000)
  assert.equal(h.pending.snapshot().timeoutMode, 'native')
  h.pending.bump()
  assert.ok(h.pending.snapshot().countdown.remainingMs > 4500)
  h.pending.close()
})

test('native timeout rejects the waterfall with ASK_TIMED_OUT', () => {
  const h = harness({ waitMs: 5000, timeoutMode: 'native' })
  h.pending.timeout()
  assert.equal(h.rejected, 'ASK_TIMED_OUT')
  assert.equal(h.resolved, undefined)
  h.pending.close()
})

test('default timeout resolves the host-provided default answer', () => {
  const answer = { answers: [{ id: 'q', selected: ['A'] }], autoSelected: true }
  const h = harness({ waitMs: 5000, timeoutMode: 'default', defaultAnswer: answer })
  h.pending.timeout()
  assert.deepEqual(h.resolved, answer)
  assert.equal(h.rejected, undefined)
  h.pending.close()
})

test('takeTime hard-stops the countdown and bump cannot revive it', () => {
  const h = harness({ waitMs: 5000, timeoutMode: 'default', defaultAnswer: { answers: [], autoSelected: true } })
  h.pending.takeTime()
  h.pending.bump()
  h.pending.timeout()
  assert.equal(h.pending.snapshot().waitState, 'waiting')
  assert.equal(h.resolved, undefined)
  assert.equal(h.rejected, undefined)
  h.pending.close()
})
