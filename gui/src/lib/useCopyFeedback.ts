import { useCallback, useRef, useState } from 'react';

export function useCopyFeedback(timeoutMs = 1400) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const trigger = useCallback(
    (nextMessage: string) => {
      setMessage(nextMessage);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setMessage(null);
      }, timeoutMs);
    },
    [timeoutMs]
  );

  return { message, trigger };
}
