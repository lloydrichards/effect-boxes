/** @internal */
export const make = <A>(): {
  readonly get: (key: string) => A | undefined;
  readonly set: (key: string, value: A) => void;
} => {
  const entries = new Map<string, A>();

  return {
    get: (key: string): A | undefined => entries.get(key),
    set: (key: string, value: A): void => {
      if (key.length > 1000) {
        return;
      }
      // FIFO keeps hits read-only and bounds retained keys and segment arrays.
      if (entries.size >= 1024 && !entries.has(key)) {
        const oldest = entries.keys().next();
        if (!oldest.done) {
          entries.delete(oldest.value);
        }
      }
      entries.set(key, value);
    },
  };
};
