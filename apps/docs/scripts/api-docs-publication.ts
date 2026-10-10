import { Effect, type FileSystem, type PlatformError } from "effect";

/** Restore the previous directory if publication fails or is interrupted. */
export const publishApi = (
  fs: FileSystem.FileSystem,
  stagedApi: string,
  apiDir: string,
  previousApi: string
): Effect.Effect<void, PlatformError.PlatformError> =>
  Effect.acquireUseRelease(
    Effect.void,
    () =>
      Effect.gen(function* () {
        if (yield* fs.exists(apiDir)) yield* fs.rename(apiDir, previousApi);
        yield* fs.rename(stagedApi, apiDir);
      }),
    () =>
      Effect.gen(function* () {
        if ((yield* fs.exists(previousApi)) && !(yield* fs.exists(apiDir))) {
          yield* fs.rename(previousApi, apiDir);
        }
      })
  ).pipe(Effect.uninterruptible);
