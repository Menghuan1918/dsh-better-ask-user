/** Settings row-config page tests over the built closure with real React. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(new URL('../package.json', import.meta.url))
const React = require('react')
const TestRenderer = require('react-test-renderer')
const act = TestRenderer.act ?? TestRenderer.default?.act
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h } = React

let entry
const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
const prevWindow = globalThis.window
try {
  globalThis.window = { __ModuleLoader__: { load(v) { entry = v } } }
  eval(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
} finally {
  if (hadWindow) globalThis.window = prevWindow
  else delete globalThis.window
}
const jsxRuntime = require('react/jsx-runtime')
const bundle = entry.factory((id) => {
  if (id === 'react') return React
  if (id === 'react/jsx-runtime') return jsxRuntime
  if (id === '@deepseek-ai/dsh-client-store') return { defineStore: () => ({}) }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') {
    const stub = () => null
    return new Proxy({ Button: ({ variant, children, ...props }) => h('button', { ...props, 'data-variant': variant }, children) }, { get: (target, key) => target[key] ?? stub })
  }
  return {}
})
const SettingsEntry = bundle.SettingsEntry
assert.equal(typeof SettingsEntry, 'function', 'SettingsEntry must be exported for UI tests')

const t = (key) => key
const READY = { questionTimeoutSeconds: 120, timeoutBehavior: 'native', goalTimeoutBehavior: 'native' }

function makeForm(options = {}) {
  const behavior = options.behavior ?? 'accept'
  let snapshot = {
    status: options.status ?? 'ready',
    value: options.value ?? READY,
    revision: options.revision ?? 1,
    writable: options.writable ?? true,
    mode: 'host',
  }
  const calls = []
  return {
    calls,
    getSnapshot: () => snapshot,
    async mutate(ops, revision) {
      calls.push({ ops, revision })
      if (behavior === 'refuse') return false
      if (behavior === 'reject') throw new Error('transport down')
      const value = structuredClone(snapshot.value)
      for (const op of ops) value[op.path[op.path.length - 1]] = structuredClone(op.value)
      snapshot = { ...snapshot, value, revision: snapshot.revision + 1 }
      return true
    },
  }
}

async function mount(options = {}) {
  const controller = options.controller ?? makeForm(options.form ?? {})
  let renderer
  await act(async () => {
    renderer = TestRenderer.create(h(SettingsEntry, { view: 'page', t, form: { state: controller.getSnapshot(), mutate: (ops, r) => controller.mutate(ops, r) } }))
  })
  return {
    renderer,
    controller,
    async update() {
      await act(async () => { renderer.update(h(SettingsEntry, { view: 'page', t, form: { state: controller.getSnapshot(), mutate: (ops, r) => controller.mutate(ops, r) } })) })
    },
    async run(fn) { await act(async () => { await fn() }) },
  }
}

const host = (node) => typeof node.type === 'string'
const byId = (r, id) => r.root.findAll((n) => host(n) && n.props?.id === id)[0]
const text = (r) => {
  const read = (n) => (n == null ? '' : typeof n === 'string' ? n : (n.children ?? []).map(read).join(''))
  return read(r.toJSON())
}
const saveButton = (r) => r.root.findAll((n) => host(n) && n.type === 'button' && n.props?.['data-variant'] === 'primary')[0]

test('settings page: compact named section, labeled controls, defaults, a11y hints', async () => {
  const { renderer } = await mount()
  const titles = renderer.root.findAll((n) => host(n) && n.type === 'h2')
  assert.equal(titles.length, 1, 'settings has one page title')
  assert.deepEqual(titles[0].children, ['title'])
  assert.equal(renderer.root.findAllByType('h3').length, 1, 'timeout controls have a subordinate section heading')
  assert.equal(renderer.root.findByType('section').props['aria-label'], 'title')
  for (const id of ['better-ask-user-wait-mode', 'better-ask-user-behavior', 'better-ask-user-goal-behavior']) {
    const group = byId(renderer, id)
    assert.equal(group.type, 'fieldset')
    assert.equal(group.findAllByType('legend').length, 1)
    const radios = group.findAllByType('input')
    assert.equal(radios.length, 2)
    assert.ok(radios.every(node => node.props.type === 'radio' && node.props.name === id))
    assert.equal(radios.filter(node => node.props.checked).length, 1)
  }
  assert.equal(byId(renderer, 'better-ask-user-wait').props.value, '120')
  assert.equal(byId(renderer, 'better-ask-user-wait').props['aria-describedby'], 'better-ask-user-wait-hint')
  assert.equal(byId(renderer, 'better-ask-user-behavior-native').props.checked, true)
  assert.equal(byId(renderer, 'better-ask-user-goal-behavior-native').props.checked, true)
  assert.equal(saveButton(renderer).props.disabled, true)
  assert.deepEqual(byId(renderer, 'better-ask-user-settings-footer').findAllByType('button').map(node => node.children.join('')), ['discard', 'save'])
  await act(async () => { renderer.unmount() })
})

test('discard restores current host values and remembered duration without writing', async () => {
  const { renderer, controller } = await mount({ form: { value: { questionTimeoutSeconds: 300, timeoutBehavior: 'default', goalTimeoutBehavior: 'native' } } })
  await act(async () => { byId(renderer, 'better-ask-user-wait').props.onChange({ target: { value: '60' } }) })
  await act(async () => { byId(renderer, 'better-ask-user-wait-mode-unlimited').props.onChange() })
  await act(async () => { byId(renderer, 'better-ask-user-discard').props.onClick() })
  assert.equal(byId(renderer, 'better-ask-user-wait').props.value, '300')
  assert.equal(byId(renderer, 'better-ask-user-behavior-default').props.checked, true)
  assert.equal(saveButton(renderer).props.disabled, true)
  assert.doesNotMatch(text(renderer), /dirty/)
  await act(async () => { byId(renderer, 'better-ask-user-wait-mode-unlimited').props.onChange() })
  await act(async () => { byId(renderer, 'better-ask-user-wait-mode-timed').props.onChange() })
  assert.equal(byId(renderer, 'better-ask-user-wait').props.value, '300')
  assert.deepEqual(controller.calls, [], 'discard never sends a configuration mutation')
  await act(async () => { renderer.unmount() })
})

test('wait editing: 0 blocks save, unlimited mode saves -1 with one op', async () => {
  const { renderer, controller, update } = await mount()
  const wait = byId(renderer, 'better-ask-user-wait')
  await act(async () => { wait.props.onChange({ target: { value: '0' } }) })
  assert.match(text(renderer), /invalidWait/)
  assert.equal(saveButton(renderer).props.disabled, true)
  await act(async () => { byId(renderer, 'better-ask-user-wait-mode-unlimited').props.onChange() })
  assert.equal(byId(renderer, 'better-ask-user-wait'), undefined)
  assert.equal(byId(renderer, 'better-ask-user-behavior').props.disabled, true)
  assert.equal(byId(renderer, 'better-ask-user-goal-behavior').props.disabled, true)
  assert.equal(saveButton(renderer).props.disabled, false)
  await act(async () => { saveButton(renderer).props.onClick(); await Promise.resolve() })
  assert.deepEqual(controller.calls[0].ops, [{ op: 'set', path: ['questionTimeoutSeconds'], value: -1 }])
  await update()
  assert.match(text(renderer), /saved/)
  await act(async () => { renderer.unmount() })
})

test('both timeout choice groups mutate the right keys', async () => {
  const { renderer, controller } = await mount()
  await act(async () => {
    byId(renderer, 'better-ask-user-behavior-default').props.onChange()
    byId(renderer, 'better-ask-user-goal-behavior-default').props.onChange()
  })
  await act(async () => { saveButton(renderer).props.onClick(); await Promise.resolve() })
  assert.deepEqual(controller.calls[0].ops, [
    { op: 'set', path: ['timeoutBehavior'], value: 'default' },
    { op: 'set', path: ['goalTimeoutBehavior'], value: 'default' },
  ])
  await act(async () => { renderer.unmount() })
})

test('readonly disables controls; refused and failed saves surface notices', async () => {
  const ro = await mount({ form: { writable: false } })
  assert.equal(byId(ro.renderer, 'better-ask-user-wait').props.disabled, true)
  assert.match(text(ro.renderer), /readonly/)
  await act(async () => { ro.renderer.unmount() })

  const refused = await mount({ form: { behavior: 'refuse' } })
  await act(async () => { byId(refused.renderer, 'better-ask-user-wait').props.onChange({ target: { value: '30' } }) })
  await act(async () => { saveButton(refused.renderer).props.onClick(); await Promise.resolve() })
  assert.match(text(refused.renderer), /conflict/)
  await act(async () => { refused.renderer.unmount() })

  const failed = await mount({ form: { behavior: 'reject' } })
  await act(async () => { byId(failed.renderer, 'better-ask-user-wait').props.onChange({ target: { value: '30' } }) })
  await act(async () => { saveButton(failed.renderer).props.onClick(); await Promise.resolve() })
  assert.match(text(failed.renderer), /saveFailed.*transport down/)
  await act(async () => { byId(failed.renderer, 'better-ask-user-discard').props.onClick() })
  assert.equal(byId(failed.renderer, 'better-ask-user-wait').props.value, '120')
  assert.doesNotMatch(text(failed.renderer), /saveFailed|dirty/)
  assert.equal(failed.controller.calls.length, 1, 'discard only clears local state after a failed save')
  await act(async () => { failed.renderer.unmount() })
})
