import React from 'react';

/**
 * Returns the page number that should be used for the current render.
 * When the reset key changes, the hook immediately switches queries to page 1
 * and then persists that reset into state after render.
 */
export function useResettablePage(
  page: number,
  setPage: React.Dispatch<React.SetStateAction<number>>,
  resetKey: string
): number {
  const previousResetKeyRef = React.useRef(resetKey);
  const shouldReset = previousResetKeyRef.current !== resetKey;
  const effectivePage = shouldReset ? 1 : page;

  React.useEffect(() => {
    if (shouldReset && page !== 1) {
      setPage(1);
    }
    previousResetKeyRef.current = resetKey;
  }, [page, resetKey, setPage, shouldReset]);

  return effectivePage;
}
