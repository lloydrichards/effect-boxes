# Width cache measurements

The width and grapheme caches each retain at most 1,024 entries with keys of at
most 1,000 UTF-16 code units. New keys evict the oldest inserted key; reads do
not change insertion order. See [issue #108](https://github.com/lloydrichards/effect-boxes/issues/108).

## Run

Run timing benchmarks from the repository root:

```sh
bun run --cwd packages/effect-boxes benchmark benchmarks/width-cache.bench.ts --reporter=json --outputFile=/tmp/width-cache-after.json
```

The suite measures width, segmentation, and plain rendering for ASCII, Unicode,
and ANSI text. Each sample makes 100 calls:

- Repeated text warms one key before measurement.
- Changing text creates unique keys throughout warmup and sampling, including
  string construction in the timing.
- Rotating text cycles through 1,023, 1,024, or 1,025 prebuilt strings, just below,
  at, and above capacity. Each case warms its working set first and continues
  its cycle across samples. With FIFO, a cycle above capacity continually evicts
  the next needed key.

Run the file alone. Compare matching task names in
`testResults[].assertionResults[].benchmarks[].tasks[]`. Multiply `latency.mean`
by 10 for microseconds per call. Repeat on the same machine and runtime; inspect
`latency.rme` before interpreting small differences. Older reports cover only
repeated and changing text.

For retained heap, run each workload in a fresh process from
`packages/effect-boxes`:

```sh
node --expose-gc --import tsx benchmarks/width-cache-memory.ts changing
node --expose-gc --import tsx benchmarks/width-cache-memory.ts repeated
```

The script warms the renderer, discards output, and forces GC every 25,000
renders through 100,000 renders. The repeated workload controls for runtime
warmup. These samples measure process heap, not exact cache bytes or peak memory;
keep them separate from timing benchmarks.

## Recorded results

Recorded on 2026-10-16, macOS arm64, Node v26.11.1, Vitest 5.0.3. The baseline
at `6a1188a82c9e495a95d795648ef36f3ba0894565` used unbounded Maps.

| Measurement | Unbounded | Bounded FIFO |
| --- | ---: | ---: |
| Retained heap growth, 100,000 changing renders | 24.9 MiB | 1.6 MiB |
| Retained heap growth, repeated control | 1.2 MiB | 1.3 MiB |
| ASCII changing render | 13.492 µs/call | 13.900–14.049 µs/call |
| ANSI changing render | 13.665 µs/call | 14.249–14.447 µs/call |

Changing-text heap growth fell about 94% and levelled off by 50,000 renders.
The short timing runs do not establish a reliable speed difference. These are
observations, not portable test thresholds or evidence that 1,024 is optimal.

Raw timing reports and bounded heap samples are in [baselines/](baselines/).
Rotating workloads were added later and are absent from those saved reports.
