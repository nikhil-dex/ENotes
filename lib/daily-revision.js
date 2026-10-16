const DEFAULT_GOAL = 10;
const ALLOWED_GOALS = new Set([5, 10, 15, 20]);

export function localDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyRevisionState(stored, now = new Date()) {
  const date = localDateKey(now);
  const goal = ALLOWED_GOALS.has(Number(stored?.goal)) ? Number(stored.goal) : DEFAULT_GOAL;
  if (!stored || stored.date !== date) return { date, completed: 0, goal };
  const completed = Number.isSafeInteger(stored.completed) && stored.completed >= 0 ? stored.completed : 0;
  return { date, completed, goal };
}

export function recordDailyReview(state, now = new Date()) {
  const current = getDailyRevisionState(state, now);
  return { ...current, completed: current.completed + 1 };
}

export function setDailyRevisionGoal(state, goal, now = new Date()) {
  const current = getDailyRevisionState(state, now);
  if (!ALLOWED_GOALS.has(Number(goal))) throw new TypeError('Daily goal must be 5, 10, 15, or 20.');
  return { ...current, goal: Number(goal) };
}
