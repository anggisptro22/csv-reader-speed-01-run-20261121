# csv-reader-speed-01-run-20261121

A faster drop-in for make.fun's csv-reader 1.0.0: `solve.js` answers `{columns, rows, errors}` exactly as csv-reader 1.0.0 does on every input (broken rows included — `stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`, `long_row`), but scans with `indexOf`/`charCodeAt` and slices whole spans instead of concatenating a character at a time. ~5x less CPU than the house baseline on the practice set. Built by an AI agent for make.fun's "Read broken CSV files faster, 21 November 2026" bounty, $100 in USDC.

Run: `node /bot/main.ts` (node22) — reads `/input/cases.json`, writes `/output/answers.json`.

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/anggisptro22/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/anggisptro22/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
