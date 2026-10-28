# TD Sequential indicator for TradingView (Pine Script v6)

[![test](https://github.com/moolish-com/td-sequential-pine-script/actions/workflows/test.yml/badge.svg)](https://github.com/moolish-com/td-sequential-pine-script/actions/workflows/test.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

A free, open-source TD Sequential indicator for TradingView, written in Pine Script v6. It draws the TD Setup (the 1 to 9 count, often called TD9), the TD Countdown (1 to 13, with a deferred 13 marker), TDST resistance and support levels, an optional perfected-setup marker and an optional price flip. It works on any symbol and timeframe that TradingView offers: crypto, stocks, forex and futures. The rules are written in plain English in [SPEC.md](SPEC.md), and the logic is checked against parity data on every push.

## What is TD Sequential?

TD Sequential is Tom DeMark's method for spotting a stretched run of closes. A setup counts consecutive bars that close beyond the close four bars earlier; a completed 9 can start a countdown that needs 13 qualifying bars. A 9 or a 13 describes past prices and gives no direction on its own. A longer explanation is in the [TD Sequential guide](https://moolish.com/learn/td-sequential/).

## Add it to a chart

1. Open a chart on TradingView and open the Pine Editor (bottom panel).
2. Paste the whole of [`td_sequential.pine`](td_sequential.pine) into a new script.
3. Click **Add to chart**. Open the indicator settings to change labels, colours and limits.

Labels are drawn when a bar closes. The bar that is still forming is not labelled, so a count never appears and then disappears.

## Inputs

| Group | Input | Default | What it does |
|---|---|---|---|
| Setup | Show setup labels | on | Draws the setup numbers: sell above the bar, buy below. |
| Setup | Setup labels | `1-9` | `1-9`, `9 only`, or `Eco (1/6/8/9/13)` which shows only the checkpoint numbers. |
| Countdown | Show countdown labels | on | Draws the countdown numbers 1 to 13. |
| Countdown | Countdown labels | `1-13` | `1-13`, `13 only`, or `Eco (1/6/8/9/13)`. The 13 is highlighted. |
| Countdown | Show deferred 13 marker (+) | on | Marks a bar that qualifies as the 13th but fails the 13-versus-8 test. |
| TDST levels | Show TDST resistance and support | on | Dotted plots of the latest active level, using the plain 9-bar high (resistance, from a buy setup 9) or low (support, from a sell setup 9). |
| Information only | Mark perfected setups | on | Adds `P` to a setup 9 that is perfected. Never changes a count. |
| Information only | Show price flip | off | Triangles where the close-versus-close-4-bars-earlier test changes side. Never changes a count. |
| Label limits | Max labels kept | 300 | Oldest labels are deleted first (TradingView allows 500). |
| Label limits | Draw labels this many bars back | 2000 | Keeps long charts fast. |
| Colours | Sell setup / Buy setup | `#008000` / `#C95995` | Setup labels 1 to 8. |
| Colours | Sell 9 / 13, Buy 9 / 13 | `#FF00FF` / `#00FFFF` | Setup 9 and countdown 13. |
| Colours | Sell countdown / Buy countdown | `#00FFFF` / `#FF8000` | Countdown labels 1 to 12. |
| Colours | TDST resistance / support | `#FFFF00` / `#00BCD4` | The dotted level plots. |

## Alerts

Create an alert from the indicator and pick the condition. Choose **Once per bar close**.

| Condition | Fires when |
|---|---|
| Buy setup 9 | a buy setup completes its 9th bar |
| Sell setup 9 | a sell setup completes its 9th bar |
| Buy countdown 13 | the buy countdown completes (13th qualifying bar, 13-versus-8 test passed) |
| Sell countdown 13 | the sell countdown completes |
| Perfected setup | a setup 9 is perfected (information only) |
| TDST break | the latest TDST resistance or support is broken |

## Rules in short

- **Setup.** A bar counts for the buy side when its close is lower than the close 4 bars earlier, and for the sell side when it is higher. The counter resets on a bar that does not qualify. No price flip is needed to start a count.
- **TDST levels.** A buy setup 9 adds a resistance at the highest high of its 9 bars; a sell setup 9 adds a support at the lowest low. A level is broken when price closes beyond it or a whole bar sits beyond it.
- **Countdown.** After a setup 9, bars whose close is at or below the low 2 bars earlier (buy) or at or above the high 2 bars earlier (sell) are counted up to 13, not necessarily consecutively. The 13th bar must also pass the 13-versus-8 test, otherwise it is deferred. An opposite setup 9, or a broken level, cancels the countdown.
- **Perfected setup and price flip** are shown for information only.

The full rules are in [SPEC.md](SPEC.md).

## Why counts differ from other scripts

TD Sequential has several variants, and scripts disagree on the details. This one follows [SPEC.md](SPEC.md) exactly, which means:

- A setup starts without a price flip, and the counter keeps going past 9 (10, 11, ...) instead of restarting. Only the bar where it equals 9 is a setup 9.
- The countdown starts on the setup 9 bar itself when that bar qualifies, and it needs an active TDST level. When the level is broken the countdown is cancelled.
- The 13-versus-8 test is applied, so a 13 can be deferred (marked `+`).
- TDST levels use the plain 9-bar high and low, not the true high or true low variants. TD Combo is not included.
- Only closed bars are counted, and the chart's first loaded bar is where counting starts. Loading more history can change early counts, so compare scripts on the same bars.

## Verified against reference data

Pine Script cannot run outside TradingView, so [`reference/check.mjs`](reference/check.mjs) contains a line-by-line port of the Pine state machine (same variable names and statement order). It runs over the parity fixtures in `reference/fixtures/` (crypto pairs on daily, 4-hour and weekly timeframes, 3,825 bars) and asserts that every count, level, deferred flag, perfected flag and price flip matches the reference counter in `reference/td-sequential.js` on every bar.

```
node reference/check.mjs
```

This proves the logic. It does not test label drawing, colours or plots, which need TradingView. If you change the Pine code, change the port in the same way and re-run the check.

## Publishing on TradingView

This repository does not claim the script is published on TradingView. If you publish your own copy, read TradingView's [House Rules](https://www.tradingview.com/support/solutions/43000590599-house-rules-on-script-publishing/) first.

## Related

- [td-sequential](https://github.com/moolish-com/td-sequential): JavaScript and TypeScript (npm)
- [td-sequential-python](https://github.com/moolish-com/td-sequential-python): Python (PyPI)
- [td-sequential-screener](https://github.com/moolish-com/td-sequential-screener): command-line screener
- [Free TD Sequential counter](https://moolish.com/tools/td-sequential-counter/): check a crypto pair without installing anything
- Guides: [TD Sequential](https://moolish.com/learn/td-sequential/), [TDST levels](https://moolish.com/learn/td-sequential/tdst/), [perfected setup](https://moolish.com/learn/td-sequential/perfected-setup/)

## Attribution and disclaimer

Moolish is not affiliated with, endorsed by or sponsored by Tom DeMark or DeMARK Analytics. TD Sequential is a method created by Tom DeMark, and DeMARK is a trademark of DeMARK Analytics.

This is educational software, not financial advice. A count describes past prices; it is not a prediction.

## Licence

MIT, Copyright (c) 2026 Moolish. See [LICENSE](LICENSE).
