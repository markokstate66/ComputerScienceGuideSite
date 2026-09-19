# Cross-links wanted by /data-structures/arrays-and-dynamic-arrays/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-18, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "Big-O" | /complexity/big-o-notation/ | Opening paragraph. Currently links to /glossary/#big-o-notation; switch to the article (it is the listed prerequisite).
- "`LinkedList<int>`" | /data-structures/linked-lists/ | "Does the wrapper make a list slower than an array?", first paragraph, and the results paragraph ("The linked list is roughly ten times slower").
- "A list makes a good stack" | /data-structures/stacks-and-queues/ | "What Insert and RemoveAt really move", first bullet of the three consequences.
- "Frequent insert or remove at the front: not a list" | /data-structures/stacks-and-queues/ | Last section, fourth bullet (a ring-buffer queue or deque is the usual answer).
- "value type" / "reference type" | /complexity/space-complexity/ | Bullets under the offsets program (`Sample[]`, `string[]`). Currently glossary links; the space-complexity article owns object headers and struct-versus-class layout.
- "Big-O does not see any of this" | /complexity/big-o-notation/ | Warning callout in "Why the column-first loop falls off a cliff".

## Boundaries with siblings

- /complexity/amortized-analysis/ (published) owns the growth policy trace and the O(1) amortized proofs. This article links to it from "A list is an array with a counter" and does not repeat the proof, the capacity trace or TrimExcess.
- /complexity/space-complexity/ owns object headers and measured allocation sizes; this article only measures distances between elements.
- /data-structures/linked-lists/ owns the full array-versus-linked-list argument; this article shows a single timing row as contrast.
