## What this site assumes

You can already write small programs: variables, loops, methods, a class or two. The language is C#, but if you know Java, TypeScript, Go or Python you will be able to follow the code. No mathematics beyond school algebra is assumed; where a proof or a logarithm matters, the article explains it.

Every article is marked **Beginner**, **Intermediate** or **Advanced**. Beginner articles assume only the paragraph above. Intermediate articles assume the beginner material in the same topic. Advanced articles list the articles to read first under "Before you read".

## Running the examples

Reading about an algorithm is not the same as watching it run, changing it, and seeing what breaks. The C# examples on this site are complete programs written with top-level statements, so each one runs from a single file.

1. Install the [.NET 10 SDK](https://dotnet.microsoft.com/download) (the SDK, not only the runtime).
2. Copy a program from an article into an empty file, for example `example.cs`. Every code block has a **Copy** button.
3. In a terminal, in that folder, run `dotnet run example.cs`.

This one makes a good smoke test:

```csharp run
int[] numbers = [5, 3, 8, 1];
Array.Sort(numbers);
Console.WriteLine(string.Join(", ", numbers));
```

```text output
1, 3, 5, 8
```

The first run takes a few seconds while the SDK compiles the file; later runs are faster. Running a `.cs` file directly needs .NET 10 or later. On an older SDK, create a console project with `dotnet new console` and paste the program into `Program.cs` instead.

SQL examples are written for SQLite, which you can try without installing a server, and articles point out where SQL Server or PostgreSQL behave differently. Git examples run in any terminal that has Git.

## How to read the code blocks

| Label on the block | What it means |
|---|---|
| **C#**, **SQL** or **Bash**, with no other label | A complete example. It was compiled or executed when the article was checked, and you can run it as it is. |
| **Output** or **Result**, in a dark panel under a program | What that program printed when it was checked. Timings and memory addresses vary between machines, and articles say when a value is only indicative. |
| **Excerpt** | A few lines taken from a complete program elsewhere in the same article, shown again so they can be discussed. It will not compile on its own. |
| **Does not compile** or **Throws** | The failure is the point of the example. The label names the compiler error or the exception you should see. |
| **JSON**, **HTTP**, **Diff**, **Console** and similar | Illustration only. There is nothing to run. |

## Exercises

Articles include exercises, and they are part of the teaching rather than decoration. Several ask you to predict what a program prints before you run it, which is the fastest way to find out whether a section made sense. Solutions are collapsed so that you can try first.

## If something is wrong

Each article ends with a **Report an error** link. Confirmed mistakes are fixed, and every fix that changes the meaning of an article is listed on the [corrections page](/corrections/). The [editorial policy](/editorial-policy/) describes how articles are researched, checked and updated.
