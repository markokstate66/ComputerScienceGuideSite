// The three learning paths on /start-here/ (CONTENT_PLAN.md §7, "Cross-cutting pages").
// Each step names an article as "pillar/slug" and says why it comes at that point.
// Only published articles are rendered; a step whose article is not published is skipped.
export type LearningPath = {
  id: string;
  title: string;
  /** Who the path is for and what they will be able to do at the end. */
  intro: string;
  steps: { article: string; why: string }[];
};

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'foundations',
    title: 'CS foundations for self-taught developers',
    intro:
      "For developers who learned to code by building things rather than by studying computer science, and who want the vocabulary and reasoning tools that assumes. By the end you can talk about an algorithm's cost precisely, choose the right built-in collection instead of guessing, and use Git and automated tests as everyday tools rather than things you copy commands for. Ten articles.",
    steps: [
      {
        article: 'complexity/big-o-notation',
        why: 'Start here because every later article measures cost in Big-O; without this vocabulary, "faster" and "slower" stay vague.',
      },
      {
        article: 'data-structures/arrays-and-dynamic-arrays',
        why: 'The first data structure, and the one every other structure in this path is compared against or built from; it also puts the previous step\'s O(1) and O(n) to work on something concrete.',
      },
      {
        article: 'data-structures/linked-lists',
        why: "Contrasts directly with the array's contiguous layout from the previous step, so the trade-off (cheap insertion vs. cheap indexing) lands as a comparison, not an abstract rule.",
      },
      {
        article: 'data-structures/stacks-and-queues',
        why: 'Builds on the array-vs-linked-list trade-off from the last two steps to show how a restricted interface (only touch one end, or each end for a different operation) is what makes a structure predictable to reason about.',
      },
      {
        article: 'data-structures/hash-tables',
        why: 'The last of the core storage structures, and the one behind Dictionary<TKey,TValue>, explaining why its lookups are fast; it builds directly on the array from step 2.',
      },
      {
        article: 'algorithms/binary-search',
        why: 'The first algorithm in the path, chosen because it is small enough to get exactly right, and it is a listed prerequisite for the next two steps.',
      },
      {
        article: 'algorithms/recursion',
        why: 'Needed before the traversal in the next step makes sense, since walking a tree or graph is naturally recursive; it also revisits the call stack from a cost angle, not just a syntax one.',
      },
      {
        article: 'algorithms/breadth-first-and-depth-first-search',
        why: 'Puts the stack and queue from step 4 and the recursion from step 7 to work solving an actual problem (walking a graph), tying the path\'s data structures and algorithms together before it turns to engineering practice.',
      },
      {
        article: 'version-control/how-git-works',
        why: 'A deliberate turn from algorithmic reasoning to a daily practice that is easy to learn by rote instead of by understanding: knowing what a commit, tree and ref actually are removes the need to memorize Git incantations.',
      },
      {
        article: 'testing/unit-testing-fundamentals',
        why: "Closes the path with the other practice that separates 'can write code' from 'can maintain code': writing a test that proves what a piece of code does, and that fails honestly when it stops doing it.",
      },
    ],
  },
  {
    id: 'dotnet-depth',
    title: '.NET developer depth: how the runtime and BCL really behave',
    intro:
      'For C# developers who already ship features and want to know what the runtime is actually doing underneath: how the GC decides what to collect, why a struct sometimes still allocates, what a cache line costs, and where async, LINQ and generics hide real work behind convenient syntax. By the end you can predict and measure that behavior instead of taking it on faith. Fourteen articles.',
    steps: [
      {
        article: 'complexity/big-o-notation',
        why: 'A short baseline: the rest of this path measures cost in Big-O terms (an O(1) versus O(n) resize, an O(log n) lookup), so it needs to be fixed first.',
      },
      {
        article: 'data-structures/arrays-and-dynamic-arrays',
        why: 'Establishes that List<T> is a contiguous block of memory with a counter, which the space-complexity and memory-hierarchy steps later in this path both build on directly.',
      },
      {
        article: 'csharp-dotnet/value-types-vs-reference-types',
        why: 'The distinction every later C# and .NET step in this path depends on: garbage collection, async state machines, LINQ, generics, strings and Span<T> all behave differently depending on whether their subject is a value or a reference.',
      },
      {
        article: 'csharp-dotnet/garbage-collection',
        why: "Builds directly on the previous step: what the GC actually collects, and how often, is a question about reference types specifically, not about value types, which the previous step showed do not always end up on the heap.",
      },
      {
        article: 'complexity/space-complexity',
        why: "Follows on from steps 2 and 3 by putting a number on 'what an object actually costs': the struct-in-an-array-versus-class-in-an-array comparison only makes sense once value/reference semantics and array layout are both in hand.",
      },
      {
        article: 'operating-systems/processes-and-threads',
        why: 'Introduces what a thread owns and costs before the path asks two threads to share memory (later steps) or a C# method to suspend and resume across one (the async step later).',
      },
      {
        article: 'operating-systems/virtual-memory',
        why: "Builds on the previous step to explain the private address space every process gets: a mapping the OS and hardware maintain, page by page, over physical memory.",
      },
      {
        article: 'operating-systems/memory-hierarchy-and-caches',
        why: "Takes the array layout from step 2 further, down to the cache-line level: what a cache line actually moves, and why two threads (introduced two steps back) can fight over one without sharing any data.",
      },
      {
        article: 'operating-systems/concurrency-race-conditions-locks',
        why: 'Follows from the processes and threads step (step 6): once two threads can run at once, this is what happens when they touch the same memory without coordinating, and how locks fix it.',
      },
      {
        article: 'csharp-dotnet/async-await',
        why: "Returns to value/reference types (step 3) and threads (step 6) to show what the compiler actually builds for await: a state machine, not a new thread.",
      },
      {
        article: 'csharp-dotnet/linq-deferred-execution',
        why: 'Another place C# hides real work behind convenient syntax, this time a query that does not run until enumerated; placed after async/await because both are about when code actually executes versus when it looks like it does.',
      },
      {
        article: 'csharp-dotnet/generics',
        why: 'Builds on value-versus-reference types (step 3) to explain why a generic method over a value type does not box its argument the way object-typed code such as ArrayList would.',
      },
      {
        article: 'csharp-dotnet/strings-and-unicode',
        why: 'A value/reference-type question (step 3) applied to string: why a string is immutable, and why .NET counting a "character" is three different numbers depending on which API asks.',
      },
      {
        article: 'csharp-dotnet/span-and-memory',
        why: 'The capstone: Span<T> only makes sense once value types (step 3), the string layout from the previous step, and the stack-versus-heap reasoning from the value-types and garbage-collection steps are all already in place, and it is the article that finally explains why some types cannot cross an await.',
      },
    ],
  },
  {
    id: 'interview-refresh',
    title: 'Interview-style fundamentals refresh',
    intro:
      "For developers who already know this material from school or past study and need a fast, structured refresher before technical interviews: the complexity vocabulary, the core data structures, and the classic algorithm families (searching, sorting, dynamic programming, greedy, graph traversal). By the end you can reason about a new problem out loud, in the terms an interviewer expects. Fourteen articles.",
    steps: [
      {
        article: 'complexity/big-o-notation',
        why: "The shared vocabulary for every step that follows; every later article states its costs in this notation.",
      },
      {
        article: 'complexity/best-average-worst-case',
        why: "Immediately sharpens step 1's vocabulary with a distinction worth being precise about: an algorithm's Big-O is not one number but three, and quicksort is the standard example of why that gap matters.",
      },
      {
        article: 'data-structures/arrays-and-dynamic-arrays',
        why: 'The structure every other one in this refresh is compared against, and the starting point for problems phrased as "given an array...".',
      },
      {
        article: 'data-structures/hash-tables',
        why: "Builds on the array from the previous step to deliver the O(1)-lookup structure ('use a hash map') that many problems reduce to.",
      },
      {
        article: 'data-structures/linked-lists',
        why: 'Contrasts directly with the array from step 3; pointer manipulation such as reversal is easier to drill once that contrast is explicit.',
      },
      {
        article: 'data-structures/stacks-and-queues',
        why: 'Completes the linear-structure trio (array, linked list, stack/queue) before the refresh moves on to trees and graphs, and is the structure the traversal steps later in this path are built on.',
      },
      {
        article: 'algorithms/binary-search',
        why: 'Small enough to get exactly right, which is the whole challenge, and a listed prerequisite for the recursion step that follows.',
      },
      {
        article: 'algorithms/recursion',
        why: 'Needed before trees, graph traversal, and dynamic programming all make sense in the steps ahead.',
      },
      {
        article: 'data-structures/binary-search-trees',
        why: 'The first non-linear structure in the refresh, placed here because it needs recursion (previous step) and the linked-list pointer mechanics from step 5.',
      },
      {
        article: 'data-structures/heaps-and-priority-queues',
        why: "Pairs with the BST from the previous step as the other tree-shaped structure in the refresh, and its bounded-heap section solves the keep-only-the-k-largest problem.",
      },
      {
        article: 'algorithms/breadth-first-and-depth-first-search',
        why: 'Graph and tree traversal, the direct payoff of the recursion (step 8) and stack/queue (step 6) steps.',
      },
      {
        article: 'algorithms/sorting-algorithms-compared',
        why: "Revisits step 2's best/average/worst-case lens across a full family of algorithms, so sorts can be compared case by case rather than by one label.",
      },
      {
        article: 'algorithms/dynamic-programming',
        why: 'Needs recursion (step 8) as a hard prerequisite; placed near the end so the traversal and sorting vocabulary from the steps before it is available to describe subproblems.',
      },
      {
        article: 'algorithms/greedy-algorithms',
        why: 'Closes the refresh by asking the question dynamic programming (previous step) leaves open: whether the locally-best choice is ever provably enough to skip the full search.',
      },
    ],
  },
];
