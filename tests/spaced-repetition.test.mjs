import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextReview } from '../lib/spaced-repetition.js';

const now = new Date('2026-10-16T12:00:00.000Z');

test('Again schedules a short retry in ten minutes', () => {
  const result = calculateNextReview({ intervalDays: 3, repetitions: 2 }, 'again', now);
  assert.equal(result.intervalDays, 0);
  assert.equal(result.dueAt, '2026-10-16T12:10:00.000Z');
  assert.equal(result.repetitions, 3);
});

test('Good grows intervals from one to three days and then doubles', () => {
  assert.equal(calculateNextReview({}, 'good', now).intervalDays, 1);
  assert.equal(calculateNextReview({ intervalDays: 1 }, 'good', now).intervalDays, 3);
  assert.equal(calculateNextReview({ intervalDays: 3 }, 'good', now).intervalDays, 6);
});

test('Easy sets a four-day first interval and expands later intervals', () => {
  assert.equal(calculateNextReview({}, 'easy', now).intervalDays, 4);
  assert.equal(calculateNextReview({ intervalDays: 4 }, 'easy', now).intervalDays, 10);
});

test('invalid ratings are rejected', () => {
  assert.throws(() => calculateNextReview({}, 'maybe', now), /Rating must be/);
});
