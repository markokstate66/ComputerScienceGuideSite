---
title: "Strings, Immutability and Unicode in .NET"
description: "Measure what naive concatenation and StringBuilder really cost, then run live the UTF-16 length surprises and the Turkish-I comparison bug that trips up code."
pillar: csharp-dotnet
order: 6
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [strings, immutability, unicode, stringbuilder, culture-sensitive-comparison]
prerequisites: ["csharp-dotnet/value-types-vs-reference-types"]
sources:
  - title: "String Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.string"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "String.Intern(String) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.string.intern"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StringBuilder Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.text.stringbuilder"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Rune Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.text.rune"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StringInfo Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.globalization.stringinfo"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Introduction to character encoding in .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/base-types/character-encoding-introduction"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Best Practices for Comparing Strings in .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/base-types/best-practices-strings"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Span<T> Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.span-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

Run `"😀".Length` in C# and the answer is `2`, not `1`. That single surprising number is the shape of most of this page: what a person sees as one character is not what the runtime counts as one character, and neither of those is what `==` compares by default once a culture gets involved. All three gaps are measurable, and the code below runs them rather than describing them.

## Nothing mutates: what `+=` really does

Every `string` operation that looks like a modification returns a new object and leaves the original alone, because [a `String` object is immutable: its value cannot be changed after it is created](https://learn.microsoft.com/en-us/dotnet/api/system.string). [Value Types vs Reference Types](/csharp-dotnet/value-types-vs-reference-types/) covers what it means for `string` to be a reference type; immutability is a separate guarantee layered on top of that. Two variables can point at the same string object, but neither one can change what that object holds — `Replace`, `Substring`, `ToUpper`, and `+` all allocate a fresh string and return it.

The compiler exploits this for anything it can resolve before the program runs. Two identical literals, or two literals joined with `+`, are folded into one constant, so the assembly stores a single object for both. A string built at run time does not share that object automatically, even if it ends up with the exact same characters — sharing it is what [the intern pool](https://learn.microsoft.com/en-us/dotnet/api/system.string.intern) is for, and it only happens when something asks for it:

```csharp run id=intern
using System.Text;

string greeting = "hello";
string greetingCopy = "hel" + "lo"; // resolved by the compiler, not at run time
string greetingBuilt = new StringBuilder().Append("hel").Append("lo").ToString();

Console.WriteLine(ReferenceEquals(greeting, greetingCopy));
Console.WriteLine(ReferenceEquals(greeting, greetingBuilt));

string interned = string.Intern(greetingBuilt);
Console.WriteLine(ReferenceEquals(greeting, interned));
```

```text output
True
False
True
```

`greetingCopy` shares an object with `greeting` because the compiler concatenated two constants before the program ever ran; there is only one `"hello"` in the assembly. `greetingBuilt` is a distinct object — `StringBuilder.ToString()` allocates — until `string.Intern` looks it up in the CLR's intern table and hands back the canonical reference, which happens to be the same object the literal already uses. The intern pool is a deliberate trade, not a free cache: [an interned string typically lives for the rest of the process, and interning still requires building the string first](https://learn.microsoft.com/en-us/dotnet/api/system.string.intern), so it only pays off when the same value recurs often enough to outweigh that permanent allocation. It does nothing for a loop that builds a different string on every iteration, which is the case that matters next.

## Measuring the cost: naive concatenation vs `StringBuilder`

Because, as the `StringBuilder` documentation puts it, ["each operation that appears to modify a String object actually creates a new string"](https://learn.microsoft.com/en-us/dotnet/api/system.text.stringbuilder), a loop that appends one character at a time re-copies everything appended so far, on every iteration — the total work is proportional to `1 + 2 + ... + n`, which is O(n²) in the number of appends. `StringBuilder` exists for exactly this case: it keeps an internal resizable `char` buffer, starting at a default capacity of 16 characters, and doubles that capacity whenever an append would overflow it. Doubling makes the total copying work across all the appends proportional to `n`, not `n²`, so each `Append` is O(1) amortized.

```csharp run id=concat-bench
#:property Optimize=true

const int N = 20_000;

Run("naive +=", () =>
{
    string s = "";
    for (int i = 0; i < N; i++)
        s += "x";
    return s.Length;
});

Run("StringBuilder", () =>
{
    var sb = new System.Text.StringBuilder();
    for (int i = 0; i < N; i++)
        sb.Append('x');
    return sb.Length;
});

static void Run(string name, Func<int> work)
{
    work(); // warm-up, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    int len = work();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{name,-14}{bytes,12:N0} B");
    GC.KeepAlive(len);
}
```

```text output
naive +=       400,519,976 B
StringBuilder       49,248 B
```

Twenty thousand one-character appends: the naive loop allocated about 400 MB to produce a 20,000-character result, roughly 8,100 times what `StringBuilder` needed for the same output, because every intermediate string it ever built — length 1, then 2, then 3, all the way to 20,000 — was garbage the instant the next `+=` ran. `StringBuilder`'s 49,248 bytes are mostly its own buffer, doubling through roughly 16, 32, 64, ... up past 20,000 as it grew, plus the final `char[]` the string conversion would need. Wall-clock time moved in the same direction — the naive loop took tens of milliseconds against `StringBuilder` finishing too fast for `Stopwatch` at this size to tell apart from zero — but the byte counts are the more reliable signal here because, unlike wall time, they don't depend on what else this machine was doing during the run.

::::exercise[Measure it: does the ratio hold at a different size?]
The naive loop above is O(n²): copying work grows with the square of the number of appends. If that model is right, doubling `N` from 20,000 to 40,000 should roughly *quadruple* the bytes the naive loop allocates, not just double them. Change `N` to `40_000` in the naive benchmark above and predict the byte count before running it.

:::solution
```csharp run id=concat-bench-40k
#:property Optimize=true

const int N = 40_000;

string s = "";
long before = GC.GetAllocatedBytesForCurrentThread();
for (int i = 0; i < N; i++)
    s += "x";
long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
Console.WriteLine($"N={N,-7}{bytes,12:N0} B");
```

```text output
N=40000  1,601,039,976 B
```

1,601,039,976 bytes is almost exactly four times 400,519,976 — 3.997x, to be precise — which is the O(n²) shape showing up directly in measured allocation, not just in the formula.
:::
::::

## What `.Length` is actually counting

A `string` is logically a sequence of `char` values, and [each `char` is a 16-bit UTF-16 *code unit*, not a character](https://learn.microsoft.com/en-us/dotnet/standard/base-types/character-encoding-introduction). For most of the world's alphabets that distinction never shows up, because one letter is one code unit. It shows up the moment a *code point* — a single Unicode-assigned value, from `U+0000` to `U+10FFFF` — needs more than 16 bits to represent, which is true of every code point above `U+FFFF`, including most emoji:

```csharp run id=emoji-length
Console.WriteLine("😀".Length);
```

```text output
2
```

`😀` is `U+1F600`, a single code point, but it sits above the 16-bit range that one `char` can hold, so .NET encodes it as a *surrogate pair*: two `char` values from the reserved range `U+D800`–`U+DFFF`, neither of which is meaningful on its own. `string.Length` counts `char` values, so it reports 2 for a string that a reader would call one character. That gap can widen further, because what a reader perceives as a single character — a *grapheme cluster*, called a *text element* in .NET — can itself be built from more than one code point, for example a base letter followed by a separate combining accent mark.

<figure class="diagram">
<svg viewBox="0 0 360 280" role="img" aria-labelledby="gcu-title gcu-desc">
<title id="gcu-title">One flag emoji as a grapheme cluster, two code points, and four UTF-16 code units</title>
<desc id="gcu-desc">A box for the flag emoji splits into two Unicode code point boxes below it, and each code point box splits into two UTF-16 code unit boxes below that.</desc>
<defs>
<marker id="gcu-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="110" y="16" width="140" height="46" rx="6" class="d-box-accent"/>
<text x="180" y="46" text-anchor="middle" class="d-large">🇯🇵</text>
<text x="20" y="78" class="d-small d-muted">1 grapheme cluster (what you see)</text>
<path d="M150 62 L90 100" class="d-accent" marker-end="url(#gcu-arrow)"/>
<path d="M210 62 L270 100" class="d-accent" marker-end="url(#gcu-arrow)"/>
<rect x="20" y="100" width="140" height="42" rx="6" class="d-box"/>
<text x="90" y="126" text-anchor="middle" class="d-mono">U+1F1EF</text>
<rect x="200" y="100" width="140" height="42" rx="6" class="d-box"/>
<text x="270" y="126" text-anchor="middle" class="d-mono">U+1F1F5</text>
<text x="20" y="158" class="d-small d-muted">2 Unicode code points (scalar values)</text>
<path d="M70 142 L47 178" class="d-line" marker-end="url(#gcu-arrow)"/>
<path d="M110 142 L136 178" class="d-line" marker-end="url(#gcu-arrow)"/>
<path d="M250 142 L225 178" class="d-line" marker-end="url(#gcu-arrow)"/>
<path d="M290 142 L313 178" class="d-line" marker-end="url(#gcu-arrow)"/>
<rect x="10" y="178" width="75" height="38" rx="5" class="d-box-2"/>
<text x="47" y="202" text-anchor="middle" class="d-mono d-small">D83C</text>
<rect x="98" y="178" width="75" height="38" rx="5" class="d-box-2"/>
<text x="136" y="202" text-anchor="middle" class="d-mono d-small">DDEF</text>
<rect x="187" y="178" width="75" height="38" rx="5" class="d-box-2"/>
<text x="225" y="202" text-anchor="middle" class="d-mono d-small">D83C</text>
<rect x="275" y="178" width="75" height="38" rx="5" class="d-box-2"/>
<text x="313" y="202" text-anchor="middle" class="d-mono d-small">DDF5</text>
<text x="20" y="236" class="d-small d-muted">4 UTF-16 code units — this is</text>
<text x="20" y="252" class="d-small d-muted">what string.Length counts</text>
</svg>
<figcaption>Figure 1. The flag emoji "🇯🇵" is one grapheme cluster, but two Unicode code points and four UTF-16 code units, so string.Length reports 4, not 1.</figcaption>
</figure>

## Three ways to count a "character"

.NET gives a name to each level in that figure. `string.Length` counts `char` (UTF-16 code unit) instances. [`Rune.EnumerateRunes()`](https://learn.microsoft.com/en-us/dotnet/api/system.text.rune) counts Unicode scalar values — code points outside the surrogate range, which is every code point that can legally stand alone. [`StringInfo.GetTextElementEnumerator`](https://learn.microsoft.com/en-us/dotnet/api/system.globalization.stringinfo) counts text elements, .NET's name for grapheme clusters: "a base character, a surrogate pair, or a combining character sequence" — the closest match to what a reader would call one character. Running all three against the same strings shows how far apart they can land:

```csharp run id=three-counts
using System.Globalization;

(string label, string text)[] samples =
[
    ("e + combining acute", "cafe\u0301"),
    ("precomposed e-acute", "caf\u00e9"),
    ("grinning face", "\U0001F600"),
    ("flag JP (2 points)", "\U0001F1EF\U0001F1F5"),
];

Console.WriteLine($"{"sample",-20}{"Len",4}{"Rune",5}{"Elem",5}");
foreach (var (label, s) in samples)
{
    int elements = 0;
    var en = StringInfo.GetTextElementEnumerator(s);
    while (en.MoveNext()) elements++;
    Console.WriteLine($"{label,-20}{s.Length,4}{s.EnumerateRunes().Count(),5}{elements,5}");
}
```

```text output
sample               Len Rune Elem
e + combining acute    5    5    4
precomposed e-acute    4    4    4
grinning face          2    1    1
flag JP (2 points)     4    2    1
```

`"café"` and `"café"` display identically — both look like *café* — but the first spells the final é as a plain `e` followed by a standalone combining acute accent (`U+0301`), so it has one more `char` and one more `Rune` than the precomposed version, even though both agree that the string has four text elements. `StringInfo` is what makes that last column correct: it is Unicode-aware text segmentation, not a character count, and .NET's own history is a caution about assuming any implementation gets this right on the first try — [`StringInfo` had a bug that mishandled some grapheme clusters before .NET 5](https://learn.microsoft.com/en-us/dotnet/standard/base-types/character-encoding-introduction).

::::exercise[Predict the output: a family emoji]
The family emoji "👨‍👩‍👧" is not one code point. It is three person emoji — a man, a woman, and a girl — joined by two copies of `U+200D`, the invisible ZERO WIDTH JOINER, which tells a renderer to draw the surrounding scalar values as one glyph instead of three separate people. Each person emoji sits above `U+FFFF`, so it needs a surrogate pair (two `char`s); `U+200D` itself is inside the Basic Multilingual Plane, so it is one `char`. Using the same three counting APIs as the table above (`Len`, `Rune`, `Elem`), predict all three numbers for this string before you run anything.

:::solution
```csharp run id=family-zwj
using System.Globalization;

string family = "\U0001F468‍\U0001F469‍\U0001F467"; // man + ZWJ + woman + ZWJ + girl

int elements = 0;
var en = StringInfo.GetTextElementEnumerator(family);
while (en.MoveNext()) elements++;

Console.WriteLine($"Len:  {family.Length}");
Console.WriteLine($"Rune: {family.EnumerateRunes().Count()}");
Console.WriteLine($"Elem: {elements}");
```

```text output
Len:  8
Rune: 5
Elem: 1
```

`Len` is 8: three person emoji at two `char`s each (6) plus two `U+200D` joiners at one `char` each (2). `Rune` is 5, because `EnumerateRunes()` counts every scalar value that stands alone, and the joiners are scalar values too — just invisible ones — so they count alongside the three people. `Elem` is 1: `StringInfo`'s grapheme-cluster segmentation recognizes the whole man-ZWJ-woman-ZWJ-girl run as the single thing a reader perceives, the same answer the flag emoji gave two rows up in the table, this time built from five scalar values instead of two.
:::
::::

## The `Rune` type: scalar values without the surrogate bookkeeping

A single `char` cannot always answer questions like "is this a letter", because a `char` that is one half of a surrogate pair carries no information on its own. [`Rune` exists to give code a guaranteed-valid scalar value to work with instead](https://learn.microsoft.com/en-us/dotnet/api/system.text.rune): its constructors validate the input, so a `Rune` is never a lone surrogate. The difference is visible wherever a string contains a letter outside the Basic Multilingual Plane, such as the Gothic script (`U+10330` onward), which needs a surrogate pair per letter:

```csharp run id=rune-letters
using System.Text;

string word = "ok\U00010330\U00010331"; // "ok" + two Gothic letters (outside the BMP)

int charCount = 0;
foreach (char c in word)
    if (char.IsLetter(c)) charCount++;

int runeCount = 0;
foreach (Rune r in word.EnumerateRunes())
    if (Rune.IsLetter(r)) runeCount++;

Console.WriteLine($"char.IsLetter: {charCount} of 4");
Console.WriteLine($"Rune.IsLetter: {runeCount} of 4");
```

```text output
char.IsLetter: 2 of 4
Rune.IsLetter: 4 of 4
```

Looping `char`-by-`char` only finds the two ASCII letters, `o` and `k`; each half of each Gothic letter's surrogate pair fails `char.IsLetter` on its own, because half a surrogate pair is not a scalar value and carries no category information. `word.EnumerateRunes()` decodes the surrogate pairs first, so `Rune.IsLetter` sees four complete scalar values and correctly counts all four letters. The rule of thumb: iterate `char` when you are matching a specific ASCII character or splitting on one (`Split(',')` does not need `Rune`), and iterate `Rune` when you are classifying a character — checking whether it is a letter, a digit, whitespace, or a given Unicode category.

## Comparing strings: ordinal by default, culture on purpose

`==` and `Equals()` on `string` default to *ordinal* comparison: a plain `char`-by-`char` comparison of code unit values, with no notion of language. `ToUpper()`, `ToLower()`, and any comparison made with a `CultureInfo`-based `StringComparison` instead apply *linguistic* casing and equivalence rules, which depend on which culture is active. [Microsoft's guidance is direct about which one to reach for by default](https://learn.microsoft.com/en-us/dotnet/standard/base-types/best-practices-strings): use `StringComparison.Ordinal` or `StringComparison.OrdinalIgnoreCase` as the safe default for non-linguistic strings — identifiers, file paths, protocol tokens, flags — and reserve culture-sensitive comparison for text a person will actually read, sorted or matched the way that culture expects.

The canonical case for why the default matters is what the docs call the Turkish-I problem. Turkish and Azerbaijani split the letter *i* into two independent pairs instead of the one pair most Latin alphabets use: a dotted pair, `İ`/`i`, and a separate dotless pair, `I`/`ı`. Casing the ASCII letter `i` upward under Turkish rules produces `İ` (`U+0130`), not the plain ASCII `I` (`U+0049`) that code written under, say, U.S. English culture takes for granted:

```csharp run id=turkish
using System.Globalization;
using System.Threading;

Console.WriteLine($"culture: {CultureInfo.CurrentCulture.Name}");
Console.WriteLine($"'i'.ToUpper():            {"i".ToUpper()}");
Console.WriteLine($"'i'=='I' (culture, ci):   {string.Equals("i", "I", StringComparison.CurrentCultureIgnoreCase)}");

Thread.CurrentThread.CurrentCulture = new CultureInfo("tr-TR");
Console.WriteLine();
Console.WriteLine($"culture: {CultureInfo.CurrentCulture.Name}");
Console.WriteLine($"'i'.ToUpper():            {"i".ToUpper()}");
Console.WriteLine($"'i'=='I' (culture, ci):   {string.Equals("i", "I", StringComparison.CurrentCultureIgnoreCase)}");
Console.WriteLine($"'i'=='I' (ordinal, ci):   {string.Equals("i", "I", StringComparison.OrdinalIgnoreCase)}");
```

```text output
culture: en-US
'i'.ToUpper():            I
'i'=='I' (culture, ci):   True

culture: tr-TR
'i'.ToUpper():            İ
'i'=='I' (culture, ci):   False
'i'=='I' (ordinal, ci):   True
```

On this machine's default culture, `en-US`, `"i".ToUpper()` is `"I"` and comparing `"i"` to `"I"` case-insensitively is `True`, which is what most developers writing and testing on a U.S. or U.K. machine expect. Switch `CurrentCulture` to `tr-TR` — which happens for real whenever the process runs on a Turkish-locale machine or container, not just when a test sets it — and `"i".ToUpper()` becomes `"İ"`, so the *same* case-insensitive comparison that was `True` a moment ago is now `False`, because the code compares `"i"` and `"I"`, and under Turkish rules `"I"` uppercases from `"ı"`, not from `"i"`. `StringComparison.OrdinalIgnoreCase` never consulted a culture in the first place, so it returns `True` in both cases.

:::pitfall
`CurrentCulture` is not a test-only concern. It comes from the operating system's locale by default, so identical code can pass every test on a U.S.-locale CI machine and fail in production the first time it runs under a Turkish or Azerbaijani locale — with no code change, no data change, and no exception, just a silently wrong `bool`.
:::

::::exercise[Find the bug: a command-line flag matcher]
This function is meant to recognize the `--silent` flag regardless of how a user cases it: `string.Equals(input, "silent", StringComparison.CurrentCultureIgnoreCase)`.

Under the process's default `en-US` culture, `MatchesFlag("SILENT")` is `true`. Explain what happens to that same call on a machine whose default culture is `tr-TR`, and fix the function so the flag is recognized regardless of the machine's locale.

:::solution
```csharp run id=flag-bug
using System.Globalization;
using System.Threading;

Console.WriteLine($"en-US:         {MatchesFlag("SILENT")}");

Thread.CurrentThread.CurrentCulture = new CultureInfo("tr-TR");
Console.WriteLine($"tr-TR:         {MatchesFlag("SILENT")}");
Console.WriteLine($"tr-TR, fixed:  {MatchesFlagFixed("SILENT")}");

static bool MatchesFlag(string input) =>
    string.Equals(input, "silent", StringComparison.CurrentCultureIgnoreCase);

static bool MatchesFlagFixed(string input) =>
    string.Equals(input, "silent", StringComparison.OrdinalIgnoreCase);
```

```text output
en-US:         True
tr-TR:         False
tr-TR, fixed:  True
```

Under `tr-TR`, comparing `"SILENT"` to `"silent"` case-insensitively fails, because the `i` in `"silent"` uppercases to `İ` under Turkish rules, not to the plain `I` in the literal `"SILENT"` the user typed. A command-line flag is exactly the non-linguistic case the guidance above names: it should never have used culture-sensitive casing at all. `StringComparison.OrdinalIgnoreCase` fixes it because it compares by code unit value with simple ASCII case-folding, the same result on every machine regardless of locale.
:::
::::

## `Span<char>`: slicing without allocating

`Substring` "creates a new string to hold the substring" and copies characters into it, [which `Span<T>`'s documentation names as the two costs a substring-heavy pipeline pays repeatedly](https://learn.microsoft.com/en-us/dotnet/api/system.span-1). A `ReadOnlySpan<char>` can point at the same characters a `string` already owns, in place, so slicing it costs nothing beyond the two integers — offset and length — that describe the slice:

```csharp run id=span-parse
#:property Optimize=true
using System.Runtime.CompilerServices;

string reading = "duration=125ms";

Report("Substring", () => ParseWithSubstring(reading));
Report("Span slice", () => ParseWithSpan(reading));

static void Report(string name, Func<int> parse)
{
    parse(); // warm-up, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    int value = parse();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{name,-11}{value,4} ms{bytes,4} B");
}

[MethodImpl(MethodImplOptions.NoInlining)]
static int ParseWithSubstring(string s)
{
    int eq = s.IndexOf('=');
    string digits = s.Substring(eq + 1, s.Length - eq - 1 - 2);
    return int.Parse(digits);
}

[MethodImpl(MethodImplOptions.NoInlining)]
static int ParseWithSpan(string s)
{
    ReadOnlySpan<char> span = s;
    int eq = span.IndexOf('=');
    ReadOnlySpan<char> digits = span.Slice(eq + 1, span.Length - eq - 1 - 2);
    return int.Parse(digits);
}
```

```text output
Substring   125 ms  32 B
Span slice  125 ms   0 B
```

Both functions parse the same value out of the same string, but `ParseWithSubstring` allocates 32 bytes — the object header plus the three-character payload `"125"` — every single call, while `ParseWithSpan` allocates nothing: `int.Parse` has an overload that reads straight from a `ReadOnlySpan<char>`, so the digits never need their own `string` at all. `Span<T>` gets this for free because it is a `ref struct`: a type the runtime guarantees stays on the stack, which is also its restriction — a `Span<char>` cannot be boxed, stored in a field of an ordinary class, or held across an `await`, because none of those locations can guarantee the stack frame it points into is still alive. For a value that must outlive the current method call, `ReadOnlyMemory<char>` is the heap-safe counterpart, converted back to a span only where it's about to be read.

Parsing one short reading is not where allocation-free slicing earns its keep; a loop that slices thousands of lines out of a log file or a network buffer is where 32 bytes per call turns into megabytes per run, for exactly the same reason the naive concatenation loop above did — a great many small, short-lived allocations that add up to real garbage-collector work, even though no single one of them looks expensive on its own.
