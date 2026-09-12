import { useCallback, useState } from 'react';

interface HistoryState<T> {
  present: T;
  past: T[];
  future: T[];
}

const CAPACITY = 50;

/**
 * 快照式撤销/重做。每次 commit 记录当前状态，
 * undo/redo 在过去与未来栈之间移动。容量 50 步。
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>({ present: initial, past: [], future: [] });

  const commit = useCallback((next: T | ((cur: T) => T)) => {
    setState((s) => {
      const value = typeof next === 'function' ? (next as (c: T) => T)(s.present) : next;
      if (Object.is(value, s.present)) return s;
      return { present: value, past: [...s.past.slice(-(CAPACITY - 1)), s.present], future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return { present: previous, past: s.past.slice(0, -1), future: [s.present, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return { present: next, past: [...s.past, s.present], future: rest };
    });
  }, []);

  return {
    present: state.present,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
