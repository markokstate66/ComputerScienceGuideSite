# Cross-links wanted by `/algorithms/dynamic-programming/`

One line each: anchor text | target route | where in the article. Target was unpublished when this round was written (2026-09-22), so the body does not link it yet. The sentence reads correctly with or without the link.

- "'Always take the biggest coin' is not a proof of anything; it is a habit that happens to work for some coin systems and not others" | /algorithms/greedy-algorithms/ | The opening paragraph, right after the greedy-coin-change code block shows 4 coins instead of 3. That planned article owns the exchange-argument proof technique for *when* greedy is correct; this one only needs the one-sentence observation that it can fail, to motivate why an exact method is worth building.

## Boundaries with planned siblings

- /algorithms/greedy-algorithms/ owns the full greedy-vs-DP story: its own coin set ({1, 3, 4}), the exchange argument for when greedy is provably correct, interval scheduling and Huffman coding. This article's coin set ({1, 4, 5}) is deliberately different so the two articles don't share a running example, and this article states only that greedy can fail here, not why or when it's safe in general.
- /complexity/p-vs-np/ (planned) owns subset-sum as a worked brute-force-vs-DP example for pseudo-polynomial time. This article does not mention subset-sum.
- No article in `CONTENT_PLAN.md` §7 is dedicated to the 0/1 knapsack problem; this article is its only planned coverage on the site, at the level of stating the recurrence and noting it fits the same table-and-reconstruction pattern as coin change and LCS, without a full worked example or runnable code.
- /algorithms/recursion/ owns the call stack and its measured ~19,000-frame depth ceiling; this article cites that measurement by link rather than re-deriving it, when explaining why memoization alone doesn't fix recursion depth for very large amounts.
- /complexity/space-complexity/ owns turning an element count into measured bytes; this article states only the element counts for the 2D table (`(coins+1) x (amount+1)` ints) versus the 1D array (`amount+1` ints) and links there for the measurement technique.
