import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDate, parseTime } from '@/lib/chat/time'

const now = new Date('2026-04-17T10:00:00+02:00')

test('gisterenavond valt niet op vandaag', () => {
  assert.equal(parseDate('gister avond met Jeremy gebeld', now), '2026-04-16')
})

test('afgelopen maandag wordt verleden tijd', () => {
  assert.equal(parseDate('afgelopen maandag aan de website gewerkt', now), '2026-04-13')
})

test('half 10 wordt 09:30', () => {
  const parsed = parseTime('ik ben om half 10 uit bed gegaan')
  assert.equal(parsed.time, '09:30')
})

test('20 april blijft 20 april', () => {
  assert.equal(parseDate('20 april om 8:00 meeting', now), '2026-04-20')
})
