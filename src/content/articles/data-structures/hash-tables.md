---
title: "Hash Tables: How Dictionary<TKey,TValue> Finds Things in O(1)"
description: "Build a chained HashMap from scratch, see .NET's real Dictionary layout of buckets and entries arrays, and break a key by mutating it after insertion."
pillar: data-structures
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [hash-table, dictionary, hashing, gethashcode, collisions]
prerequisites: ["data-structures/arrays-and-dynamic-arrays"]
sources:
  - title: "Dictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dictionary<TKey,TValue>.Capacity Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2.capacity"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Object.GetHashCode Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.object.gethashcode"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "String.GetHashCode Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "HashCode.Combine<T1,T2> Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.hashcode.combine"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dictionary.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/Dictionary.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "Marvin.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Marvin.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "NonRandomizedStringEqualityComparer.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/NonRandomizedStringEqualityComparer.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 11 (Hash Tables)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
draft: false
---

Look up `"carol"` in a `Dictionary<string,int>` holding four entries or four million, and .NET does roughly the same amount of work either way: turn the string into a number, jump to about that position in an array, compare a handful of candidates. That jump is what a [hash table](/glossary/#hash-table) adds on top of the [array](/glossary/#array) indexing from earlier in this pillar — index arithmetic for keys that are not already small integers.

## Direct addressing: when the key is already an index

If every possible key is a small non-negative integer, an array already is a hash table: store the value for key `k` at slot `k`. This is called direct addressing, and it needs no hashing at all.

```csharp run id=direct
string word = "mississippi";
int[] counts = new int[26]; // direct-address table: one slot per letter

foreach (char c in word)
    counts[c - 'a']++;

for (int letter = 0; letter < 26; letter++)
    if (counts[letter] > 0)
        Console.WriteLine(
            $"{(char)('a' + letter)}: {counts[letter]}");
```

```text output
i: 4
m: 1
p: 2
s: 4
```

`c - 'a'` maps each of the 26 letters to a distinct slot, so lookup, insert and update are all one array access: O(1) worst case, exactly like indexing an array. Direct addressing breaks the moment the key space stops being small and dense. A table keyed by `int` would need 4 billion slots to hold one entry for `-2147483648`. A table keyed by `string` cannot be indexed by an array at all — `"carol"` is not a number. A [hash function](/glossary/#hash-function) is what bridges the gap: it turns any key into a small integer, so the same one-array-access idea still applies, approximately.

## Turning a key into an index: hash functions

A hash function `h` maps a key to an integer; a compression step then reduces that integer to a valid array index with `h(key) % tableSize`. Every object in C# already carries a hash function — `object.GetHashCode()` — so building the index takes one line: `(uint)key.GetHashCode() % (uint)bucketCount`. The cast to `uint` matters, because `GetHashCode()` can return a negative `int`, and a negative left-hand side of `%` in C# produces a negative (or zero) result, not a valid array index.

Because the codomain of a hash function (usually 2³² values) is far larger than any real table, different keys are bound to land on the same index sometimes — a collision. With `m` buckets and just `m + 1` keys, at least two must collide by the pigeonhole principle, regardless of how good the hash function is:

```csharp run id=compress
string[] fruits = ["apple", "banana", "cherry", "date", "fig"];
const int m = 4; // table size, smaller than the key count

var buckets = fruits.Select(f =>
    (int)((uint)f.GetHashCode() % m)).ToArray();

for (int i = 0; i < fruits.Length; i++)
    Console.WriteLine($"{fruits[i],-8} -> bucket {buckets[i]}");

int unique = buckets.Distinct().Count();
Console.WriteLine($"{fruits.Length} keys, {m} buckets, " +
    $"{unique} of them actually used");
Console.WriteLine(
    $"a collision is unavoidable: {unique < fruits.Length}");
```

```text output
apple    -> bucket [...]
banana   -> bucket [...]
cherry   -> bucket [...]
date     -> bucket [...]
fig      -> bucket [...]
5 keys, 4 buckets, [...] of them actually used
a collision is unavoidable: True
```

The last line is exact and always `True` — five keys cannot occupy four buckets without sharing one. The bucket numbers above it are wildcarded on purpose: `string.GetHashCode()` is randomized per process (the [worst case](#worst-case-when-every-key-lands-in-one-bucket) section explains why and cites the source), so running this program again on the same machine reassigns every bucket. A real hash table has to work correctly no matter which bucket a collision lands in, which is the next problem.

## Collisions: chaining or open addressing

[CLRS](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/), chapter 11, names two standard strategies. **Chaining** keeps a linked list of every key that hashes to a bucket; a lookup hashes to the bucket, then scans its list. **Open addressing** stores every key directly inside the table array; on a collision it probes a sequence of other slots (linear, quadratic, or a second hash function) until it finds the key or an empty slot.

<figure class="diagram">
<svg viewBox="0 0 360 356" role="img" aria-labelledby="collide-title collide-desc">
<title id="collide-title">Two ways to resolve a collision: chaining links a second key onto the same bucket; open addressing moves it to another slot</title>
<desc id="collide-desc">Top: a four-slot bucket array where slot 1 points to a two-node list, K1 then K5. Bottom: a four-slot array where K1 sits in slot 1 and K5, unable to use slot 1, has been placed in slot 2 instead.</desc>
<defs>
<marker id="collide-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Chaining: bucket 1 keeps a list</text>
<rect x="20" y="30" width="48" height="34" class="d-box"/>
<rect x="76" y="30" width="48" height="34" class="d-box-accent"/>
<rect x="132" y="30" width="48" height="34" class="d-box"/>
<rect x="188" y="30" width="48" height="34" class="d-box"/>
<text x="44" y="80" text-anchor="middle" class="d-mono d-small">[0]</text>
<text x="100" y="80" text-anchor="middle" class="d-mono d-small d-text-accent">[1]</text>
<text x="156" y="80" text-anchor="middle" class="d-mono d-small">[2]</text>
<text x="212" y="80" text-anchor="middle" class="d-mono d-small">[3]</text>
<path d="M100 64 V96" class="d-accent" marker-end="url(#collide-arrow)"/>
<rect x="70" y="100" width="46" height="34" class="d-box"/>
<text x="93" y="121" text-anchor="middle" class="d-mono">K1</text>
<path d="M116 117 H130" class="d-line" marker-end="url(#collide-arrow)"/>
<rect x="132" y="100" width="46" height="34" class="d-box"/>
<text x="155" y="121" text-anchor="middle" class="d-mono">K5</text>
<path d="M178 117 H206" class="d-line" marker-end="url(#collide-arrow)"/>
<text x="212" y="121" class="d-muted">null</text>
<text x="20" y="160" class="d-small d-muted">One head pointer per bucket; a new</text>
<text x="20" y="176" class="d-small d-muted">key is linked in at the front.</text>
<text x="20" y="212" class="d-bold">Open addressing: K5 probes past slot 1</text>
<rect x="20" y="222" width="48" height="34" class="d-box-2 d-dashed"/>
<rect x="76" y="222" width="48" height="34" class="d-box"/>
<rect x="132" y="222" width="48" height="34" class="d-box-accent"/>
<rect x="188" y="222" width="48" height="34" class="d-box-2 d-dashed"/>
<text x="100" y="244" text-anchor="middle" class="d-mono">K1</text>
<text x="156" y="244" text-anchor="middle" class="d-mono d-bold">K5</text>
<path d="M100 268 H142" class="d-accent" marker-end="url(#collide-arrow)"/>
<text x="20" y="296" class="d-small d-text-accent">K5 hashes to slot 1 (taken), so</text>
<text x="20" y="312" class="d-small d-text-accent">linear probing tries slot 2.</text>
<text x="20" y="338" class="d-small d-muted">Open addressing keeps keys in the</text>
<text x="20" y="354" class="d-small d-muted">array itself; chaining uses a list.</text>
</svg>
<figcaption>Figure 1. Chaining puts a linked list behind each bucket; open addressing keeps every key inside the array and relocates it on collision.</figcaption>
</figure>

Both give expected O(1) operations when the table is not too full, but they fail differently. A chained table degrades gracefully — the worst it does is walk a long list. An open-addressed table can fail outright once it is full, and its probe sequences get slower to search as the table fills, because a probe has to skip over every other key's leftover trail. Chaining is also simpler to get right for deletion, which is why the table built below uses it, and — as the next section shows from the real source — why .NET's own `Dictionary<TKey,TValue>` does too.

### Building `HashMap<K,V>`: real chaining, not pseudocode

`HashMap<TKey,TValue>` below is a complete chained hash table: an array of bucket heads, each a singly linked list of `Node`s. `Set` walks the target bucket looking for an existing key to overwrite before linking a new node at the front; `TryGet` does the same walk without writing. When the table gets more than three-quarters full it doubles and relinks every node — the load-factor section below measures exactly what that buys.

```csharp run id=hashmap
var ages = new HashMap<string, int>();
ages.Set("alice", 30);
ages.Set("bob", 25);
ages.Set("carol", 41);
ages.Set("dave", 19);

Console.WriteLine(
    $"alice -> {(ages.TryGet("alice", out int a) ? a : -1)}");
ages.Set("alice", 31); // same key: updates, not duplicated
Console.WriteLine(
    $"alice -> {(ages.TryGet("alice", out a) ? a : -1)}");
Console.WriteLine(
    $"eve found: {ages.TryGet("eve", out _)}");
Console.WriteLine(
    $"Count {ages.Count}, buckets {ages.BucketCount}");

sealed class HashMap<TKey, TValue> where TKey : notnull
{
    private sealed class Node(TKey key, TValue value, Node? next)
    {
        public TKey Key { get; } = key;
        public TValue Value { get; set; } = value;
        public Node? Next { get; set; } = next;
    }

    private Node?[] _buckets = new Node?[8];
    private int _count;

    public int Count => _count;
    public int BucketCount => _buckets.Length;

    public void Set(TKey key, TValue value)
    {
        int index = IndexOf(key, _buckets.Length);
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { n.Value = value; return; }
        }
        _buckets[index] = new Node(key, value, _buckets[index]);
        if (++_count > _buckets.Length * 0.75) Grow();
    }

    public bool TryGet(TKey key, out TValue value)
    {
        for (Node? n = _buckets[IndexOf(key, _buckets.Length)];
             n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { value = n.Value; return true; }
        }
        value = default!;
        return false;
    }

    private static int IndexOf(TKey key, int bucketCount) =>
        (int)((uint)key.GetHashCode() % (uint)bucketCount);

    private void Grow()
    {
        var bigger = new Node?[_buckets.Length * 2];
        foreach (Node? head in _buckets)
        {
            Node? n = head;
            while (n is not null)
            {
                Node? next = n.Next;
                int index = IndexOf(n.Key, bigger.Length);
                n.Next = bigger[index];
                bigger[index] = n;
                n = next;
            }
        }
        _buckets = bigger;
    }
}
```

```text output
alice -> 30
alice -> 31
eve found: False
Count 4, buckets 8
```

`n.Key.Equals(key)`, not `==`, is what actually decides two keys are "the same" — the [contract section](#the-contract-behind-gethashcode-and-equals) below is about exactly this line, and what goes wrong when it disagrees with `GetHashCode`.

::::exercise[Extend HashMap with Remove]
Add a `Remove(TKey key)` method to `HashMap<TKey,TValue>` above. It has to unlink the matching node from its bucket's singly linked list — including the case where the match is the first node in the chain — decrement `Count`, and return `false` rather than throw when the key is not present.

:::solution
Track the previous node while walking the chain. If there is no previous node, the match was the head, so the bucket itself is repointed at `n.Next`; otherwise the previous node's `Next` is repointed, skipping over `n`.

```csharp run id=ex-remove
var inventory = new HashMap<string, int>();
inventory.Set("bolts", 120);
inventory.Set("nuts", 80);
inventory.Set("washers", 300);

Console.WriteLine(
    $"removed bolts: {inventory.Remove("bolts")}");
Console.WriteLine(
    $"removed bolts again: {inventory.Remove("bolts")}");
Console.WriteLine(
    $"nuts found: {inventory.TryGet("nuts", out var n)} {n}");
Console.WriteLine($"Count: {inventory.Count}");

sealed class HashMap<TKey, TValue> where TKey : notnull
{
    private sealed class Node(TKey key, TValue value, Node? next)
    {
        public TKey Key { get; } = key;
        public TValue Value { get; set; } = value;
        public Node? Next { get; set; } = next;
    }

    private Node?[] _buckets = new Node?[8];
    private int _count;

    public int Count => _count;
    public int BucketCount => _buckets.Length;

    public void Set(TKey key, TValue value)
    {
        int index = IndexOf(key, _buckets.Length);
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { n.Value = value; return; }
        }
        _buckets[index] = new Node(key, value, _buckets[index]);
        if (++_count > _buckets.Length * 0.75) Grow();
    }

    public bool TryGet(TKey key, out TValue value)
    {
        for (Node? n = _buckets[IndexOf(key, _buckets.Length)];
             n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { value = n.Value; return true; }
        }
        value = default!;
        return false;
    }

    public bool Remove(TKey key)
    {
        int index = IndexOf(key, _buckets.Length);
        Node? prev = null;
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            if (n.Key.Equals(key))
            {
                if (prev is null) _buckets[index] = n.Next;
                else prev.Next = n.Next;
                _count--;
                return true;
            }
            prev = n;
        }
        return false;
    }

    private static int IndexOf(TKey key, int bucketCount) =>
        (int)((uint)key.GetHashCode() % (uint)bucketCount);

    private void Grow()
    {
        var bigger = new Node?[_buckets.Length * 2];
        foreach (Node? head in _buckets)
        {
            Node? n = head;
            while (n is not null)
            {
                Node? next = n.Next;
                int index = IndexOf(n.Key, bigger.Length);
                n.Next = bigger[index];
                bigger[index] = n;
                n = next;
            }
        }
        _buckets = bigger;
    }
}
```

```text output
removed bolts: True
removed bolts again: False
nuts found: True 80
Count: 2
```
:::
::::

## Load factor and resize: how full is too full

CLRS defines load factor as α = n / m: the number of stored keys divided by the number of buckets. Under the simplifying assumption that hashing spreads keys uniformly (CLRS, chapter 11), the expected length of any one chain is α — so keeping α bounded, by growing the bucket array as keys are added, is what keeps chained lookups at expected O(1) instead of drifting toward O(n).

Numbers below are from one machine: .NET 10.0.12 on Windows 11 (build 22631), 16 logical processors. The shape of the result — not the exact digits — is what carries to another machine.

`HashMap<TKey,TValue>` above grows at α > 0.75. To see why that matters, compare it against a variant that never grows past its starting 8 buckets:

```csharp run id=load-factor
var grown = new HashMap<string, int>();
var flat = new HashMap<string, int>(8, double.PositiveInfinity);

const int N = 10_000;
for (int i = 0; i < N; i++)
{
    grown.Set("k" + i, i);
    flat.Set("k" + i, i);
}

Console.WriteLine(
    $"grown: buckets {grown.BucketCount}, " +
    $"avg chain {AverageChain(grown):F2}, " +
    $"max chain {MaxChain(grown)}");
Console.WriteLine(
    $"flat:  buckets {flat.BucketCount}, " +
    $"avg chain {AverageChain(flat):F2}, " +
    $"max chain {MaxChain(flat)}");

static double AverageChain<K, V>(HashMap<K, V> map)
    where K : notnull
{
    long total = 0;
    for (int b = 0; b < map.BucketCount; b++)
        total += map.ChainLength(b);
    return (double)total / map.BucketCount;
}

static int MaxChain<K, V>(HashMap<K, V> map) where K : notnull
{
    int max = 0;
    for (int b = 0; b < map.BucketCount; b++)
        max = Math.Max(max, map.ChainLength(b));
    return max;
}

sealed class HashMap<TKey, TValue> where TKey : notnull
{
    private sealed class Node(TKey key, TValue value, Node? next)
    {
        public TKey Key { get; } = key;
        public TValue Value { get; set; } = value;
        public Node? Next { get; set; } = next;
    }

    private readonly double _maxLoad;
    private Node?[] _buckets;
    private int _count;

    public HashMap(int initialBuckets = 8, double maxLoad = 0.75)
    {
        _buckets = new Node?[initialBuckets];
        _maxLoad = maxLoad;
    }

    public int Count => _count;
    public int BucketCount => _buckets.Length;

    public void Set(TKey key, TValue value)
    {
        int index = IndexOf(key, _buckets.Length);
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { n.Value = value; return; }
        }
        _buckets[index] = new Node(key, value, _buckets[index]);
        if (++_count > _buckets.Length * _maxLoad) Grow();
    }

    public int ChainLength(int bucket)
    {
        int n = 0;
        for (Node? node = _buckets[bucket];
             node is not null; node = node.Next) n++;
        return n;
    }

    private static int IndexOf(TKey key, int bucketCount) =>
        (int)((uint)key.GetHashCode() % (uint)bucketCount);

    private void Grow()
    {
        var bigger = new Node?[_buckets.Length * 2];
        foreach (Node? head in _buckets)
        {
            Node? n = head;
            while (n is not null)
            {
                Node? next = n.Next;
                int index = IndexOf(n.Key, bigger.Length);
                n.Next = bigger[index];
                bigger[index] = n;
                n = next;
            }
        }
        _buckets = bigger;
    }
}
```

```text output
grown: buckets 16384, avg chain 0.61, max chain [...]
flat:  buckets 8, avg chain 1250.00, max chain [...]
```

`grown`'s bucket count and average chain length are exact — doubling from 8 only happens on a fixed count schedule, so after 10,000 inserts the table always lands at 16,384 buckets regardless of which keys were inserted, for an average chain of 10000 / 16384 ≈ 0.61. `flat` never resizes, so its average chain is exactly 10000 / 8 = 1250.00. Only the *max* chain is wildcarded: it depends on how this run's (randomized, see below) string hashes happened to cluster, but it stays small for `grown` and sits close to the average for `flat`, because with 1,250 keys forced into 8 buckets there is nowhere for them to spread out.

::::exercise[Prove the resize cost is amortized]
`Grow` relinks every node currently in the table, every time it runs. If capacity only ever doubles, argue — the way the [amortized analysis of `List<T>.Add`](/complexity/amortized-analysis/) argues for copying — that the total number of relinks over `N` insertions is O(`N`), not O(`N`²). Then instrument `Grow` to count relinks for real and check the bound.

:::solution
Each element is relinked once per resize it survives. An element inserted right after resize *k* survives at most a constant number of further doublings before the run ends, and the total work across all resizes is a geometric series dominated by the last (largest) resize, exactly like the copy cost in the `List<T>` argument. Summed over `N` inserts, that is O(`N`) total, O(1) amortized per insert.

```csharp run id=ex-amortized
var map = new HashMap<int, int>();
const int N = 100_000;
for (int i = 0; i < N; i++) map.Set(i, i);

Console.WriteLine(
    $"N {N}, resizes {map.Resizes}, " +
    $"relinks {map.TotalRelinks}");
Console.WriteLine(
    $"relinks per insert: " +
    $"{(double)map.TotalRelinks / N:F2}");

sealed class HashMap<TKey, TValue> where TKey : notnull
{
    private sealed class Node(TKey key, TValue value, Node? next)
    {
        public TKey Key { get; } = key;
        public TValue Value { get; set; } = value;
        public Node? Next { get; set; } = next;
    }

    private Node?[] _buckets = new Node?[8];
    private int _count;

    public int Resizes { get; private set; }
    public long TotalRelinks { get; private set; }

    public void Set(TKey key, TValue value)
    {
        int index = IndexOf(key, _buckets.Length);
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { n.Value = value; return; }
        }
        _buckets[index] = new Node(key, value, _buckets[index]);
        if (++_count > _buckets.Length * 0.75) Grow();
    }

    private static int IndexOf(TKey key, int bucketCount) =>
        (int)((uint)key.GetHashCode() % (uint)bucketCount);

    private void Grow()
    {
        Resizes++;
        var bigger = new Node?[_buckets.Length * 2];
        foreach (Node? head in _buckets)
        {
            Node? n = head;
            while (n is not null)
            {
                Node? next = n.Next;
                int index = IndexOf(n.Key, bigger.Length);
                n.Next = bigger[index];
                bigger[index] = n;
                n = next;
                TotalRelinks++;
            }
        }
        _buckets = bigger;
    }
}
```

```text output
N 100000, resizes 15, relinks 196617
relinks per insert: 1.97
```

Both numbers are exact: relinks depend only on how many nodes existed at each resize, never on where the hash function sent them. Just under 2 relinks per insert, and that ratio would keep shrinking toward 1 as `N` grows further — the signature of amortized O(1), not the O(`N`) per insert a naive "add one bucket at a time" policy would produce.
:::
::::

## Inside `Dictionary<TKey,TValue>`: the buckets array and the entries array

`HashMap<TKey,TValue>` above chains with heap-allocated `Node` objects — one small object per key, linked by references. .NET's real [`Dictionary<TKey,TValue>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2), confirmed from [`Dictionary.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/Dictionary.cs) in the dotnet/runtime source, chains without allocating a single node. Its state is two parallel arrays:

```text
private int[]? _buckets;
private Entry[]? _entries;

private struct Entry
{
    public uint hashCode;
    public int next;  // index of next entry in the chain; -1 = end
    public TKey key;
    public TValue value;
}
```

`_buckets[i]` holds a **1-based** index into `_entries` — 0 means "empty" — and each `Entry.next` holds a **0-based** index of the next entry in the same chain, or -1 at the end. A chain is a linked list threaded through array slots by index, instead of through separate objects by reference: the same idea as `HashMap<TKey,TValue>.Node.Next`, but the "pointers" are integers into one contiguous array.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="buckets-title buckets-desc">
<title id="buckets-title">buckets[2] holds 2, a 1-based pointer to entries[1], which chains back to entries[0]</title>
<desc id="buckets-desc">A four-cell buckets array with 0, 0, 2 and 0. Bucket 2 points down to a highlighted row for entries[1], holding next=0, key="a", value=10. Below it, a plain row for entries[0], holding next=-1, key="b", value=20, which entries[1]'s next field points at.</desc>
<defs>
<marker id="buckets-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">buckets[]: 1-based indices into entries[]</text>
<rect x="20" y="30" width="48" height="34" class="d-box-2 d-dashed"/>
<rect x="76" y="30" width="48" height="34" class="d-box-2 d-dashed"/>
<rect x="132" y="30" width="48" height="34" class="d-box-accent"/>
<rect x="188" y="30" width="48" height="34" class="d-box-2 d-dashed"/>
<text x="44" y="52" text-anchor="middle" class="d-mono">0</text>
<text x="100" y="52" text-anchor="middle" class="d-mono">0</text>
<text x="156" y="52" text-anchor="middle" class="d-mono d-bold">2</text>
<text x="212" y="52" text-anchor="middle" class="d-mono">0</text>
<text x="44" y="80" text-anchor="middle" class="d-mono d-small d-muted">[0]</text>
<text x="100" y="80" text-anchor="middle" class="d-mono d-small d-muted">[1]</text>
<text x="156" y="80" text-anchor="middle" class="d-mono d-small d-text-accent">[2]</text>
<text x="212" y="80" text-anchor="middle" class="d-mono d-small d-muted">[3]</text>
<path d="M156 64 V96" class="d-accent" marker-end="url(#buckets-arrow)"/>
<rect x="20" y="100" width="290" height="34" class="d-box-accent"/>
<text x="30" y="122" class="d-mono d-small">entries[1] next=0 key="a" val=10</text>
<rect x="20" y="150" width="290" height="34" class="d-box"/>
<text x="30" y="172" class="d-mono d-small">entries[0] next=-1 key="b" val=20</text>
<path d="M105 134 V146" class="d-line" marker-end="url(#buckets-arrow)"/>
<text x="20" y="204" class="d-small d-muted">bucket[2] = 2, so the chain starts at</text>
<text x="20" y="220" class="d-small d-muted">entries[1] (index 2 minus 1).</text>
<text x="20" y="244" class="d-small d-muted">entries[1].next = 0, so the chain</text>
<text x="20" y="260" class="d-small d-muted">continues at entries[0].</text>
<text x="20" y="284" class="d-small d-muted">entries[0].next = -1: end of chain.</text>
</svg>
<figcaption>Figure 2. Two parallel arrays: buckets[] points at the head of each chain, and entries[].next threads the rest of the chain through array indices instead of object references.</figcaption>
</figure>

`b` was inserted first (`entries[0]`, `next = -1`), then `a` collided into the same bucket. Insertion in `Dictionary<TKey,TValue>` links new entries at the head of the chain — the same LIFO order `HashMap<TKey,TValue>.Set` uses — so `a` became `entries[1]` with `next` pointing back at `entries[0]`, and `bucket[2]` was updated to point at `entries[1]`. `FindValue` (called by the indexer, `TryGetValue` and `ContainsKey`) hashes the key, reads `_buckets` for the head, then walks `next` comparing `hashCode` and the key at each step — structurally the same loop as `HashMap<TKey,TValue>.TryGet`, just walking array indices instead of following `Node` references, which keeps the whole chain inside one allocation instead of scattering it across the heap.

Resizing in `Dictionary.cs` triggers when `count == entries.Length` — an effective load factor of 1.0 for the entries array, looser than the 0.75 this article's `HashMap<TKey,TValue>` uses — and the new size comes from `HashHelpers.GetPrime`, a table of prime capacities, rather than a flat doubling. `Dictionary<TKey,TValue>.Capacity`, public since .NET 9, exposes exactly how many entries the table can hold before that next resize:

```csharp run id=capacity
var real = new Dictionary<int, int>();
int lastCapacity = real.Capacity;
Console.WriteLine($"0 items: capacity {lastCapacity}");
for (int i = 0; i < 200; i++)
{
    real.Add(i, i);
    if (real.Capacity != lastCapacity)
    {
        lastCapacity = real.Capacity;
        Console.WriteLine(
            $"{real.Count,3} items: capacity grew to {lastCapacity}");
    }
}
```

```text output
0 items: capacity 0
  1 items: capacity grew to 3
  4 items: capacity grew to 7
  8 items: capacity grew to 17
 18 items: capacity grew to 37
 38 items: capacity grew to 89
 90 items: capacity grew to 197
198 items: capacity grew to 431
```

Every capacity is prime, and every jump lands exactly one item past the previous capacity — the 4th item forces a grow past capacity 3, the 8th forces a grow past capacity 7, and so on — which is the `count == entries.Length` trigger measured directly through the public API. Primes reduce the chance that a family of hash codes sharing a common factor with the table size all collapse onto a handful of buckets; `HashHelpers.GetPrime` is what `Dictionary.cs` calls to pick each one.

## The contract behind GetHashCode and Equals

Both `HashMap<TKey,TValue>.TryGet` and `Dictionary<TKey,TValue>.FindValue` do the same two-step check on every candidate: compare hash codes first (cheap), then call `Equals` (authoritative) only if the hashes match. That only works if a type's `GetHashCode` and `Equals` agree on what "the same key" means. [Microsoft's documentation](https://learn.microsoft.com/en-us/dotnet/api/system.object.gethashcode) states the rule precisely:

> Two objects that are equal return hash codes that are equal. However, the reverse is not true: equal hash codes do not imply object equality, because different (unequal) objects can have identical hash codes.

And, for anyone implementing the pair:

> If two objects compare as equal, the `GetHashCode()` method for each object must return the same value. [...] The `GetHashCode()` method for an object must consistently return the same hash code as long as there is no modification to the object state that determines the return value of the object's `Equals` method.

The second sentence is a promise about *when* the hash code is allowed to change: only when the state `Equals` compares changes. A correct, immutable key type keeps that promise automatically. [`HashCode.Combine`](https://learn.microsoft.com/en-us/dotnet/api/system.hashcode.combine) is the standard way to fold several fields into one well-distributed hash code without writing the mixing arithmetic by hand — every custom key type in this article uses it. The real [`Dictionary<TKey,TValue>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2) documentation adds the consequence that matters most in practice:

> As long as an object is used as a key in the `Dictionary<TKey,TValue>`, it must not change in any way that affects its hash value.

## The bug: what happens when a key changes underneath the dictionary

"Must not change" is a rule a compiler cannot enforce. Here is what actually happens when it is broken — a mutable class used as a key, mutated after insertion:

```csharp run id=mutable-key
var scores = new Dictionary<Point, string>();
var start = new Point(3, 4);
scores[start] = "the marker at (3,4)";

Console.WriteLine(
    $"found before move: {scores.ContainsKey(start)}");

start.X = 30; // mutates the key already stored inside scores

Console.WriteLine(
    $"found after move:  {scores.ContainsKey(start)}");
Console.WriteLine($"Count: {scores.Count}");
Console.WriteLine(
    $"still Remove()-able: {scores.Remove(start)}");

foreach (var (key, value) in scores)
    Console.WriteLine(
        $"orphaned entry: ({key.X},{key.Y}) -> {value}");

sealed class Point(int x, int y)
{
    public int X { get; set; } = x;
    public int Y { get; set; } = y;

    public override bool Equals(object? obj) =>
        obj is Point p && p.X == X && p.Y == Y;

    public override int GetHashCode() =>
        HashCode.Combine(X, Y);
}
```

```text output
found before move: True
found after move:  False
Count: 1
still Remove()-able: False
orphaned entry: (30,4) -> the marker at (3,4)
```

`start` inserted with `X = 3` hashed to a bucket chosen by `HashCode.Combine(3, 4)`, and the entry now lives in that bucket's chain — exactly like `entries[1]` in Figure 2. Setting `start.X = 30` changes what `GetHashCode()` returns, but the entry does not move; it cannot, because nothing tells the dictionary a key changed. Every later `ContainsKey`, `TryGetValue` or `Remove` call recomputes the hash from the *current* field values, lands in the bucket for `HashCode.Combine(30, 4)`, and finds nothing there — this is the exact scenario the GetHashCode documentation warns about: "you might think that the mutable object is lost in the hash table." It is not lost; `Count` still says 1, and the `foreach` loop, which walks every entry in array order rather than hashing anything, finds it exactly where it has been the whole time. It is simply unreachable by key, forever, because reaching it requires recomputing a hash that no longer points there.

:::pitfall
The fix is not "remember to update the dictionary when the key changes" — there is no dictionary API for that. It is to never let a key's identity change: use `readonly` fields or `init`-only properties for whatever `GetHashCode` reads, or key on something that is immutable by construction (an ID, a `Guid`) even if the rest of the object mutates freely.
:::

::::exercise[Predict a struct key's behavior]
`Spot` below is the same idea as `Point`, but a `struct`. Predict what each `Console.WriteLine` prints before running it, and explain the difference from `Point`'s output above.

```csharp run id=ex-struct
var byLocation = new Dictionary<Spot, string>();
var origin = new Spot(1, 2);
byLocation[origin] = "warehouse";

origin.X = 99; // mutates the local variable

Console.WriteLine(
    $"lookup with mutated local: " +
    $"{byLocation.ContainsKey(origin)}");
Console.WriteLine(
    $"lookup with the original value: " +
    $"{byLocation.ContainsKey(new Spot(1, 2))}");

struct Spot(int x, int y)
{
    public int X = x;
    public int Y = y;

    public override readonly bool Equals(object? obj) =>
        obj is Spot s && s.X == X && s.Y == Y;

    public override readonly int GetHashCode() =>
        HashCode.Combine(X, Y);
}
```

:::solution
```text output
lookup with mutated local: False
lookup with the original value: True
```

`byLocation[origin] = ...` copies `origin`'s two `int` fields into the dictionary's entry; a `struct` has no shared identity with the variable that created it. Mutating the local `origin` afterward changes only that local copy — the copy sitting inside the dictionary, with `X == 1`, is untouched. So a lookup with the mutated local misses (it now hashes to `(99, 2)`), while a lookup with the original value `(1, 2)` still hits. The dictionary itself was never corrupted, because nothing that lives inside it ever changed — the same reasoning the [value types and reference types article](/csharp-dotnet/value-types-vs-reference-types/) applies to copying in general. `Point`'s bug is specifically a reference-type problem: two references to the very same mutable object, one held by the caller and one held by the dictionary's entry.
:::
::::

## Worst case: when every key lands in one bucket

CLRS's chaining analysis (chapter 11) assumes hashing spreads keys uniformly; drop that assumption and chaining degrades to a single linked list, O(*n*) per operation. `HashMap<TKey,TValue>` makes no attempt to defend against this, so it is easy to force:

```csharp run id=worst-case
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int N = 4000;
var good = new HashMap<int, int>();
var bad = new HashMap<BadKey, int>();
for (int i = 0; i < N; i++)
{
    good.Set(i, i);
    bad.Set(new BadKey(i), i);
}

Console.WriteLine(
    $"good: buckets {good.BucketCount}, " +
    $"max chain {MaxChain(good)}");
Console.WriteLine(
    $"bad:  buckets {bad.BucketCount}, " +
    $"max chain {MaxChain(bad)}");

double goodNs = LookupNs(() => good.TryGet(N / 2, out _));
double badNs = LookupNs(() => bad.TryGet(new BadKey(N / 2), out _));
Console.WriteLine(
    $"good lookup: {goodNs,7:F0} ns");
Console.WriteLine(
    $"bad lookup:  {badNs,7:F0} ns");

static int MaxChain<K, V>(HashMap<K, V> map) where K : notnull
{
    int max = 0;
    for (int b = 0; b < map.BucketCount; b++)
        max = Math.Max(max, map.ChainLength(b));
    return max;
}

static double LookupNs(Func<bool> lookup)
{
    for (int i = 0; i < 1000; i++) lookup(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        for (int i = 0; i < 10_000; i++) lookup();
        double ns = Stopwatch.GetElapsedTime(start).TotalNanoseconds;
        best = Math.Min(best, ns / 10_000);
    }
    return best;
}

readonly struct BadKey(int id) : IEquatable<BadKey>
{
    public int Id { get; } = id;
    public bool Equals(BadKey other) => Id == other.Id;
    public override bool Equals(object? obj) =>
        obj is BadKey k && Equals(k);
    public override int GetHashCode() => 1; // every key collides
}

sealed class HashMap<TKey, TValue> where TKey : notnull
{
    private sealed class Node(TKey key, TValue value, Node? next)
    {
        public TKey Key { get; } = key;
        public TValue Value { get; set; } = value;
        public Node? Next { get; set; } = next;
    }

    private readonly double _maxLoad;
    private Node?[] _buckets;
    private int _count;

    public HashMap(int initialBuckets = 8, double maxLoad = 0.75)
    {
        _buckets = new Node?[initialBuckets];
        _maxLoad = maxLoad;
    }

    public int Count => _count;
    public int BucketCount => _buckets.Length;

    public void Set(TKey key, TValue value)
    {
        int index = IndexOf(key, _buckets.Length);
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { n.Value = value; return; }
        }
        _buckets[index] = new Node(key, value, _buckets[index]);
        if (++_count > _buckets.Length * _maxLoad) Grow();
    }

    public bool TryGet(TKey key, out TValue value)
    {
        for (Node? n = _buckets[IndexOf(key, _buckets.Length)];
             n is not null; n = n.Next)
        {
            if (n.Key.Equals(key)) { value = n.Value; return true; }
        }
        value = default!;
        return false;
    }

    public int ChainLength(int bucket)
    {
        int n = 0;
        for (Node? node = _buckets[bucket];
             node is not null; node = node.Next) n++;
        return n;
    }

    private static int IndexOf(TKey key, int bucketCount) =>
        (int)((uint)key.GetHashCode() % (uint)bucketCount);

    private void Grow()
    {
        var bigger = new Node?[_buckets.Length * 2];
        foreach (Node? head in _buckets)
        {
            Node? n = head;
            while (n is not null)
            {
                Node? next = n.Next;
                int index = IndexOf(n.Key, bigger.Length);
                n.Next = bigger[index];
                bigger[index] = n;
                n = next;
            }
        }
        _buckets = bigger;
    }
}
```

```text output
good: buckets 8192, max chain 1
bad:  buckets 8192, max chain 4000
good lookup: [...] ns
bad lookup:  [...] ns
```

`BadKey.GetHashCode()` always returns `1`, so every one of the 4,000 keys lands in the same bucket regardless of resizing — resizing only spreads *buckets* out; it does nothing if the hash function itself refuses to spread keys across them. The chain for that one bucket is 4,000 long, and `TryGet` walks it linearly: two runs on this machine measured the bad lookup at roughly 15,500 and 16,000 ns against 6 to 7 ns for the well-distributed table — about 2,500 times slower. If `TKey` were a `string` supplied by a caller — a request header name, a JSON field, anything an attacker chooses — and the hash function were predictable, an attacker could construct exactly this: a set of strings engineered to collide, turning an operation an application assumes is O(1) into O(*n*) per request. This class of attack is usually called hash flooding.

`string.GetHashCode()` already defends against a *static* version of it: its algorithm is [Marvin32](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Marvin.cs), seeded from a value the runtime generates once per process using a cryptographic random number generator, not a fixed constant. Because [Microsoft's documentation](https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode) confirms the result is not guaranteed stable — "two subsequent runs of the same program may return different hash codes" — a collision set built against one run of a program will not necessarily still collide the next time that program starts, which is exactly what was observed earlier: the [bucket assignments](#turning-a-key-into-an-index-hash-functions) for `"apple"`, `"banana"`, `"cherry"`, `"date"` and `"fig"` changed between two separate runs of the same program on this machine.

:::dotnet
There is a second, adaptive layer specifically inside `Dictionary<TKey,TValue>`. By default it does **not** pay for the randomized hash on every `string` lookup — for speed, it starts with [`NonRandomizedStringEqualityComparer`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/NonRandomizedStringEqualityComparer.cs), a faster, non-randomized string hash. `Dictionary.cs` only switches away from it under pressure: past a compiled-in collision threshold on a single bucket — a sign of either bad luck or an attack — it swaps in the comparer that uses the randomized hash. The source comment states the intent directly: "If we hit the collision threshold we'll need to switch to the comparer which is using randomized string hashing i.e. `EqualityComparer<string>.Default`." Ordinary programs never pay the randomized hash's extra cost; a program under a hash-flooding attempt does, and only once the attempt is already detectable.
:::

::::exercise[Find the bug]
`BuggyMap<TKey,TValue>` below compares candidates by `GetHashCode()` alone, skipping `Equals` entirely. `Coord` deliberately returns the same hash code for every instance. What does `Count` print, what does the lookup print, and which sentence from the [contract section](#the-contract-behind-gethashcode-and-equals) does this violate?

```csharp run id=ex-buggy
var cache = new BuggyMap<Coord, string>();
cache.Set(new Coord(1, 1), "first");
cache.Set(new Coord(2, 2), "second"); // a different key

Console.WriteLine($"Count: {cache.Count}");
Console.WriteLine(
    $"lookup (1,1): " +
    $"{cache.TryGet(new Coord(1, 1), out var v)} {v}");

readonly struct Coord(int x, int y) : IEquatable<Coord>
{
    public int X { get; } = x;
    public int Y { get; } = y;
    public bool Equals(Coord other) => X == other.X && Y == other.Y;
    public override bool Equals(object? obj) =>
        obj is Coord c && Equals(c);
    public override int GetHashCode() => 7; // deliberately weak
}

sealed class BuggyMap<TKey, TValue> where TKey : notnull
{
    private sealed class Node(TKey key, TValue value, Node? next)
    {
        public TKey Key { get; } = key;
        public TValue Value { get; set; } = value;
        public Node? Next { get; set; } = next;
    }

    private readonly Node?[] _buckets = new Node?[8];
    public int Count { get; private set; }

    public void Set(TKey key, TValue value)
    {
        int index = IndexOf(key);
        for (Node? n = _buckets[index]; n is not null; n = n.Next)
        {
            // BUG: equal hash codes do not mean equal keys.
            if (n.Key.GetHashCode() == key.GetHashCode())
            {
                n.Value = value;
                return;
            }
        }
        _buckets[index] = new Node(key, value, _buckets[index]);
        Count++;
    }

    public bool TryGet(TKey key, out TValue value)
    {
        for (Node? n = _buckets[IndexOf(key)]; n is not null; n = n.Next)
        {
            if (n.Key.GetHashCode() == key.GetHashCode())
            {
                value = n.Value;
                return true;
            }
        }
        value = default!;
        return false;
    }

    private int IndexOf(TKey key) =>
        (int)((uint)key.GetHashCode() % (uint)_buckets.Length);
}
```

:::solution
```text output
Count: 1
lookup (1,1): True second
```

`Coord(1,1)` and `Coord(2,2)` both hash to `7`, so `Set`'s broken check treats the second `Set` as an update of the first: `Count` never reaches 2, and the single stored node ends up holding `"second"`. Looking up `(1,1)` walks the same bucket, finds a node whose hash code matches (every `Coord` matches), and returns `"second"` — the value for a completely different key. This is precisely "equal hash codes do not imply object equality": a hash match narrows the search to a bucket, but only `Equals` can confirm the key inside it is actually the one being asked for. The fix is one line: compare `n.Key.Equals(key)`, as `HashMap<TKey,TValue>` does throughout this article, not `n.Key.GetHashCode() == key.GetHashCode()`.
:::
::::

## Choosing chaining, open addressing, or `Dictionary<TKey,TValue>`

- **General-purpose key/value storage in C#:** `Dictionary<TKey,TValue>` — chaining over two parallel arrays, expected O(1).
- **Custom key type:** override `GetHashCode`/`Equals` together, from immutable state, or use a `record`.
- **Key might otherwise be mutated after insertion:** key on an immutable id, not the mutable object itself.
- **Keys are attacker-influenced strings:** already covered — `string.GetHashCode()` is randomized per process, and `Dictionary<TKey,TValue>` escalates to it under a collision attack.
- **Cache-friendliness matters more than deletion:** open addressing keeps everything in one array with no chain pointers at all, at the cost of a trickier `Remove` and a hard ceiling at 100% full.

Whichever is picked, the two questions from this article decide correctness before performance ever enters it: does the key type's `GetHashCode` agree with its `Equals`, and can anything mutate that key while it is in the table.
