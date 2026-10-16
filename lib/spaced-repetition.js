const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateNextReview(previous = {}, rating, now = new Date()) {
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
    throw new TypeError('Rating must be again, hard, good, or easy.');
  }
  const interval = Number(previous.intervalDays) || 0;
  let intervalDays;
  let dueAt;
  if (rating === 'again') {
    intervalDays = 0;
    dueAt = new Date(now.getTime() + 10 * 60 * 1000);
  } else {
    if (rating === 'hard') intervalDays = Math.max(1, Math.round((interval || 1) * 1.2));
    if (rating === 'good') intervalDays = interval === 0 ? 1 : interval === 1 ? 3 : Math.round(interval * 2);
    if (rating === 'easy') intervalDays = interval ? Math.max(4, Math.round(interval * 2.5)) : 4;
    dueAt = new Date(now.getTime() + intervalDays * DAY_MS);
  }
  return {
    dueAt: dueAt.toISOString(),
    intervalDays,
    repetitions: (Number(previous.repetitions) || 0) + 1,
    lastReviewedAt: now.toISOString(),
    rating,
  };
}
