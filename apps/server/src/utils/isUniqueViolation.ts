// Postgres SQLSTATE 23505 = unique violation. The driver error may be wrapped,
// so walk the `cause` chain.
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('sqlState' in current && current.sqlState === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}