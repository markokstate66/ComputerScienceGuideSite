---
title: "HTTP from the Wire Up: Methods, Status Codes, Headers, Caching"
description: "Build a minimal HTTP server on TcpListener, then use it to test methods and idempotency, status code families, conditional caching, and cookies for real."
pillar: networking
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [http, status-codes, caching, cookies, tcplistener]
prerequisites: ["networking/how-the-internet-works", "networking/tcp-vs-udp"]
sources:
  - title: "RFC 9110: HTTP Semantics"
    url: "https://www.rfc-editor.org/rfc/rfc9110.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9111: HTTP Caching"
    url: "https://www.rfc-editor.org/rfc/rfc9111.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9112: HTTP/1.1"
    url: "https://www.rfc-editor.org/rfc/rfc9112.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9113: HTTP/2"
    url: "https://www.rfc-editor.org/rfc/rfc9113.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9114: HTTP/3"
    url: "https://www.rfc-editor.org/rfc/rfc9114.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport"
    url: "https://www.rfc-editor.org/rfc/rfc9000.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 7541: HPACK: Header Compression for HTTP/2"
    url: "https://www.rfc-editor.org/rfc/rfc7541.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9204: QPACK: Field Compression for HTTP/3"
    url: "https://www.rfc-editor.org/rfc/rfc9204.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 6265: HTTP State Management Mechanism"
    url: "https://www.rfc-editor.org/rfc/rfc6265.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 5789: PATCH Method for HTTP"
    url: "https://www.rfc-editor.org/rfc/rfc5789.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "TcpListener.AcceptTcpClientAsync Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcplistener.accepttcpclientasync"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

The [previous article](/networking/how-the-internet-works/) typed a request by hand and read whatever came back from a real web server. This one builds the half of that conversation which has to answer: a program that opens a listening socket, reads a real request line and headers off the wire, decides what they mean, and writes back a response that follows the same grammar. Every status code, cache hit and cookie below comes from a `TcpListener` server running in the same process as its client, on loopback, so it is deterministic: run any of these programs as many times as you like and the bytes are identical, because nothing here depends on the network, the clock or another machine's configuration. Programs were run with the .NET 10 SDK (10.0.401) on Windows 11, x64; nothing in this article's output depends on that beyond the SDK version needed to compile file-based C# programs.

## A message is a start line, headers, a blank line, an optional body

HTTP is a text-based, line-oriented protocol: a message is a start line, then header lines, then a blank line, then an optional body ([RFC 9112, section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-2.1)). A request and a response share that exact shape; only the start line differs, a request line (`method target version`) versus a status line (`version status-code reason-phrase`) ([RFC 9112, section 3](https://www.rfc-editor.org/rfc/rfc9112.html#section-3), [section 4](https://www.rfc-editor.org/rfc/rfc9112.html#section-4)).

<figure class="diagram">
<svg viewBox="0 0 360 336" role="img" aria-labelledby="anatomy-title anatomy-desc">
<title id="anatomy-title">The parts of an HTTP request and its response</title>
<desc id="anatomy-desc">Two stacked message boxes on the same connection. The request box has a start line with method, target and version, a block of header lines, a blank line, and a short body. The response box below it mirrors the same shape, with a status line carrying a status code and reason phrase in place of the start line.</desc>
<text x="10" y="18" class="d-small d-bold">Request</text>
<rect x="10" y="26" width="340" height="26" rx="4" class="d-box-accent"/>
<text x="180" y="44" text-anchor="middle" class="d-mono d-bold">PUT /items/1 HTTP/1.1</text>
<text x="20" y="66" class="d-muted d-small">start line: method, target, version</text>
<rect x="10" y="76" width="340" height="46" rx="4" class="d-box-2"/>
<text x="180" y="94" text-anchor="middle" class="d-mono d-small">Host: 127.0.0.1</text>
<text x="180" y="112" text-anchor="middle" class="d-mono d-small">Content-Length: 5</text>
<text x="20" y="136" class="d-muted d-small">header lines, one per line</text>
<rect x="10" y="146" width="340" height="16" rx="3" class="d-box"/>
<text x="20" y="176" class="d-muted d-small">blank line: headers end here</text>
<rect x="10" y="184" width="340" height="26" rx="4" class="d-box-2"/>
<text x="180" y="202" text-anchor="middle" class="d-mono d-small">first</text>
<text x="20" y="224" class="d-muted d-small">body: exactly Content-Length bytes</text>
<text x="10" y="252" class="d-small d-bold">Response, same connection</text>
<rect x="10" y="260" width="340" height="26" rx="4" class="d-box-accent"/>
<text x="180" y="278" text-anchor="middle" class="d-mono d-bold">HTTP/1.1 204 No Content</text>
<text x="20" y="300" class="d-muted d-small">status line: version, code, reason phrase</text>
<text x="20" y="322" class="d-muted d-small">One shape parses both directions.</text>
</svg>
<figcaption>Figure 1. A request and its response are the same four-part shape: a start line, header lines, a blank line, then an optional body. Only the first line differs between the two.</figcaption>
</figure>

That shared shape means one parser handles both directions. The server below listens on a loopback port the operating system assigns (port 0 means "pick one"), reads whatever arrives until it has seen a header block, and replies. `TcpListener.Start` puts the socket into a listening state immediately, so the client below can connect as soon as `Start` returns without waiting for the server's `AcceptTcpClientAsync` call to begin; the connection queues until then ([Microsoft Learn, TcpListener.AcceptTcpClientAsync](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcplistener.accepttcpclientasync)).

```csharp run id=wire
using System.Net;
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    using TcpClient peer = await
        listener.AcceptTcpClientAsync();
    NetworkStream net = peer.GetStream();
    var (first, _, _) =
        await ReadMessage(net);
    string[] start = first.Split(' ');
    Console.WriteLine(
        $"method  {start[0]}");
    Console.WriteLine(
        $"target  {start[1]}");

    string body = "Hello, HTTP.";
    byte[] response = Encoding.ASCII
        .GetBytes(
        "HTTP/1.1 200 OK\r\n" +
        "Content-Type: text/plain\r\n" +
        "Content-Length: " +
        $"{body.Length}\r\n\r\n" +
        body);
    await net.WriteAsync(response);
});

using var client = new TcpClient();
await client.ConnectAsync(
    IPAddress.Loopback, port);
NetworkStream stream =
    client.GetStream();
await stream.WriteAsync(
    Encoding.ASCII.GetBytes(
    "GET /hello HTTP/1.1\r\n" +
    $"Host: 127.0.0.1:{port}" +
    "\r\n\r\n"));

var (status, _, replyBody) =
    await ReadMessage(stream);
await server;
listener.Stop();

Console.WriteLine(
    $"status  {status}");
Console.WriteLine(
    $"body    {replyBody}");

static async Task<(string First,
    Dictionary<string, string> Headers,
    string Body)> ReadMessage(
    NetworkStream net)
{
    var raw = new StringBuilder();
    var buf = new byte[1024];
    int end;
    while ((end = raw.ToString()
        .IndexOf("\r\n\r\n", Ordinal))
        < 0)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        raw.Append(Encoding.ASCII
            .GetString(buf, 0, n));
    }
    string all = raw.ToString();
    string[] lines = all[..end]
        .Split("\r\n");
    var headers = new Dictionary<
        string, string>(
        StringComparer.OrdinalIgnoreCase);
    foreach (string line in
        lines.Skip(1))
    {
        int colon = line.IndexOf(':');
        if (colon > 0)
            headers[line[..colon].Trim()]
                = line[(colon + 1)..]
                    .Trim();
    }
    string body = all[(end + 4)..];
    int want = 0;
    if (headers.TryGetValue(
        "Content-Length",
        out string? len))
        want = int.Parse(len);
    while (body.Length < want)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        body += Encoding.ASCII
            .GetString(buf, 0, n);
    }
    return (lines[0], headers, body);
}
```

```text output
method  GET
target  /hello
status  HTTP/1.1 200 OK
body    Hello, HTTP.
```

`ReadMessage` reads until it finds `\r\n\r\n`, then checks whether it already grabbed some of the body in the same read (TCP does not preserve write boundaries, so a small body can arrive glued to the headers), and finally reads more only if `Content-Length` says there is more coming. Every program from here on reuses this shape, sometimes split into a head-only read and a body-only read where the two have to happen at different times.

:::pitfall
Stopping at the first `\r\n\r\n` found with `EndsWith` instead of `IndexOf` breaks the moment a request carries a body: a `PUT` whose headers and short body arrive in one TCP segment ends with the body's last byte, not a blank line, so an `EndsWith` check never matches and the read hangs forever. Search for the blank line inside the buffer, not at its end.
:::

## Methods, and which ones are safe to repeat

An HTTP method is not just a verb; it is a promise about what repeating the request does. RFC 9110 calls a method **idempotent** when "the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request" ([section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)). That is a claim about server-side effect, not about the bytes of the response.

| Method | Safe | Idempotent | Typical use |
|---|---|---|---|
| `GET` | yes | yes | Retrieve a representation |
| `HEAD` | yes | yes | Retrieve headers only |
| `OPTIONS` | yes | yes | Discover allowed methods |
| `TRACE` | yes | yes | Loopback test message |
| `PUT` | no | yes | Replace a resource |
| `DELETE` | no | yes | Remove a resource |
| `POST` | no | no | Create or act; effect varies |
| `PATCH` | no | no | Apply a partial change |
| `CONNECT` | no | no | Open a tunnel (proxies) |

Safe methods (the ones that should not change server state at all) are idempotent by construction ([RFC 9110, section 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1)); `PUT` and `DELETE` add nothing new but are idempotent anyway, each defined that way in its own section ([9.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4), [9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.5)). `PATCH` was added after the method table was already settled, by a separate RFC, which is explicit that it "is neither safe nor idempotent" by default ([RFC 5789, section 2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2)): a patch document that says "append one row" or "increment the counter" has a different effect every time it is replayed, even though `PUT`'s "replace with exactly this representation" does not.

This server keeps one resource collection in memory and reacts to `PUT`, `POST` and `GET` differently enough to show the difference in stored state, not just in status code:

```csharp run id=idempotent
using System.Net;
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;

var items = new Dictionary<int, string>();
int nextId = 2;

Task server = Task.Run(async () =>
{
    for (int i = 0; i < 5; i++)
    {
        using TcpClient peer = await
            listener.AcceptTcpClientAsync();
        await Handle(peer.GetStream());
    }
});

async Task Handle(NetworkStream net)
{
    var (first, _, body) =
        await ReadMessage(net);
    string[] start = first.Split(' ');
    (int code, string text) =
        (start[0], start[1]) switch
    {
        ("PUT", "/items/1") =>
            Put(body),
        ("POST", "/items") =>
            Post(body),
        ("GET", "/items") =>
            (200, Listing()),
        _ => (404, "no route"),
    };
    await Reply(net, code, text);
}

(int, string) Put(string value)
{
    items[1] = value;
    return (204, "");
}

(int, string) Post(string value)
{
    int id = nextId++;
    items[id] = value;
    return (201, $"created {id}");
}

string Listing() => string.Join(
    " ", items.OrderBy(p => p.Key)
    .Select(p => $"{p.Key}={p.Value}"));

async Task<(int Code, string Text)> Send(
    string method, string target,
    string? body)
{
    using var tcp = new TcpClient();
    await tcp.ConnectAsync(
        IPAddress.Loopback, port);
    NetworkStream net = tcp.GetStream();
    string head =
        $"{method} {target} HTTP/1.1\r\n";
    if (body is not null)
        head += "Content-Length: " +
            $"{body.Length}\r\n";
    head += "\r\n";
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
            head + (body ?? "")));
    var (status, _, text) =
        await ReadMessage(net);
    return (int.Parse(
        status.Split(' ')[1]), text);
}

async Task Report(string label,
    string method, string target,
    string? body)
{
    var (code, text) = await Send(
        method, target, body);
    Console.WriteLine(
        $"{label,-9}{code} {text}"
        .TrimEnd());
}

await Report("PUT #1", "PUT",
    "/items/1", "first");
await Report("PUT #2", "PUT",
    "/items/1", "first");
await Report("POST #1", "POST",
    "/items", "note");
await Report("POST #2", "POST",
    "/items", "note");
await Report("items", "GET",
    "/items", null);
await server;
listener.Stop();

static async Task Reply(
    NetworkStream net, int code,
    string text)
{
    string reason = code switch
    {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        _ => "Not Found",
    };
    byte[] payload = Encoding.ASCII
        .GetBytes(text);
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        $"HTTP/1.1 {code} {reason}\r\n" +
        "Content-Length: " +
        $"{payload.Length}\r\n\r\n"));
    if (payload.Length > 0)
        await net.WriteAsync(payload);
}

static async Task<(string First,
    Dictionary<string, string> Headers,
    string Body)> ReadMessage(
    NetworkStream net)
{
    var raw = new StringBuilder();
    var buf = new byte[1024];
    int end;
    while ((end = raw.ToString()
        .IndexOf("\r\n\r\n", Ordinal))
        < 0)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        raw.Append(Encoding.ASCII
            .GetString(buf, 0, n));
    }
    string all = raw.ToString();
    string[] lines = all[..end]
        .Split("\r\n");
    var headers = new Dictionary<
        string, string>(
        StringComparer.OrdinalIgnoreCase);
    foreach (string line in
        lines.Skip(1))
    {
        int colon = line.IndexOf(':');
        if (colon > 0)
            headers[line[..colon].Trim()]
                = line[(colon + 1)..]
                    .Trim();
    }
    string body = all[(end + 4)..];
    int want = 0;
    if (headers.TryGetValue(
        "Content-Length",
        out string? len))
        want = int.Parse(len);
    while (body.Length < want)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        body += Encoding.ASCII
            .GetString(buf, 0, n);
    }
    return (lines[0], headers, body);
}
```

```text output
PUT #1   204
PUT #2   204
POST #1  201 created 2
POST #2  201 created 3
items    200 1=first 2=note 3=note
```

Two identical `PUT` requests leave item 1 holding `"first"` either way: the second one has no effect the first did not already have. Two identical `POST` requests to `/items` each create a new resource, `2` and then `3`; the body sent was the same word, `"note"`, both times, but the effect was not the same, which is exactly the property RFC 9110 measures. That distinction also survives a mismatch between requests: repeating a `DELETE` on an already-deleted resource typically returns `404` the second time instead of the `204` the first call got, and RFC 9110's definition is unaffected because it is stated in terms of effect on the resource, not response code — the resource is gone after either call.

:::pitfall
"Idempotent" does not mean "has no side effect"; that is what **safe** means. `PUT` and `DELETE` are idempotent and both change server state. The confusion runs the other way too: a `POST` that happens to be safe to retry because the server deduplicates by a client-supplied request ID is a deliberate design choice layered on top of HTTP, not something the method guarantees. RFC 9110 is explicit that a client cannot assume a `POST` is safe to resend automatically ([section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)).
:::

::::exercise[Idempotent by design, not by luck]
A colleague argues: "Our `POST /orders` is idempotent in practice, because the payment processor rejects a duplicate charge for the same order ID within five minutes." Is that a correct use of the word "idempotent" as RFC 9110 defines it? What would make the *method* itself idempotent, as opposed to a downstream system happening to absorb the duplicate?

:::solution
No. RFC 9110's definition is about what the method's own semantics guarantee, not about whatever a particular server or a downstream system chooses to do about a duplicate ([section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)). The payment processor's five-minute deduplication window is an application-level safety net with an expiry; it is not a property of `POST`, and it stops protecting the client the moment the window closes or the processor changes its policy. Using `PUT /orders/{client-generated-id}` to create the order (replacing "whatever is at this identifier" with the full order representation) makes the operation idempotent by the method's own contract: replaying it targets the same identifier and converges to the same state, with no time limit and no cooperation required from anything downstream.
:::
::::

## Five families of status code, from the server's own mouth

A status code's first digit puts it in one of five classes, each with a distinct role ([RFC 9110, section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)):

| Class | Name | Meaning |
|---|---|---|
| 1xx | Informational | Interim; more is coming on this exchange |
| 2xx | Successful | The request was received, understood and accepted |
| 3xx | Redirection | Further action is needed to complete the request |
| 4xx | Client Error | The server believes the request itself is at fault |
| 5xx | Server Error | The request was valid; the server failed anyway |

1xx responses are the least visible in day-to-day work because most client libraries handle them invisibly, so this server produces one for real. `Expect: 100-continue` lets a client ask "are you willing to accept this body?" before sending it, and a server that is willing answers with an interim `100 Continue` and keeps the connection open for the body that follows ([RFC 9110, section 10.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.1.1), [section 15.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.2.1)). Reading the headers and reading the body have to be two separate steps here, or the server would block waiting for bytes the client is deliberately withholding:

```csharp run id=families
using System.Net;
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    for (int i = 0; i < 4; i++)
    {
        using TcpClient peer = await
            listener.AcceptTcpClientAsync();
        await Handle(peer.GetStream());
    }
});

async Task Handle(NetworkStream net)
{
    var (first, headers, prefix) =
        await ReadHead(net);
    string target =
        first.Split(' ')[1];
    string body = "";

    if (target == "/submit")
    {
        if (headers.TryGetValue(
            "Expect", out string? exp)
            && exp.Equals(
            "100-continue",
            OrdinalIgnoreCase))
            await net.WriteAsync(
                Encoding.ASCII.GetBytes(
                "HTTP/1.1 100 " +
                "Continue\r\n\r\n"));
        body = await ReadBody(
            net, headers, prefix);
    }

    (int code, string reason,
        string text) = target switch
    {
        "/redirect" => (302, "Found",
            "see /target"),
        "/submit" => (201, "Created",
            $"stored {body.Length}b"),
        "/missing" => (404,
            "Not Found",
            "no such page"),
        "/boom" => (500,
            "Internal Server Error",
            "handler threw"),
        _ => (404, "Not Found",
            "no route"),
    };
    string extra = target == "/redirect"
        ? "Location: /target\r\n" : "";
    byte[] payload = Encoding.ASCII
        .GetBytes(text);
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        $"HTTP/1.1 {code} {reason}" +
        $"\r\n{extra}" +
        "Content-Length: " +
        $"{payload.Length}\r\n\r\n"));
    await net.WriteAsync(payload);
}

async Task<(int Code, string Reason,
    Dictionary<string, string> Headers)>
    Get(string target)
{
    using var tcp = new TcpClient();
    await tcp.ConnectAsync(
        IPAddress.Loopback, port);
    NetworkStream net = tcp.GetStream();
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        $"GET {target} HTTP/1.1\r\n" +
        "\r\n"));
    var (head, headers, prefix) =
        await ReadHead(net);
    await ReadBody(
        net, headers, prefix);
    string[] parts = head.Split(
        ' ', 3);
    return (int.Parse(parts[1]),
        parts[2], headers);
}

async Task Show(string label,
    string target)
{
    var (code, reason, headers) =
        await Get(target);
    string extra = headers
        .TryGetValue("Location",
        out string? loc)
        ? $" -> {loc}" : "";
    Console.WriteLine(
        $"{label,-9}{code} " +
        $"{reason}{extra}");
}

await Show("redirect", "/redirect");
await Show("missing", "/missing");
await Show("boom", "/boom");

// /submit withholds its body until
// the server confirms it wants it.
using (var tcp = new TcpClient())
{
    await tcp.ConnectAsync(
        IPAddress.Loopback, port);
    NetworkStream net = tcp.GetStream();
    string content = "payload data";
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        "POST /submit HTTP/1.1\r\n" +
        "Expect: 100-continue\r\n" +
        "Content-Length: " +
        $"{content.Length}\r\n\r\n"));
    var (interim, _, _) =
        await ReadHead(net);
    string[] p1 = interim.Split(
        ' ', 3);
    Console.WriteLine(
        $"{"interim",-9}" +
        $"{p1[1]} {p1[2]}");

    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
            content));
    var (final, hs, prefix2) =
        await ReadHead(net);
    string finalBody = await ReadBody(
        net, hs, prefix2);
    string[] p2 = final.Split(
        ' ', 3);
    Console.WriteLine(
        $"{"submit",-9}{p2[1]} " +
        $"{p2[2]} {finalBody}");
}

await server;
listener.Stop();

static async Task<(string First,
    Dictionary<string, string> Headers,
    string Prefix)> ReadHead(
    NetworkStream net)
{
    var raw = new StringBuilder();
    var buf = new byte[1024];
    int end;
    while ((end = raw.ToString()
        .IndexOf("\r\n\r\n", Ordinal))
        < 0)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        raw.Append(Encoding.ASCII
            .GetString(buf, 0, n));
    }
    string all = raw.ToString();
    string[] lines = all[..end]
        .Split("\r\n");
    var headers = new Dictionary<
        string, string>(
        StringComparer.OrdinalIgnoreCase);
    foreach (string line in
        lines.Skip(1))
    {
        int colon = line.IndexOf(':');
        if (colon > 0)
            headers[line[..colon].Trim()]
                = line[(colon + 1)..]
                    .Trim();
    }
    return (lines[0], headers,
        all[(end + 4)..]);
}

static async Task<string> ReadBody(
    NetworkStream net,
    Dictionary<string, string> headers,
    string prefix)
{
    int want = 0;
    if (headers.TryGetValue(
        "Content-Length",
        out string? len))
        want = int.Parse(len);
    var buf = new byte[1024];
    string body = prefix;
    while (body.Length < want)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        body += Encoding.ASCII
            .GetString(buf, 0, n);
    }
    return body;
}
```

```text output
redirect 302 Found -> /target
missing  404 Not Found
boom     500 Internal Server Error
interim  100 Continue
submit   201 Created stored 12b
```

Every family but one came from a request that named a route; `500` came from the server just choosing to answer that way for `/boom`, standing in for what a real handler does when it throws: the request was fine, the server was not. `100 Continue` is the only response here with no body and no final meaning of its own — the client keeps reading, because RFC 9110 requires exactly one more response to follow it on the same exchange ([section 15.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.2.1)).

::::exercise[Give `/items/1` a `HEAD`]
Using the routing `switch` from the idempotency server above, add a case for `("HEAD", "/items/1")` that returns the same status and headers `GET /items/1` would, but never writes a body — which is exactly what makes `HEAD` safe to use for checking whether a resource exists without transferring it.

:::solution
`HEAD` reuses whatever status and headers the matching `GET` would produce; only the body-writing step is skipped. The `Content-Length` still describes what a `GET` body would have been, which is how a `HEAD` response lets a client learn a resource's size without fetching it.

```csharp run
using System.Net;
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;
var items = new Dictionary<
    int, string> { [1] = "first" };

Task server = Task.Run(async () =>
{
    using TcpClient peer = await
        listener.AcceptTcpClientAsync();
    NetworkStream net = peer.GetStream();
    var raw = new StringBuilder();
    var buf = new byte[512];
    while (!raw.ToString().Contains(
        "\r\n\r\n", Ordinal))
        raw.Append(Encoding.ASCII
            .GetString(buf, 0,
            await net.ReadAsync(buf)));
    string method = raw.ToString()
        .Split(' ')[0];
    string body = items[1];
    byte[] payload = Encoding.ASCII
        .GetBytes(body);
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        "HTTP/1.1 200 OK\r\n" +
        "Content-Length: " +
        $"{payload.Length}\r\n\r\n"));
    if (method != "HEAD")
        await net.WriteAsync(payload);
});

using var client = new TcpClient();
await client.ConnectAsync(
    IPAddress.Loopback, port);
NetworkStream stream =
    client.GetStream();
await stream.WriteAsync(
    Encoding.ASCII.GetBytes(
    "HEAD /items/1 HTTP/1.1\r\n\r\n"));
using var reader =
    new StreamReader(stream);
string reply = await reader
    .ReadToEndAsync();
await server;
listener.Stop();
Console.WriteLine(
    $"bytes back: {reply.Length}");
Console.WriteLine(reply.Replace(
    "\r\n", "\\r\\n\n").TrimEnd());
```

```text output
bytes back: 38
HTTP/1.1 200 OK\r\n
Content-Length: 5\r\n
\r\n
```
:::
::::

## Telling a client its copy is still good

A cache saves a round trip only if it can trust what it already has. RFC 9111 splits that trust into two mechanisms: freshness, a lifetime the server hands out so the cache does not have to ask again for a while, and validation, a way to ask cheaply once that lifetime is up ([RFC 9111, section 1](https://www.rfc-editor.org/rfc/rfc9111.html#section-1)). `Cache-Control: max-age=N` sets the freshness lifetime in seconds ([section 5.2.2.1](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.1)). `ETag` supplies a validator: an opaque token the server can recompute later and compare, defined once in RFC 9110 as identifying "one or more stored responses" ([section 8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3)). A client that still has a stored response sends that token back in `If-None-Match`; if the server's current token matches, the stored response is still good and it says so without resending it ([RFC 9111, section 4.3.2](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.2)), with status `304 Not Modified` ([section 4.3.3](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.3)).

<figure class="diagram">
<svg viewBox="0 0 360 262" role="img" aria-labelledby="cache-title cache-desc">
<title id="cache-title">A conditional GET that finds nothing has changed</title>
<desc id="cache-desc">Two request and response exchanges between a client and the mini server. The first request has no validator and gets a 200 response carrying the full body and an ETag. The second request carries that ETag in an If-None-Match header and gets a 304 response with no body, because the stored copy is still correct.</desc>
<defs>
<marker id="cache-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="cache-arrow-acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="50" y="16" text-anchor="middle" class="d-bold d-small">client</text>
<text x="310" y="16" text-anchor="middle" class="d-bold d-small">server</text>
<path d="M50 24 V96 M50 118 V210" class="d-line d-dashed"/>
<path d="M310 24 V96 M310 118 V210" class="d-line d-dashed"/>
<rect x="10" y="32" width="340" height="20" rx="4" class="d-box-2"/>
<text x="20" y="46" class="d-small d-bold">1st GET /report</text>
<text x="180" y="72" text-anchor="middle" class="d-small d-mono">GET /report</text>
<path d="M54 78 H306" class="d-line" marker-end="url(#cache-arrow)"/>
<text x="180" y="96" text-anchor="middle" class="d-small d-mono">200, ETag, full body</text>
<path d="M306 102 H54" class="d-accent" marker-end="url(#cache-arrow-acc)"/>
<rect x="10" y="118" width="340" height="20" rx="4" class="d-box-2"/>
<text x="20" y="132" class="d-small d-bold">2nd GET /report</text>
<text x="180" y="158" text-anchor="middle" class="d-small d-mono">If-None-Match: etag</text>
<path d="M54 164 H306" class="d-line" marker-end="url(#cache-arrow)"/>
<text x="180" y="182" text-anchor="middle" class="d-small d-mono d-text-accent">304, no body</text>
<path d="M306 188 H54" class="d-accent" marker-end="url(#cache-arrow-acc)"/>
<text x="20" y="206" class="d-small d-muted">stored body reused; nothing changed</text>
<text x="20" y="234" class="d-small d-bold">Body bytes are saved; the round trip is not.</text>
</svg>
<figcaption>Figure 2. Revalidating with If-None-Match still costs one round trip, but a match means the server sends only a status line back, never the body.</figcaption>
</figure>

The server below computes each `ETag` from a SHA-256 hash of the current content, which makes it a **strong** validator: it changes whenever the bytes do, byte for byte ([RFC 9110, section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1)). The third request reuses the *first* response's `ETag` on purpose, after the content has changed underneath it, the way a client that has not talked to the server in a while would:

```csharp run id=caching
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using static System.StringComparison;

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;

string report = "Q3 total: 41 units.";

Task server = Task.Run(async () =>
{
    for (int i = 0; i < 3; i++)
    {
        using TcpClient peer = await
            listener.AcceptTcpClientAsync();
        await Handle(peer.GetStream());
    }
});

async Task Handle(NetworkStream net)
{
    var (_, headers, _) =
        await ReadHead(net);
    string etag = Etag(report);
    headers.TryGetValue(
        "If-None-Match",
        out string? sent);

    if (sent == etag)
    {
        await net.WriteAsync(
            Encoding.ASCII.GetBytes(
            "HTTP/1.1 304 Not " +
            "Modified\r\n" +
            $"ETag: {etag}\r\n" +
            "Cache-Control: " +
            "max-age=60\r\n\r\n"));
        return;
    }

    byte[] payload = Encoding.ASCII
        .GetBytes(report);
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        "HTTP/1.1 200 OK\r\n" +
        $"ETag: {etag}\r\n" +
        "Cache-Control: " +
        "max-age=60\r\n" +
        "Content-Length: " +
        $"{payload.Length}\r\n\r\n"));
    await net.WriteAsync(payload);
}

static string Etag(string content) =>
    '"' + Convert.ToHexString(
        SHA256.HashData(
        Encoding.ASCII.GetBytes(
        content)))[..8] + '"';

async Task<(int Code, string? Etag,
    string Body)> Fetch(string? inm)
{
    using var tcp = new TcpClient();
    await tcp.ConnectAsync(
        IPAddress.Loopback, port);
    NetworkStream net = tcp.GetStream();
    string req = "GET /report" +
        " HTTP/1.1\r\n";
    if (inm is not null)
        req += "If-None-Match: " +
            $"{inm}\r\n";
    req += "\r\n";
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(req));
    var (head, headers, prefix) =
        await ReadHead(net);
    string body = await ReadBody(
        net, headers, prefix);
    headers.TryGetValue(
        "ETag", out string? tag);
    return (int.Parse(
        head.Split(' ')[1]),
        tag, body);
}

var first = await Fetch(null);
Console.WriteLine(
    $"1st GET  {first.Code} " +
    $"etag {first.Etag}");

var again = await Fetch(
    first.Etag);
Console.WriteLine(
    $"2nd GET  {again.Code} " +
    $"bytes {again.Body.Length}");

report = "Q3 total: 44 units.";
var changed = await Fetch(
    first.Etag);
Console.WriteLine(
    $"3rd GET  {changed.Code} " +
    $"etag {changed.Etag}");

await server;
listener.Stop();

static async Task<(string First,
    Dictionary<string, string> Headers,
    string Prefix)> ReadHead(
    NetworkStream net)
{
    var raw = new StringBuilder();
    var buf = new byte[1024];
    int end;
    while ((end = raw.ToString()
        .IndexOf("\r\n\r\n", Ordinal))
        < 0)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        raw.Append(Encoding.ASCII
            .GetString(buf, 0, n));
    }
    string all = raw.ToString();
    string[] lines = all[..end]
        .Split("\r\n");
    var headers = new Dictionary<
        string, string>(
        StringComparer.OrdinalIgnoreCase);
    foreach (string line in
        lines.Skip(1))
    {
        int colon = line.IndexOf(':');
        if (colon > 0)
            headers[line[..colon].Trim()]
                = line[(colon + 1)..]
                    .Trim();
    }
    return (lines[0], headers,
        all[(end + 4)..]);
}

static async Task<string> ReadBody(
    NetworkStream net,
    Dictionary<string, string> headers,
    string prefix)
{
    int want = 0;
    if (headers.TryGetValue(
        "Content-Length",
        out string? len))
        want = int.Parse(len);
    var buf = new byte[1024];
    string body = prefix;
    while (body.Length < want)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        body += Encoding.ASCII
            .GetString(buf, 0, n);
    }
    return body;
}
```

```text output
1st GET  200 etag "0E0997FF"
2nd GET  304 bytes 0
3rd GET  200 etag "31DB2273"
```

The second request sends the same `If-None-Match` value the server just handed out and gets `304` with zero body bytes back. The third request sends that *same, now-stale* value again, but the report changed underneath it in between, so the hash the server computes no longer matches, and it falls back to a full `200` with a new tag. Nothing here trusts the client's memory of when it last asked; the server recomputes and compares every time.

::::exercise[What `no-store` rules out]
A response carries `Cache-Control: no-store`. RFC 9111 section 5.2.2.5 says a cache "must not store any part of either the immediate request or the response." Given that, can a shared cache still serve a `304` for that response later, the way the demo above does for `max-age`-governed content? Why or why not?

:::solution
No. A `304` response only makes sense as an instruction to *reuse a stored copy* ([RFC 9111, section 4.3.3](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.3)), and `no-store` forbids storing a copy in the first place. There is nothing to revalidate against, so every request for a `no-store` resource has to go all the way to the origin server, every time, regardless of how expensive that is. `no-cache` is the directive for "store it, but check with me before reusing it" — the one the demo's `max-age` plus `ETag` combination effectively refines by giving the check a cheap answer.
:::
::::

## Remembering a client between requests

HTTP is, by design, "a family of stateless, application-level, request/response protocols" ([RFC 9110, section 1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-1.1)): nothing about one request is remembered for the next unless something carries it across. A cookie is that something. A server hands one out with `Set-Cookie`, whose value is a name and a value plus optional attributes ([RFC 6265, section 4.1.1](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.1)); a client that keeps it sends only the name and value back on later requests to a matching host, in a `Cookie` header, with every attribute stripped ([section 4.2.1](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.2.1)). Three attributes worth reading on sight: `Path` narrows which requests get the cookie back ([section 4.1.2.4](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.4)); `HttpOnly` tells the browser to withhold the cookie from JavaScript entirely ([section 4.1.2.6](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.6)); `Secure` tells it never to send the cookie over plain HTTP ([section 4.1.2.5](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.5)).

```csharp run id=cookies
using System.Net;
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    for (int i = 0; i < 3; i++)
    {
        using TcpClient peer = await
            listener.AcceptTcpClientAsync();
        await Handle(peer.GetStream());
    }
});

async Task Handle(NetworkStream net)
{
    var (first, headers, _) =
        await ReadHead(net);
    string target =
        first.Split(' ')[1];
    string setCookie = "";
    string body;

    if (target == "/login")
    {
        setCookie = "Set-Cookie: " +
            "sid=demo42; Path=/; " +
            "HttpOnly\r\n";
        body = "logged in";
    }
    else if (headers.TryGetValue(
        "Cookie", out string? cookie)
        && cookie.Contains(
            "sid=demo42"))
    {
        body = "welcome back";
    }
    else
    {
        body = "who are you?";
    }

    byte[] payload = Encoding.ASCII
        .GetBytes(body);
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(
        "HTTP/1.1 200 OK\r\n" +
        setCookie +
        "Content-Length: " +
        $"{payload.Length}\r\n\r\n"));
    await net.WriteAsync(payload);
}

async Task<(string? Cookie,
    string Body)> Ask(
    string target, string? cookie)
{
    using var tcp = new TcpClient();
    await tcp.ConnectAsync(
        IPAddress.Loopback, port);
    NetworkStream net = tcp.GetStream();
    string req =
        $"GET {target} HTTP/1.1\r\n";
    if (cookie is not null)
        req += $"Cookie: {cookie}\r\n";
    req += "\r\n";
    await net.WriteAsync(
        Encoding.ASCII.GetBytes(req));
    var (_, headers, prefix) =
        await ReadHead(net);
    string body = await ReadBody(
        net, headers, prefix);
    headers.TryGetValue(
        "Set-Cookie", out string? sc);
    return (sc, body);
}

var login = await Ask("/login", null);
Console.WriteLine(
    $"{"login",-9}{login.Body}");
Console.WriteLine(
    $"{"cookie",-9}{login.Cookie}");

string jar = login.Cookie!
    .Split(';')[0];

var known = await Ask(
    "/profile", jar);
Console.WriteLine(
    $"{"known",-9}{known.Body}");

var anon = await Ask(
    "/profile", null);
Console.WriteLine(
    $"{"anon",-9}{anon.Body}");

await server;
listener.Stop();

static async Task<(string First,
    Dictionary<string, string> Headers,
    string Prefix)> ReadHead(
    NetworkStream net)
{
    var raw = new StringBuilder();
    var buf = new byte[1024];
    int end;
    while ((end = raw.ToString()
        .IndexOf("\r\n\r\n", Ordinal))
        < 0)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        raw.Append(Encoding.ASCII
            .GetString(buf, 0, n));
    }
    string all = raw.ToString();
    string[] lines = all[..end]
        .Split("\r\n");
    var headers = new Dictionary<
        string, string>(
        StringComparer.OrdinalIgnoreCase);
    foreach (string line in
        lines.Skip(1))
    {
        int colon = line.IndexOf(':');
        if (colon > 0)
            headers[line[..colon].Trim()]
                = line[(colon + 1)..]
                    .Trim();
    }
    return (lines[0], headers,
        all[(end + 4)..]);
}

static async Task<string> ReadBody(
    NetworkStream net,
    Dictionary<string, string> headers,
    string prefix)
{
    int want = 0;
    if (headers.TryGetValue(
        "Content-Length",
        out string? len))
        want = int.Parse(len);
    var buf = new byte[1024];
    string body = prefix;
    while (body.Length < want)
    {
        int n = await net.ReadAsync(buf);
        if (n == 0) break;
        body += Encoding.ASCII
            .GetString(buf, 0, n);
    }
    return body;
}
```

```text output
login    logged in
cookie   sid=demo42; Path=/; HttpOnly
known    welcome back
anon     who are you?
```

`jar` keeps only `login.Cookie!.Split(';')[0]`, the `sid=demo42` pair, and throws the `Path` and `HttpOnly` attributes away before the next request — a real client does the same, because the `Cookie` header's grammar has no room for attributes at all ([RFC 6265, section 4.2.1](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.2.1)). The third request, `anon`, deliberately sends no `Cookie` header, and the server has no way to tell it apart from a first-time visitor: the "memory" lives entirely in the header the client chooses to resend, not in the TCP connection or in any state the server keeps tied to a particular socket.

:::note[What a session id is standing in for]
`sid=demo42` is fixed here so the output is exact; a real login handler generates a long, unpredictable value per session, because a guessable one lets an attacker set `Cookie` to someone else's session and be treated as them.
:::

::::exercise[Find the bug in this jar]
A teammate's client code stores the *entire* `Set-Cookie` value, attributes included, and replays it verbatim as the `Cookie` header on the next request:

```text
string jar = login.Cookie!;
// jar = "sid=demo42; Path=/; HttpOnly"
var reply = await Ask(
    "/profile", jar);
```

What will a server that follows RFC 6265 section 4.2.1's `Cookie` grammar actually see, and why does that break the login check used above (`cookie.Contains("sid=demo42")`)?

:::solution
Nothing breaks the substring check in this particular server, because `"sid=demo42; Path=/; HttpOnly".Contains("sid=demo42")` is still `true` — but that is luck, not correctness. A server that parses `Cookie` properly reads it as a list of `cookie-pair`s separated by `; `, so it would try to look up cookies named `sid`, `Path` and `HttpOnly`, none of which except the first is a cookie the server ever set. Any handler that expects `Cookie` to contain exactly what it put in `Set-Cookie` breaks the moment it does a real lookup instead of a substring search, and sending attribute syntax back as if it were cookie data is outside the grammar the RFC defines for the request header in the first place.
:::
::::

## HTTP/1.1, HTTP/2 and HTTP/3 send the same semantics differently

Every method, status code and header used above means the same thing on any version; RFC 9110 defines that meaning once, and the version-specific RFCs only define how it is written onto a connection ([RFC 9110, section 1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-1.2)). What changed across versions is framing and transport, not semantics.

| Version | Connection model | Header encoding | Where head-of-line blocking is left |
|---|---|---|---|
| HTTP/1.1 | One response in flight at a time per connection, reused across requests | Plain text | A slow response blocks everything already queued behind it on that connection ([RFC 9112, section 9.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.3)) |
| HTTP/2 | Many streams multiplexed on one TCP connection ([RFC 9113, section 5](https://www.rfc-editor.org/rfc/rfc9113.html#section-5)) | HPACK-compressed ([RFC 7541](https://www.rfc-editor.org/rfc/rfc7541.html)) | A lost TCP segment stalls every stream, because TCP delivers to the application strictly in order ([RFC 9114, section 1.1](https://www.rfc-editor.org/rfc/rfc9114.html#section-1.1)) |
| HTTP/3 | Many streams on one QUIC connection, over UDP ([RFC 9000, section 1](https://www.rfc-editor.org/rfc/rfc9000.html#section-1)) | QPACK-compressed ([RFC 9204](https://www.rfc-editor.org/rfc/rfc9204.html)) | Gone at the transport layer: QUIC gives reliability per stream, so one stream's loss does not stall the others ([RFC 9114, section 1.2](https://www.rfc-editor.org/rfc/rfc9114.html#section-1.2)) |

The move from HTTP/1.1 to HTTP/2 solved queuing at the *application* layer: instead of six-ish parallel TCP connections each serializing its own queue of requests, one connection interleaves many streams, and HPACK avoids resending the same header names on every one of them. What HTTP/2 could not fix is the layer underneath it — a single TCP connection still delivers bytes to the application in one strict order, so one lost packet stalls every multiplexed stream until it is retransmitted, even the streams whose data already arrived. HTTP/3 replaces that transport instead of working around it: QUIC multiplexes streams itself, over UDP, so a lost packet only stalls the stream it belonged to.

::::exercise[Count what changes, not just what's better]
A page loads 30 small images from one origin. Over HTTP/1.1 with six connections open to that origin, requests queue five deep on average before every image starts downloading. Over HTTP/2, how many of those 30 need to queue behind another one on the same connection? Does moving to HTTP/3 change that count again, or does it change something else?

:::solution
Over HTTP/2, none of the 30 need to queue behind each other at the HTTP layer: one connection multiplexes all 30 streams, so every request can be sent as soon as the client decides to send it, with no six-way ceiling forcing five of them to wait their turn. HTTP/3 does not shrink that count further — HTTP/2 already got it to zero at its own layer. What HTTP/3 changes is what happens when a packet is lost partway through: under HTTP/2 that loss stalls all 30 streams until TCP retransmits it, because TCP does not know the 30 are independent; under HTTP/3 only the one QUIC stream carrying that packet stalls, because QUIC does.
:::
::::
