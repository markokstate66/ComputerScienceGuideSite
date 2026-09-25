# Cross-links wanted by `/csharp-dotnet/strings-and-unicode/`

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished when this round was written (2026-09-22), so the body does not link them yet. Each sentence reads correctly with or without the link.

- "`Span<T>` and `Memory<T>`" | /csharp-dotnet/span-and-memory/ | "`Span<char>`: slicing without allocating", the closing paragraph about a loop that slices thousands of lines — that article is the deeper, general treatment of `Span<T>`/`Memory<T>` (the `ref struct` rules, `Memory<T>` for async, a full CSV-line parser); this page only needs enough `Span<char>` to show one allocation-free string slice.

## Boundaries with planned siblings

- /csharp-dotnet/span-and-memory/ owns `Span<T>`/`Memory<T>` in general: the `ref struct` compile-error rules, `Memory<T>` for code that must hold a slice across an `await`, and a full parsing example. This article's `Span<char>` section is scoped to one string-slicing measurement (`Substring` vs `ReadOnlySpan<char>`) that motivates *why* an allocation-free view matters for strings specifically, and states the `ref struct` restriction only as far as explaining why a span cannot outlive its call.
