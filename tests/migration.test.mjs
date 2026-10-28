/** Legacy dsh-better-goal questionTimeoutSeconds migration tests. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ASK_NS, LEGACY_GOAL_NS, migrateLegacyQuestionTimeout } from '../src/settings.js'

function harness({ sourceUser = { questionTimeoutSeconds: -1 }, targetUser = {}, sourceValue = -1, writable = true } = {}) {
  const calls = []
  const source = {
    value: { questionTimeoutSeconds: sourceValue },
    user: sourceUser,
    revision: 1,
  }
  const target = {
    value: { questionTimeoutSeconds: 120 },
    user: targetUser,
    revision: 7,
    writable,
  }
  const service = {
    describe(ns) {
      if (ns === LEGACY_GOAL_NS) return source
      if (ns === ASK_NS) return target
      return undefined
    },
    async update(ns, patch, revision) {
      calls.push({ ns, patch, revision })
      target.user = { ...target.user, ...patch }
      target.value = { ...target.value, ...patch }
      return true
    },
  }
  return { service, calls, target }
}

test('copies an explicit legacy goal wait into the ask-user row', async () => {
  const h = harness()
  const result = await migrateLegacyQuestionTimeout(h.service)
  assert.deepEqual(result, { status: 'complete', value: -1 })
  assert.deepEqual(h.calls, [{ ns: ASK_NS, patch: { questionTimeoutSeconds: -1 }, revision: 7 }])
})

test('an explicit ask-user value wins over the legacy value', async () => {
  const h = harness({ targetUser: { questionTimeoutSeconds: 30 } })
  const result = await migrateLegacyQuestionTimeout(h.service)
  assert.deepEqual(result, { status: 'no-change' })
  assert.equal(h.calls.length, 0)
})

test('a missing explicit legacy value is not migrated', async () => {
  const h = harness({ sourceUser: {}, sourceValue: 120 })
  const result = await migrateLegacyQuestionTimeout(h.service)
  assert.deepEqual(result, { status: 'no-change' })
  assert.equal(h.calls.length, 0)
})

test('an invalid legacy value is ignored', async () => {
  const h = harness({ sourceValue: 0 })
  const result = await migrateLegacyQuestionTimeout(h.service)
  assert.deepEqual(result, { status: 'no-change' })
  assert.equal(h.calls.length, 0)
})

test('a read-only target stays pending without writing', async () => {
  const h = harness({ writable: false })
  const result = await migrateLegacyQuestionTimeout(h.service)
  assert.deepEqual(result, { status: 'pending' })
  assert.equal(h.calls.length, 0)
})

test('an unavailable settings service is a safe no-op', async () => {
  assert.deepEqual(await migrateLegacyQuestionTimeout(undefined), { status: 'unavailable' })
  assert.deepEqual(await migrateLegacyQuestionTimeout({}), { status: 'unavailable' })
})
