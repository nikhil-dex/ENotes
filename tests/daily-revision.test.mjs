import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyRevisionState, localDateKey, recordDailyReview, setDailyRevisionGoal } from '../lib/daily-revision.js';

const morning = new Date(2026, 9, 16, 9, 0, 0);

test('local date key uses the local calendar date', () => {
  assert.equal(localDateKey(morning), '2026-10-16');
});

test('a new day resets completed reviews but keeps a valid goal', () => {
  const result = getDailyRevisionState({ date: '2026-10-15', completed: 7, goal: 15 }, morning);
  assert.deepEqual(result, { date: '2026-10-16', completed: 0, goal: 15 });
});

test('reviewing a card increments today\'s progress', () => {
  const result = recordDailyReview({ date: '2026-10-16', completed: 2, goal: 10 }, morning);
  assert.deepEqual(result, { date: '2026-10-16', completed: 3, goal: 10 });
});

test('goal updates preserve progress and reject unsupported goals', () => {
  assert.deepEqual(setDailyRevisionGoal({ date: '2026-10-16', completed: 4, goal: 10 }, 20, morning), { date: '2026-10-16', completed: 4, goal: 20 });
  assert.throws(() => setDailyRevisionGoal({}, 13, morning), /Daily goal must be/);
});

test('invalid stored progress is normalized safely', () => {
  assert.deepEqual(getDailyRevisionState({ date: '2026-10-16', completed: -3, goal: 99 }, morning), { date: '2026-10-16', completed: 0, goal: 10 });
});
