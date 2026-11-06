import { isUniqueViolation } from './isUniqueViolation';

// Runs fn, retrying when it fails on a unique constraint. Used for rank writes:
// two concurrent requests can pick the same position, the constraint rejects
// one, and the retry reads fresh neighbors. Other errors, and the last failed
// attempt, are rethrown.
export async function retryOnUniqueViolation<T>(
  fn: () => Promise<T>,
  attempts = 5
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= attempts) throw error;
    }
  }
}
