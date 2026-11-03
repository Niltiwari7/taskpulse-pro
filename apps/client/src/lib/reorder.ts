export function moveItem<T extends {id : string}>(items: T[], from:number, to:number) {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to,0,moved);
  return {
    items: next,
    beforeId: next[to-1]?.id ?? null,
    afterId: next[to+1]?.id ?? null,
  }
}