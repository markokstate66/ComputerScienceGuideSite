---
title: "Tries: Prefix Trees for Autocomplete"
description: "Build a Trie with Insert, Contains and StartsWith, then benchmark it against a sorted array and binary search at real sizes — including where the trie loses."
pillar: data-structures
order: 8
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [trie, autocomplete, prefix-tree, binary-search, memory-allocation]
prerequisites: ["algorithms/binary-search", "data-structures/arrays-and-dynamic-arrays"]
sources:
  - title: "TrieST.java (Algorithms, 4th edition, companion code)"
    url: "https://algs4.cs.princeton.edu/52trie/TrieST.java.html"
    publisher: "Sedgewick & Wayne, algs4.cs.princeton.edu"
    accessed: 2026-09-22
  - title: "LC-trie implementation notes (fib_trie)"
    url: "https://docs.kernel.org/networking/fib_trie.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "Array.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SortedList<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.sortedlist-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "GC.GetAllocatedBytesForCurrentThread Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StringComparison Enum"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.stringcomparison"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SpanHelpers.Char.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/SpanHelpers.Char.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
draft: false
---

Type `ca` into a search box that autocompletes and it has to answer one question immediately: which of the stored strings begin with `ca`? A phone's contacts list, a code editor's symbol list, and a shell's tab completion all solve the same problem — find every string in a set that shares a given prefix — and the structure behind each one is a choice, not a foregone conclusion. This article builds the textbook answer, a trie, measures what it actually costs against the plainer alternative of a sorted array and [binary search](/algorithms/binary-search/), and shows that the textbook answer does not win by default.

## The autocomplete problem

Given a set of strings *S* and a query string *p*, prefix search returns every *s* in *S* such that *s* starts with *p*. That is different from ordinary membership search (does *S* contain exactly *p*?) in one important way: the answer can be many strings, not one, and the caller usually wants all of them, not just a yes or no. The set is typically built once — or updated occasionally — and then queried on every keystroke, so it is worth spending some memory or preprocessing time to make each query cheap. The rest of this article is one running example: the five words `car`, `care`, `careful`, `do`, `dot`, chosen because `care` sits on the path to `careful` and `do` sits on the path to `dot`, so both a word and a longer word that contains it can exist in the same set at once.

## Checking every prefix by hand

The most direct implementation needs no data structure at all: keep the words in a list and check each one.

```csharp run id=naive-scan
string[] words = ["car", "care", "careful", "do", "dot"];

IEnumerable<string> LinearPrefixSearch(string[] words, string prefix) =>
    words.Where(w => w.StartsWith(prefix, StringComparison.Ordinal));

Console.WriteLine(
    $"prefix \"ca\": {string.Join(", ", LinearPrefixSearch(words, "ca").OrderBy(w => w))}");
Console.WriteLine(
    $"prefix \"do\": {string.Join(", ", LinearPrefixSearch(words, "do").OrderBy(w => w))}");
```

```text output
prefix "ca": car, care, careful
prefix "do": do, dot
```

`StringComparison.Ordinal` matters here, not just style: Microsoft's documentation for [`StringComparison`](https://learn.microsoft.com/en-us/dotnet/api/system.stringcomparison) describes ordinal comparison as one that "performs a comparison based on the numeric value (Unicode code point) of each `Char` in the string" — a direct code-unit comparison with no culture-specific sorting rules layered on top, which is exactly the comparison a character-by-character structure like a trie also does, so the two approaches are comparing the same thing.

`Where` checks every one of the *n* words against the prefix, and each check costs up to the prefix's length in character comparisons before it can rule a word in or out. That is Θ(*n* × |*p*|) worst case: doubling the word count doubles the work, no matter how the words are arranged. Nothing here is wrong, exactly — it is simple, it needs no auxiliary structure, and for a few hundred words it is instant. The rest of this article is about what changes as the set gets larger, and what that costs.

## A trie: one path per shared prefix

A trie (the name comes from re**trie**val, conventionally pronounced like "try" to avoid colliding with "tree") stores a set of strings as a tree of individual characters: each edge consumes one character, and a node is marked as the end of a stored word if the path from the root to that node spells out exactly that word. Every word that shares a prefix walks the same initial edges, so the prefix is stored once no matter how many words extend it.

<figure class="diagram">
<svg viewBox="0 0 320 350" role="img" aria-labelledby="trie-title trie-desc">
<title id="trie-title">A trie built from car, care, careful, do and dot</title>
<desc id="trie-desc">Two chains from a shared root. The left chain spells c, a, r, e, f, u, l, with accent-colored nodes at r, e and l marking car, care and careful. The right chain spells d, o, t, with accent-colored nodes at o and t marking do and dot.</desc>
<circle cx="160" cy="15" r="4" class="d-fill-stroke"/>
<line x1="160" y1="15" x2="70" y2="55" class="d-line"/>
<line x1="160" y1="15" x2="250" y2="55" class="d-line"/>
<line x1="70" y1="55" x2="70" y2="95" class="d-line"/>
<line x1="70" y1="95" x2="70" y2="135" class="d-line"/>
<line x1="70" y1="135" x2="70" y2="175" class="d-line"/>
<line x1="70" y1="175" x2="70" y2="215" class="d-line"/>
<line x1="70" y1="215" x2="70" y2="255" class="d-line"/>
<line x1="70" y1="255" x2="70" y2="295" class="d-line"/>
<line x1="250" y1="55" x2="250" y2="95" class="d-line"/>
<line x1="250" y1="95" x2="250" y2="135" class="d-line"/>
<circle cx="70" cy="55" r="13" class="d-box"/>
<text x="70" y="60" text-anchor="middle" class="d-mono">c</text>
<circle cx="70" cy="95" r="13" class="d-box"/>
<text x="70" y="100" text-anchor="middle" class="d-mono">a</text>
<circle cx="70" cy="135" r="13" class="d-box-accent"/>
<text x="70" y="140" text-anchor="middle" class="d-mono d-bold">r</text>
<circle cx="70" cy="175" r="13" class="d-box-accent"/>
<text x="70" y="180" text-anchor="middle" class="d-mono d-bold">e</text>
<circle cx="70" cy="215" r="13" class="d-box"/>
<text x="70" y="220" text-anchor="middle" class="d-mono">f</text>
<circle cx="70" cy="255" r="13" class="d-box"/>
<text x="70" y="260" text-anchor="middle" class="d-mono">u</text>
<circle cx="70" cy="295" r="13" class="d-box-accent"/>
<text x="70" y="300" text-anchor="middle" class="d-mono d-bold">l</text>
<circle cx="250" cy="55" r="13" class="d-box"/>
<text x="250" y="60" text-anchor="middle" class="d-mono">d</text>
<circle cx="250" cy="95" r="13" class="d-box-accent"/>
<text x="250" y="100" text-anchor="middle" class="d-mono d-bold">o</text>
<circle cx="250" cy="135" r="13" class="d-box-accent"/>
<text x="250" y="140" text-anchor="middle" class="d-mono d-bold">t</text>
<text x="20" y="330" class="d-small d-muted">Accent nodes mark stored words.</text>
</svg>
<figcaption>Figure 1. The trie built by inserting car, care, careful, do and dot in that order. care sits directly above careful because care is a prefix of it; do sits directly above dot for the same reason. Reading root to node along the accent-colored nodes spells car, care, careful, do and dot.</figcaption>
</figure>

`Trie` below stores each node's children in a `Dictionary<char, TrieNode>`, created lazily so a leaf node costs nothing beyond the node itself — an adaptive alternative to giving every node one array slot per possible character, which is what Sedgewick and Wayne's reference implementation does: their [`TrieST.java`](https://algs4.cs.princeton.edu/52trie/TrieST.java.html) is, in their own words, "a 256-way trie" with `private Node[] next = new Node[R]` on every node, sized for the full extended-ASCII alphabet whether a node branches once or two hundred times. The same source states the cost of the operations directly: "the `put`, `contains`, `delete`, and `longest prefix` operations take time proportional to the length of the key (in the worst case)" — insert, exact-match lookup and prefix lookup all cost O(*L*), where *L* is the length of the key being inserted or looked up, regardless of how many other keys are already stored. That is the trie's entire pitch: unlike the [binary search tree](/data-structures/binary-search-trees/) built earlier in this pillar, whose height — and so whose search cost — depends on how many keys are stored *and* the order they arrived in, a trie's lookup cost depends only on the length of the string you are looking up. Inserting the same five words in any order produces the identical final trie, because each string maps to exactly one root-to-node path; there is no notion of a "degenerate" trie the way there is a degenerate binary search tree.

```csharp run id=trie-basic
var trie = new Trie();
foreach (string w in new[] { "car", "care", "careful", "do", "dot" })
    trie.Insert(w);

Console.WriteLine($"Contains(\"do\"): {trie.Contains("do")}");
Console.WriteLine($"Contains(\"d\"): {trie.Contains("d")}");
Console.WriteLine(
    $"StartsWith(\"ca\"): {string.Join(", ", trie.StartsWith("ca").OrderBy(w => w))}");
Console.WriteLine(
    $"StartsWith(\"do\"): {string.Join(", ", trie.StartsWith("do").OrderBy(w => w))}");
Console.WriteLine(
    $"StartsWith(\"xyz\"): [{string.Join(", ", trie.StartsWith("xyz"))}]");

sealed class TrieNode
{
    public Dictionary<char, TrieNode>? Children;
    public bool IsWord;
}

sealed class Trie
{
    private readonly TrieNode _root = new();

    public void Insert(string word)
    {
        TrieNode node = _root;
        foreach (char c in word)
        {
            node.Children ??= new Dictionary<char, TrieNode>();
            if (!node.Children.TryGetValue(c, out TrieNode? next))
            {
                next = new TrieNode();
                node.Children[c] = next;
            }
            node = next;
        }
        node.IsWord = true;
    }

    public bool Contains(string word) => Walk(word) is { IsWord: true };

    public IEnumerable<string> StartsWith(string prefix)
    {
        TrieNode? start = Walk(prefix);
        if (start is null) yield break;
        foreach (string suffix in Suffixes(start))
            yield return prefix + suffix;
    }

    private TrieNode? Walk(string s)
    {
        TrieNode node = _root;
        foreach (char c in s)
        {
            if (node.Children is null || !node.Children.TryGetValue(c, out TrieNode? next))
                return null;
            node = next;
        }
        return node;
    }

    private static IEnumerable<string> Suffixes(TrieNode node)
    {
        if (node.IsWord) yield return "";
        if (node.Children is null) yield break;
        foreach ((char c, TrieNode child) in node.Children)
            foreach (string rest in Suffixes(child))
                yield return c + rest;
    }
}
```

```text output
Contains("do"): True
Contains("d"): False
StartsWith("ca"): car, care, careful
StartsWith("do"): do, dot
StartsWith("xyz"): []
```

`Contains` (named to match `Bst<T>.Contains` from the binary-search-tree article, rather than `Search`) walks the trie one character at a time and asks whether the node it lands on is marked as a word — `"d"` reaches a real node, so `Walk` does not return `null`, but that node's `IsWord` is `false`, because `"d"` alone was never inserted. `StartsWith` does the same walk to find the node for the prefix, then explores every path below it, appending each character it passes through; `Suffixes` is a local recursive walk that yields `""` at a word boundary and one string per child otherwise, which is why `StartsWith("ca")` returns three words from a single four-character walk (`c`, `a`, and the branch at `r`) instead of scanning anything that does not start with `ca`.

::::exercise[Delete a word without touching its neighbors]
`Trie` above has no `Remove`. Add one. Deleting a word should clear its node's `IsWord` flag, and then remove any nodes on its path that are left with no children and are not themselves the end of another word — but it must stop as soon as it reaches a node that is still needed, either because it has other children or because it marks another stored word. Removing `"careful"` should leave `"care"` completely intact; removing `"dot"` should leave `"do"` completely intact.

:::solution
The recursive walk carries the removal down to the last character, then decides on the way back up — after the recursive call returns — whether the child it just came from can be unlinked: only if that child both stopped being a word and is now childless itself.

```csharp run id=trie-remove
var trie = new Trie();
foreach (string w in new[] { "car", "care", "careful", "do", "dot" })
    trie.Insert(w);
Console.WriteLine($"before: StartsWith(\"ca\") = {string.Join(", ", trie.StartsWith("ca").OrderBy(w => w))}");
Console.WriteLine($"before: StartsWith(\"do\") = {string.Join(", ", trie.StartsWith("do").OrderBy(w => w))}");

trie.Remove("car");
Console.WriteLine($"after Remove(\"car\"): Contains(\"car\")={trie.Contains("car")}, Contains(\"care\")={trie.Contains("care")}");

trie.Remove("dot");
trie.Remove("do");
Console.WriteLine($"after Remove(\"dot\"), Remove(\"do\"): StartsWith(\"do\") = [{string.Join(", ", trie.StartsWith("do"))}]");
Console.WriteLine($"unaffected: StartsWith(\"ca\") = {string.Join(", ", trie.StartsWith("ca").OrderBy(w => w))}");

sealed class TrieNode
{
    public Dictionary<char, TrieNode>? Children;
    public bool IsWord;
}

sealed class Trie
{
    private readonly TrieNode _root = new();

    public void Insert(string word)
    {
        TrieNode node = _root;
        foreach (char c in word)
        {
            node.Children ??= new Dictionary<char, TrieNode>();
            if (!node.Children.TryGetValue(c, out TrieNode? next))
            {
                next = new TrieNode();
                node.Children[c] = next;
            }
            node = next;
        }
        node.IsWord = true;
    }

    public bool Contains(string word) => Walk(word) is { IsWord: true };

    public IEnumerable<string> StartsWith(string prefix)
    {
        TrieNode? start = Walk(prefix);
        if (start is null) yield break;
        foreach (string suffix in Suffixes(start))
            yield return prefix + suffix;
    }

    public bool Remove(string word) => Remove(_root, word, 0);

    private static bool Remove(TrieNode node, string word, int depth)
    {
        if (depth == word.Length)
        {
            if (!node.IsWord) return false;
            node.IsWord = false;
            return true;
        }
        char c = word[depth];
        if (node.Children is null || !node.Children.TryGetValue(c, out TrieNode? child))
            return false;
        bool removed = Remove(child, word, depth + 1);
        if (removed && !child.IsWord && (child.Children is null || child.Children.Count == 0))
            node.Children.Remove(c);
        return removed;
    }

    private TrieNode? Walk(string s)
    {
        TrieNode node = _root;
        foreach (char c in s)
        {
            if (node.Children is null || !node.Children.TryGetValue(c, out TrieNode? next))
                return null;
            node = next;
        }
        return node;
    }

    private static IEnumerable<string> Suffixes(TrieNode node)
    {
        if (node.IsWord) yield return "";
        if (node.Children is null) yield break;
        foreach ((char c, TrieNode child) in node.Children)
            foreach (string rest in Suffixes(child))
                yield return c + rest;
    }
}
```

```text output
before: StartsWith("ca") = car, care, careful
before: StartsWith("do") = do, dot
after Remove("car"): Contains("car")=False, Contains("care")=True
after Remove("dot"), Remove("do"): StartsWith("do") = []
unaffected: StartsWith("ca") = care, careful
```

Removing `"car"` only clears the `IsWord` flag on the `r` node — that node still has a child (`e`, on the way to `care`), so the pruning condition never fires and nothing is unlinked. Removing `"dot"` then `"do"` is the case that does prune: `"dot"`'s removal clears `t`'s flag and, since `t` has no children, unlinks it from `o`; `"do"`'s removal then clears `o`'s flag, and `o` — now childless too — gets unlinked from `d`, and so on back up to the root, leaving no trace of either word.
:::
::::

## What a trie costs in memory

Every character in a trie built this way is a real, separately allocated object: a `TrieNode`, plus (for any node with at least one child) a `Dictionary<char, TrieNode>` to hold them. A sorted array of the same words pays for none of that — it just holds one reference per string. [`GC.GetAllocatedBytesForCurrentThread`](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread) reports "the total number of bytes allocated on the managed heap during the lifetime of a thread," so subtracting a reading taken before building each structure from one taken after gives the real cost of building it, independent of when the garbage collector happens to run:

```csharp run id=trie-memory-small
// Warm up the JIT and static caches so the first measured size
// isn't charged for one-time setup costs.
string[] warmupWords = ["alpha", "beta", "gamma"];
string[] warmupSorted = (string[])warmupWords.Clone();
Array.Sort(warmupSorted, StringComparer.Ordinal);
var warmupTrie = new Trie();
foreach (string w in warmupWords) warmupTrie.Insert(w);

var rng = new Random(42);
string RandomWord()
{
    int len = rng.Next(4, 11);
    Span<char> buf = stackalloc char[len];
    for (int i = 0; i < len; i++) buf[i] = (char)('a' + rng.Next(26));
    return new string(buf);
}

int[] sizes = [50, 500, 5_000];
Console.WriteLine($"{"words",7} {"sorted array",13} {"trie",10} {"trie / array",13}");
foreach (int n in sizes)
{
    var words = new HashSet<string>();
    while (words.Count < n) words.Add(RandomWord());
    string[] wordArray = [.. words];

    long beforeArray = GC.GetAllocatedBytesForCurrentThread();
    string[] sorted = (string[])wordArray.Clone();
    Array.Sort(sorted, StringComparer.Ordinal);
    long arrayBytes = GC.GetAllocatedBytesForCurrentThread() - beforeArray;

    long beforeTrie = GC.GetAllocatedBytesForCurrentThread();
    var trie = new Trie();
    foreach (string w in wordArray) trie.Insert(w);
    long trieBytes = GC.GetAllocatedBytesForCurrentThread() - beforeTrie;

    Console.WriteLine(
        $"{n,7} {arrayBytes / 1024.0,10:F1} KB {trieBytes / 1024.0,7:F1} KB {(double)trieBytes / arrayBytes,10:F1}x");
}

sealed class TrieNode
{
    public Dictionary<char, TrieNode>? Children;
    public bool IsWord;
}

sealed class Trie
{
    private readonly TrieNode _root = new();

    public void Insert(string word)
    {
        TrieNode node = _root;
        foreach (char c in word)
        {
            node.Children ??= new Dictionary<char, TrieNode>();
            if (!node.Children.TryGetValue(c, out TrieNode? next))
            {
                next = new TrieNode();
                node.Children[c] = next;
            }
            node = next;
        }
        node.IsWord = true;
    }
}
```

```text output
  words  sorted array       trie  trie / array
     50 [...] KB [...] KB [...]x
    500 [...] KB [...] KB [...]x
   5000 [...] KB [...] KB [...]x
```

One run on this machine (.NET 10.0.12 on Windows 11, build 22631, 16 logical processors): 50 synthetic words used 0.5 KB as a sorted array and 69.8 KB as a trie — about 146 times as much. At 500 words it was 4.0 KB against 604.6 KB (about 152 times), and at 5,000 words, 39.1 KB against 5,324.1 KB (about 136 times). The words here are randomly generated lowercase strings, not a real dictionary — a repository cannot ship one, and generating them with a fixed seed keeps the measurement reproducible — but the mechanism this exposes has nothing to do with which words were chosen: every one of those nodes carries its own object header, its own `bool`, and (except at the leaves) its own `Dictionary<char, TrieNode>`, which itself allocates internal bucket and entry arrays the first time something is added to it. A sorted array asks none of that of any word it stores.

::::exercise[Does sharing more of the prefix change the outcome?]
The words above barely share any structure — they are close to uniformly random, so the trie gets almost no benefit from storing shared prefixes once. Predict what happens to the trie-to-array memory ratio if every word shares a long common prefix instead — say, 676 twenty-character words that agree on their first eighteen characters and differ only in the last two. Then run the code below to check.

:::solution
```csharp run id=trie-extreme-sharing
var words = new List<string>();
string basePrefix = "autocompleteprefix"; // 18 characters, fixed for every word
for (char a = 'a'; a <= 'z'; a++)
    for (char b = 'a'; b <= 'z'; b++)
        words.Add(basePrefix + a + b);
string[] wordArray = [.. words]; // 676 words, 20 characters each

long beforeArray = GC.GetAllocatedBytesForCurrentThread();
string[] sorted = (string[])wordArray.Clone();
Array.Sort(sorted, StringComparer.Ordinal);
long arrayBytes = GC.GetAllocatedBytesForCurrentThread() - beforeArray;

long beforeTrie = GC.GetAllocatedBytesForCurrentThread();
var trie = new Trie();
foreach (string w in wordArray) trie.Insert(w);
long trieBytes = GC.GetAllocatedBytesForCurrentThread() - beforeTrie;

Console.WriteLine($"{wordArray.Length} words, each {wordArray[0].Length} chars, sharing an 18-char prefix:");
Console.WriteLine($"sorted array: {arrayBytes / 1024.0:F1} KB");
Console.WriteLine($"trie:         {trieBytes / 1024.0:F1} KB");

sealed class TrieNode
{
    public Dictionary<char, TrieNode>? Children;
    public bool IsWord;
}

sealed class Trie
{
    private readonly TrieNode _root = new();

    public void Insert(string word)
    {
        TrieNode node = _root;
        foreach (char c in word)
        {
            node.Children ??= new Dictionary<char, TrieNode>();
            if (!node.Children.TryGetValue(c, out TrieNode? next))
            {
                next = new TrieNode();
                node.Children[c] = next;
            }
            node = next;
        }
        node.IsWord = true;
    }
}
```

```text output
676 words, each 20 chars, sharing an 18-char prefix:
sorted array: [...] KB
trie:         [...] KB
```

On one run: 11.8 KB for the array, 81.3 KB for the trie — still about seven times as much, even though 18 of every word's 20 characters are shared by all 676 of them. Sharing helps (the ratio dropped from roughly 150x to roughly 7x), but it does not flip the result, because most of the trie's cost is per-node bookkeeping (an object header and a lazily-allocated dictionary), not per-character storage, while the array's cost is close to zero marginal bytes per word: it holds references to string objects that already exist, rather than paying to store their characters a second time.
:::
::::

## Compressed tries collapse the chains that don't branch

The `f` → `u` → `l` chain in Figure 1 never branches — `f` has exactly one child, and so does `u` — so three separate node-and-dictionary allocations are spent to encode information that a single edge labeled `"ful"` could hold instead. A **radix tree** (also called a compressed trie, or historically a Patricia trie) applies exactly this idea: any node that has only one child and is not itself a stored word gets merged into the edge leading to it, so a chain of single-child steps becomes one edge carrying a whole substring.

<figure class="diagram">
<svg viewBox="0 0 320 290" role="img" aria-labelledby="radix-title radix-desc">
<title id="radix-title">The same five words as a compressed trie</title>
<desc id="radix-desc">A root with two edges: one labeled car leading to a node for car, then an edge labeled e to care, then an edge labeled ful to careful; the other labeled do leading to a node for do, then an edge labeled t to dot. Six nodes in total, down from eleven.</desc>
<circle cx="160" cy="15" r="4" class="d-fill-stroke"/>
<line x1="160" y1="15" x2="70" y2="60" class="d-line"/>
<line x1="160" y1="15" x2="250" y2="60" class="d-line"/>
<line x1="70" y1="60" x2="70" y2="140" class="d-line"/>
<line x1="70" y1="140" x2="70" y2="220" class="d-line"/>
<line x1="250" y1="60" x2="250" y2="140" class="d-line"/>
<text x="100" y="35" text-anchor="middle" class="d-mono d-small">car</text>
<text x="220" y="35" text-anchor="middle" class="d-mono d-small">do</text>
<text x="58" y="104" text-anchor="end" class="d-mono d-small">e</text>
<text x="58" y="184" text-anchor="end" class="d-mono d-small">ful</text>
<text x="238" y="104" text-anchor="end" class="d-mono d-small">t</text>
<circle cx="70" cy="60" r="11" class="d-box-accent"/>
<text x="88" y="64" class="d-mono d-bold d-small">car</text>
<circle cx="70" cy="140" r="11" class="d-box-accent"/>
<text x="88" y="144" class="d-mono d-bold d-small">care</text>
<circle cx="70" cy="220" r="11" class="d-box-accent"/>
<text x="88" y="224" class="d-mono d-bold d-small">careful</text>
<circle cx="250" cy="60" r="11" class="d-box-accent"/>
<text x="268" y="64" class="d-mono d-bold d-small">do</text>
<circle cx="250" cy="140" r="11" class="d-box-accent"/>
<text x="268" y="144" class="d-mono d-bold d-small">dot</text>
<text x="20" y="255" class="d-small d-muted">Edge labels hold whole substrings:</text>
<text x="20" y="269" class="d-small d-muted">six nodes instead of eleven.</text>
</svg>
<figcaption>Figure 2. The compressed version of Figure 1. The single-character chain c-a has merged into the edge "car", and f-u-l has merged into "ful"; only nodes that branch or end a word survive as separate nodes.</figcaption>
</figure>

This is not a hypothetical optimization invented for this article — it is how production tries are actually built when memory matters. The Linux kernel's IPv4 routing table is implemented as a trie over the bits of an IP address, and its own documentation describes precisely this kind of compression: a node's position in the key "will not be immediately adjacent to the parent," because "there will be some bits in the key skipped over" whenever they "represent a single path with no deviations" — the kernel's [LC-trie implementation notes](https://docs.kernel.org/networking/fib_trie.html) describe skipping exactly the runs of the key that a naive trie would have spent one node per bit on.

The saving is real, but it is not free: a radix tree's `Insert` is more code than the one on this page, because inserting a new word can require *splitting* an existing edge (if the new word diverges partway through a compressed substring) as well as extending one, and a full implementation has to handle both. That is genuinely more implementation complexity than the plain trie above, which is why this article measures the plain, uncompressed trie against the sorted array next — the compressed version narrows the memory gap, as the "extreme sharing" exercise already hinted, but does not eliminate the deeper issue the next section measures: per-node overhead competing against an array that pays almost none.

## The alternative done properly: a sorted array and binary search

The naive linear scan from the second section is not the strongest competitor a trie has. A sorted array with binary search is: sort the words once, then use binary search to find where a given prefix *would* sit, and scan forward only as far as the matches continue. Microsoft's own [`SortedList<TKey,TValue>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.sortedlist-2) is this idea already built into the BCL — its documentation states it "is implemented as an array of key/value pairs" with "O(log `n`) retrieval," and recommends it over the red-black-tree-backed `SortedDictionary<TKey,TValue>` from the binary-search-tree article specifically because "`SortedList<TKey,TValue>` uses less memory."

[`Array.BinarySearch`](https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch) is "an O(log `n`) operation," but its return value is not quite what a prefix search needs on its own: its own documentation warns that "if the `Array` contains more than one element equal to `value`, the method returns the index of only one of the occurrences, and not necessarily the first one" — for finding the *start* of a run of matches, that ambiguity is disqualifying, so `PrefixSearch` below runs its own lower-bound binary search (find the leftmost index whose entry is not less than the prefix) instead of calling `Array.BinarySearch` directly:

```csharp run id=sorted-prefix
string[] words = ["car", "care", "careful", "do", "dot"];
string[] sorted = (string[])words.Clone();
Array.Sort(sorted, StringComparer.Ordinal);

Console.WriteLine($"sorted: {string.Join(", ", sorted)}");
Console.WriteLine(
    $"prefix \"ca\": {string.Join(", ", PrefixSearch(sorted, "ca"))}");
Console.WriteLine(
    $"prefix \"do\": {string.Join(", ", PrefixSearch(sorted, "do"))}");

static IEnumerable<string> PrefixSearch(string[] sorted, string prefix)
{
    int lo = 0, hi = sorted.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (string.CompareOrdinal(sorted[mid], prefix) < 0) lo = mid + 1;
        else hi = mid;
    }
    for (int i = lo; i < sorted.Length && sorted[i].StartsWith(prefix, StringComparison.Ordinal); i++)
        yield return sorted[i];
}
```

```text output
sorted: car, care, careful, do, dot
prefix "ca": car, care, careful
prefix "do": do, dot
```

Every word that matches a prefix sorts next to every other word that matches it — that is what "sorted" means — so once the binary search finds the first one, a linear scan forward collects the rest and stops the moment a word no longer matches. The search to find the start costs O(log *n*); the scan afterward costs O(*m*), where *m* is the number of matches, the same output-proportional cost the trie's own traversal pays once it reaches the prefix's node.

## Measuring both, from 500 words to 200,000

Both structures have a plausible claim to being the right one: the trie's per-query cost does not grow with *n*, only with the query length, while the array's binary search adds a few more comparisons every time *n* multiplies. Asymptotically, the trie should eventually win. The question this section answers is at what size that happens — the benchmark builds both structures from the same synthetic word list at four sizes, and times the same batch of prefix queries against each, counting matches rather than materializing them (the trie's `StartsWith` rebuilds each matching string by concatenation, which the array's version never has to do, since it already holds the whole string; counting isolates the structural traversal cost from that unrelated difference).

<details>
<summary>Full benchmark program</summary>

```csharp run id=trie-vs-array-benchmark
using System.Diagnostics;

var rng = new Random(42);
string RandomWord()
{
    int len = rng.Next(4, 11);
    Span<char> buf = stackalloc char[len];
    for (int i = 0; i < len; i++) buf[i] = (char)('a' + rng.Next(26));
    return new string(buf);
}

// Warm up JIT and static-init costs before the first measured size.
string[] warmupWords = ["alpha", "beta", "gamma"];
var warmupSorted = (string[])warmupWords.Clone();
Array.Sort(warmupSorted, StringComparer.Ordinal);
var warmupTrie = new Trie();
foreach (string w in warmupWords) warmupTrie.Insert(w);
foreach (string w in warmupWords)
{
    warmupTrie.CountWithPrefix(w[..2]);
    CountWithPrefixSorted(warmupSorted, w[..2]);
}

int[] sizes = [500, 5_000, 50_000, 200_000];
var results = new List<(int N, double ArrayMB, double TrieMB, double ArrayUs, double TrieUs)>();
foreach (int n in sizes)
{
    var words = new HashSet<string>();
    while (words.Count < n) words.Add(RandomWord());
    string[] wordArray = [.. words];

    long beforeArray = GC.GetAllocatedBytesForCurrentThread();
    string[] sorted = (string[])wordArray.Clone();
    Array.Sort(sorted, StringComparer.Ordinal);
    long arrayBytes = GC.GetAllocatedBytesForCurrentThread() - beforeArray;

    long beforeTrie = GC.GetAllocatedBytesForCurrentThread();
    var trie = new Trie();
    foreach (string w in wordArray) trie.Insert(w);
    long trieBytes = GC.GetAllocatedBytesForCurrentThread() - beforeTrie;

    // Prefixes of varying length, each sampled from a real word in the set
    // so every query has at least one match.
    var prefixes = new List<string>();
    var prng = new Random(7);
    for (int i = 0; i < 3000; i++)
    {
        string w = wordArray[prng.Next(wordArray.Length)];
        int plen = prng.Next(2, w.Length + 1);
        prefixes.Add(w[..plen]);
    }

    // Warm up this size's code paths once before timing them.
    foreach (string p in prefixes) { trie.CountWithPrefix(p); CountWithPrefixSorted(sorted, p); }

    const int reps = 5;
    var sw = Stopwatch.StartNew();
    long checkTrie = 0;
    for (int r = 0; r < reps; r++)
        foreach (string p in prefixes) checkTrie += trie.CountWithPrefix(p);
    sw.Stop();
    double trieUsPerQuery = sw.Elapsed.TotalMicroseconds / (reps * prefixes.Count);

    sw.Restart();
    long checkArray = 0;
    for (int r = 0; r < reps; r++)
        foreach (string p in prefixes) checkArray += CountWithPrefixSorted(sorted, p);
    sw.Stop();
    double arrayUsPerQuery = sw.Elapsed.TotalMicroseconds / (reps * prefixes.Count);

    if (checkTrie != checkArray)
        throw new InvalidOperationException("trie and array disagree on match counts");

    results.Add((n, arrayBytes / 1024.0 / 1024.0, trieBytes / 1024.0 / 1024.0,
        arrayUsPerQuery, trieUsPerQuery));
}

Console.WriteLine($"{"n",7} {"array MB",9} {"trie MB",9}");
foreach (var r in results)
    Console.WriteLine($"{r.N,7} {r.ArrayMB,9:F2} {r.TrieMB,9:F2}");

Console.WriteLine();
Console.WriteLine($"{"n",7} {"array us",9} {"trie us",9}");
foreach (var r in results)
    Console.WriteLine($"{r.N,7} {r.ArrayUs,9:F2} {r.TrieUs,9:F2}");

static int CountWithPrefixSorted(string[] sorted, string prefix)
{
    int lo = 0, hi = sorted.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (string.CompareOrdinal(sorted[mid], prefix) < 0) lo = mid + 1;
        else hi = mid;
    }
    int count = 0;
    for (int i = lo; i < sorted.Length && sorted[i].StartsWith(prefix, StringComparison.Ordinal); i++)
        count++;
    return count;
}

sealed class TrieNode
{
    public Dictionary<char, TrieNode>? Children;
    public bool IsWord;
}

sealed class Trie
{
    private readonly TrieNode _root = new();

    public void Insert(string word)
    {
        TrieNode node = _root;
        foreach (char c in word)
        {
            node.Children ??= new Dictionary<char, TrieNode>();
            if (!node.Children.TryGetValue(c, out TrieNode? next))
            {
                next = new TrieNode();
                node.Children[c] = next;
            }
            node = next;
        }
        node.IsWord = true;
    }

    public int CountWithPrefix(string prefix)
    {
        TrieNode? start = Walk(prefix);
        return start is null ? 0 : Count(start);
    }

    private TrieNode? Walk(string s)
    {
        TrieNode node = _root;
        foreach (char c in s)
        {
            if (node.Children is null || !node.Children.TryGetValue(c, out TrieNode? next))
                return null;
            node = next;
        }
        return node;
    }

    private static int Count(TrieNode node)
    {
        int total = node.IsWord ? 1 : 0;
        if (node.Children is not null)
            foreach (TrieNode child in node.Children.Values)
                total += Count(child);
        return total;
    }
}
```

</details>

```text output
      n  array MB   trie MB
    500 [...] [...]
   5000 [...] [...]
  50000 [...] [...]
 200000 [...] [...]

      n  array us   trie us
    500 [...] [...]
   5000 [...] [...]
  50000 [...] [...]
 200000 [...] [...]
```

One run on this machine (same toolchain as above) printed:

```text
      n  array MB   trie MB
    500      0.00      0.59
   5000      0.04      5.19
  50000      0.38     43.19
 200000      1.53    158.00

      n  array us   trie us
    500      0.15      0.39
   5000      0.23      1.30
  50000      1.42      8.95
 200000      3.68     26.60
```

At every size tested, the sorted array used less memory *and* answered each query faster than the trie — and the gap does not close as *n* grows to 200,000; if anything the trie falls further behind in absolute terms, even though the checksums confirm both structures agreed on every match. Looking for a crossover assumes one exists in this range. It does not, and the reason is the same one the memory section already exposed: `Array.BinarySearch`'s O(log *n*) and the trie's O(*L*) are both real bounds, but they describe the number of *steps*, not the cost of a step. A binary search step is one call to `string.CompareOrdinal`, which the runtime's own [`SpanHelpers.SequenceCompareTo`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/SpanHelpers.Char.cs) it delegates to compares in `Vector<ushort>`-sized chunks at once when `Vector.IsHardwareAccelerated`, rather than one `char` at a time — a tight walk over contiguous memory. A trie step is a `Dictionary<char, TrieNode>` lookup — hash the character, find the bucket, chase a pointer to a `TrieNode` that could be anywhere on the managed heap. Even though log₂(200,000) ≈ 18 is a larger number of steps than most of these prefixes' lengths, each of the array's steps is cheap enough, and each of the trie's is expensive enough, that the array wins on time as well as on memory. This is exactly why the compressed trie from the previous section matters in practice: collapsing runs of single-child nodes into one edge does not just save memory, it also replaces several pointer-chasing dictionary lookups with fewer, larger string comparisons — closer to what the array is already doing.

None of this means a trie is never the right call. The benchmark above times *independent* queries, each starting from the root. A real autocomplete box does not do that: it extends the same prefix by one character on almost every keystroke, and a trie can keep a cursor at the node reached by the previous keystroke, turning each new character into a single dictionary lookup instead of a fresh walk from the root. A sorted array can approximate the same trick by keeping last query's `[lo, hi)` range and narrowing it further rather than re-searching the whole array, but that is extra bookkeeping the plain version above does not do. A trie also stays useful past plain prefix search — supporting wildcard or edit-distance-tolerant lookups by walking multiple branches at once is natural on a trie and awkward to bolt onto a flat sorted array.

## Picking one for a real autocomplete box

For a set that is built once (or rarely) and queried by prefix, a sorted array with binary search is the structure to reach for first: it is less code, and on this machine, at every size tested, it used less memory and answered faster than the trie built here. Reach for a trie — the compressed kind, not the object-per-character version this article built for clarity — when the workload narrows a prefix one keystroke at a time and can keep state between keystrokes, when the query is more than a plain prefix match (wildcards, edit-distance tolerance, "any of these characters here"), or when the alphabet is small enough and the sharing heavy enough that a radix-compressed encoding gets close to the array's memory footprint while keeping the trie's per-keystroke advantage. Absent one of those reasons, the measurement above is the honest default: try the sorted array first, and only reach for the trie once a specific requirement — not a Big-O table alone — says the array will not do.
