// One boundary per browser session. Aborting is best effort: it cannot undo an
// already committed write, so stale responses must also be rejected explicitly.
export function createSessionBoundary() {
  let controller = new AbortController();
  let revision = 0;
  return {
    capture() {
      const captured = revision;
      return { signal: controller.signal, isCurrent: () => captured === revision };
    },
    reset() {
      revision++;
      controller.abort();
      controller = new AbortController();
    },
  };
}

export const sessionBoundary = createSessionBoundary();
