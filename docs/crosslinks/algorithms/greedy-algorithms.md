# Cross-links wanted by `/algorithms/greedy-algorithms/`

One line each: anchor text | target route | where in the article. Target was unpublished when this round was written (2026-09-22, `dynamic-programming` is being drafted concurrently this same round), so the body does not link it yet. The sentence reads correctly with or without the link.

- "the DP article on this site covers that construction" | /algorithms/dynamic-programming/ | End of the "Extend the code: when the exchange argument stops applying" exercise solution, in the interval-scheduling section — the sentence explaining that weighted interval scheduling needs a DP table (take-or-skip per job) rather than a single greedy pass. — Status: wired (body, exercise solution closing sentence)

## Boundaries with the planned sibling

- `/algorithms/dynamic-programming/` owns the full DP treatment of coin change (memoize → tabulate → recover the solution) and of weighted interval scheduling / LCS / knapsack / edit distance as worked constructions. This article uses coin change only as a greedy *failure* case and states the DP recurrence informally (the `MinCoins` table in the "Checking whether greedy matches optimal" section) just far enough to prove the greedy-choice property fails for `{1, 3, 4}` — it does not re-derive DP's memoize-then-tabulate progression, and does not build the full weighted-interval-scheduling DP construction referenced in the exercise above.
