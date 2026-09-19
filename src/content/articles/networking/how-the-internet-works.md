---
title: "What Happens When You Request a URL, Step by Step in C#"
description: "Follow one request to example.com through DNS, TCP, TLS 1.3 and HTTP, reproducing every step from C# and timing each round trip on a real connection."
pillar: networking
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-18
level: beginner
tags: [dns, tcp, tls, http, network-layers]
prerequisites: []
sources:
  - title: "RFC 9110: HTTP Semantics"
    url: "https://www.rfc-editor.org/rfc/rfc9110.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 9112: HTTP/1.1"
    url: "https://www.rfc-editor.org/rfc/rfc9112.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 9113: HTTP/2"
    url: "https://www.rfc-editor.org/rfc/rfc9113.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 9114: HTTP/3"
    url: "https://www.rfc-editor.org/rfc/rfc9114.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3"
    url: "https://www.rfc-editor.org/rfc/rfc8446.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 6066: TLS Extensions: Extension Definitions (Server Name Indication)"
    url: "https://www.rfc-editor.org/rfc/rfc6066.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 7301: TLS Application-Layer Protocol Negotiation Extension"
    url: "https://www.rfc-editor.org/rfc/rfc7301.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 5116: An Interface and Algorithms for Authenticated Encryption"
    url: "https://www.rfc-editor.org/rfc/rfc5116.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 9293: Transmission Control Protocol (TCP)"
    url: "https://www.rfc-editor.org/rfc/rfc9293.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 6928: Increasing TCP's Initial Window"
    url: "https://www.rfc-editor.org/rfc/rfc6928.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 1034: Domain Names - Concepts and Facilities"
    url: "https://www.rfc-editor.org/rfc/rfc1034.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 1035: Domain Names - Implementation and Specification"
    url: "https://www.rfc-editor.org/rfc/rfc1035.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 8484: DNS Queries over HTTPS (DoH)"
    url: "https://www.rfc-editor.org/rfc/rfc8484.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 6797: HTTP Strict Transport Security (HSTS)"
    url: "https://www.rfc-editor.org/rfc/rfc6797.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 791: Internet Protocol"
    url: "https://www.rfc-editor.org/rfc/rfc791.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 792: Internet Control Message Protocol"
    url: "https://www.rfc-editor.org/rfc/rfc792.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 1122: Requirements for Internet Hosts - Communication Layers"
    url: "https://www.rfc-editor.org/rfc/rfc1122.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "Dns.GetHostAddresses Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostaddresses"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "SslClientAuthenticationOptions Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.security.sslclientauthenticationoptions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "HttpClient guidelines for .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Example Domains"
    url: "https://www.iana.org/help/example-domains"
    publisher: "IANA"
    accessed: 2026-09-18
draft: true
---

Requesting `https://example.com/` is four separate conversations, held one after another: a DNS lookup that turns the name into an address, a TCP handshake that opens a connection to that address, a TLS handshake that encrypts the connection and proves who is at the other end, and an HTTP exchange that finally asks for the page. On a fresh connection each of the four costs one network round trip (the time for a packet to reach the other end and the answer to come back, abbreviated RTT), and nothing in a later conversation can start until the earlier one has finished.

<figure class="diagram">
<svg viewBox="0 0 360 480" role="img" aria-labelledby="seq-title seq-desc">
<title id="seq-title">The four exchanges behind one HTTPS request</title>
<desc id="seq-desc">A sequence diagram with your machine on the left and the remote end on the right. Four bands follow each other downwards: a DNS query and answer, the three TCP handshake segments, the three TLS 1.3 handshake flights, and the HTTP request and response. Each band is marked as one round trip. TLS messages after ServerHello and both HTTP messages are drawn in the accent colour because they are encrypted.</desc>
<defs>
<marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="seq-arrow-acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="50" y="20" text-anchor="middle" class="d-bold d-small">your machine</text>
<text x="310" y="20" text-anchor="middle" class="d-bold d-small">other end</text>
<path d="M50 52 V120 M50 142 V236 M50 258 V352 M50 374 V440" class="d-line d-dashed"/>
<path d="M310 52 V120 M310 142 V236 M310 258 V352 M310 374 V440" class="d-line d-dashed"/>
<rect x="10" y="30" width="340" height="22" rx="4" class="d-box-2"/>
<text x="18" y="46" class="d-small d-bold">1 DNS: a resolver, port 53</text>
<text x="342" y="46" text-anchor="end" class="d-small d-muted">1 RTT</text>
<text x="180" y="72" text-anchor="middle" class="d-small d-mono">example.com A?</text>
<path d="M54 78 H306" class="d-line" marker-end="url(#seq-arrow)"/>
<text x="180" y="98" text-anchor="middle" class="d-small">addresses, each with a lifetime</text>
<path d="M306 104 H54" class="d-line" marker-end="url(#seq-arrow)"/>
<rect x="10" y="120" width="340" height="22" rx="4" class="d-box-2"/>
<text x="18" y="136" class="d-small d-bold">2 TCP: the web server, port 443</text>
<text x="342" y="136" text-anchor="end" class="d-small d-muted">1 RTT</text>
<text x="180" y="162" text-anchor="middle" class="d-small d-mono">SYN</text>
<path d="M54 168 H306" class="d-line" marker-end="url(#seq-arrow)"/>
<text x="180" y="188" text-anchor="middle" class="d-small d-mono">SYN + ACK</text>
<path d="M306 194 H54" class="d-line" marker-end="url(#seq-arrow)"/>
<text x="180" y="214" text-anchor="middle" class="d-small d-mono">ACK</text>
<path d="M54 220 H306" class="d-line" marker-end="url(#seq-arrow)"/>
<rect x="10" y="236" width="340" height="22" rx="4" class="d-box-2"/>
<text x="18" y="252" class="d-small d-bold">3 TLS 1.3: same connection</text>
<text x="342" y="252" text-anchor="end" class="d-small d-muted">1 RTT</text>
<text x="180" y="278" text-anchor="middle" class="d-small">ClientHello: name, key share</text>
<path d="M54 284 H306" class="d-line" marker-end="url(#seq-arrow)"/>
<text x="180" y="304" text-anchor="middle" class="d-small">ServerHello, <tspan class="d-text-accent">{certificate, Finished}</tspan></text>
<path d="M306 310 H54" class="d-accent" marker-end="url(#seq-arrow-acc)"/>
<text x="180" y="330" text-anchor="middle" class="d-small d-text-accent">{Finished}</text>
<path d="M54 336 H306" class="d-accent" marker-end="url(#seq-arrow-acc)"/>
<rect x="10" y="352" width="340" height="22" rx="4" class="d-box-2"/>
<text x="18" y="368" class="d-small d-bold">4 HTTP: same connection</text>
<text x="342" y="368" text-anchor="end" class="d-small d-muted">1 RTT</text>
<text x="180" y="394" text-anchor="middle" class="d-small d-mono d-text-accent">{GET / HTTP/1.1 ...}</text>
<path d="M54 400 H306" class="d-accent" marker-end="url(#seq-arrow-acc)"/>
<text x="180" y="420" text-anchor="middle" class="d-small d-mono d-text-accent">{HTTP/1.1 200 OK ...}</text>
<path d="M306 426 H54" class="d-accent" marker-end="url(#seq-arrow-acc)"/>
<text x="10" y="458" class="d-small d-muted">{ } and accent colour: encrypted on the wire.</text>
<text x="10" y="474" class="d-small d-muted">The last arrow of a band leaves with the first of the next.</text>
</svg>
<figcaption>Figure 1. One request, four exchanges. Each band has to finish before the next can begin, and each costs one round trip, so the page cannot start arriving until four round trips have passed.</figcaption>
</figure>

The rest of this page performs each band from a C# program, against the real `example.com`, and then looks underneath at the packets that carried all of it. IANA keeps `example.com` online for documentation and says it may be used in examples without asking, though it warns against building anything that depends on its web server ([IANA, Example Domains](https://www.iana.org/help/example-domains)). That warning applies here: the output panels use `[...]` wherever a value depends on your network, the date, or how that server is configured this month.

## The URL already says which conversations are needed

Nothing has touched the network yet, and the URL has already fixed most of the plan. `Uri` splits it the way a browser does:

```csharp run id=parts
var url = new Uri(
    "https://example.com" +
    "/docs/intro?lang=en#setup");

Show("scheme", url.Scheme);
Show("host", url.Host);
Show("port", url.Port);
Show("path", url.AbsolutePath);
Show("query", url.Query);
Show("fragment", url.Fragment);

static void Show(string part, object value) =>
    Console.WriteLine($"{part,-9} {value}");
```

```text output
scheme    https
host      example.com
port      443
path      /docs/intro
query     ?lang=en
fragment  #setup
```

Each part is consumed by a different step:

- **The scheme** decides whether there is a TLS step at all, and supplies the port when the URL gives none: 80 for `http`, 443 for `https` ([RFC 9110, sections 4.2.1 and 4.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-4.2.1)). The URL above contains no `443`; `Uri` filled it in from the scheme.
- **The host** is what DNS resolves, and it is used twice more: TLS checks the server's certificate against it, and HTTP repeats it in the `Host` header.
- **The path and query** travel inside the HTTP request and nowhere else.
- **The fragment** goes nowhere. The target of an HTTP request excludes the fragment, which is kept for the client to use after the response arrives, for example to scroll to a heading ([RFC 9110, section 7.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.1)). You will see it missing from a captured request [further down](#the-request-a-real-client-writes).

If you type a bare `example.com`, the browser has to pick a scheme before any of this. One rule for that is written down: when a site has previously sent a `Strict-Transport-Security` header over HTTPS, the browser must rewrite `http` to `https` for that host before making the request, without asking the network first ([RFC 6797, section 8.3](https://www.rfc-editor.org/rfc/rfc6797.html#section-8.3)).

::::exercise[Plan a request from its URL]
A program is given `http://shop.example:8080/cart items?id=7#total`. Before it sends a byte, decide: which port does it connect to, is there a TLS handshake, what is the first line of the request, and what goes in the `Host` header?

:::solution
Port 8080 (an explicit port beats the scheme's default), no TLS (the scheme is `http`), and the fragment is dropped. The space in the path is not legal in a request line, so `Uri` percent-encodes it. The `Host` header carries the port whenever it is not the default for the scheme.

```csharp run
var url = new Uri(
    "http://shop.example:8080" +
    "/cart items?id=7#total");

bool tls = url.Scheme == "https";
string target = url.PathAndQuery;

Console.WriteLine($"connect  port {url.Port}");
Console.WriteLine($"TLS      {tls}");
Console.WriteLine($"line 1   GET {target} HTTP/1.1");
Console.WriteLine($"line 2   Host: {url.Authority}");
```

```text output
connect  port 8080
TLS      False
line 1   GET /cart%20items?id=7 HTTP/1.1
line 2   Host: shop.example:8080
```
:::
::::

## Band 1: the name becomes an address

Packets are delivered to IP addresses, not names, so the host name has to be translated first. The domain name system stores that mapping as a tree of names split into *zones*, each run by whoever is responsible for that part of the tree ([RFC 1034, sections 3.1 and 4.2](https://www.rfc-editor.org/rfc/rfc1034.html#section-3.1)). No single server holds everything, so answering `example.com` from scratch means asking a root server, being referred to the servers for `com`, and being referred again to the servers for `example.com`, which hold the address record ([RFC 1034, section 5.3.3](https://www.rfc-editor.org/rfc/rfc1034.html#section-5.3.3)).

Your program does none of that walking. It contains what RFC 1034 calls a *stub resolver*: it sends one question to a *recursive* server (usually run by your ISP, your router or a public DNS service) and that server follows the referrals and returns a finished answer ([RFC 1034, sections 4.3.1 and 5.3.1](https://www.rfc-editor.org/rfc/rfc1034.html#section-5.3.1)). The question normally travels as a single UDP packet to port 53 ([RFC 1035, section 4.2](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.2)), which is why band 1 in Figure 1 has no handshake of its own. Some browsers send the same question inside an HTTPS request to a resolver instead ([RFC 8484](https://www.rfc-editor.org/rfc/rfc8484.html)); the answer is the same kind of record either way.

This program asks twice and times both:

```csharp run id=lookup
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

const string host = "example.com";
try
{
    var clock = Stopwatch.StartNew();
    IPAddress[] found =
        await Dns.GetHostAddressesAsync(host);
    TimeSpan first = clock.Elapsed;

    clock.Restart();
    await Dns.GetHostAddressesAsync(host);
    TimeSpan second = clock.Elapsed;

    Console.WriteLine(
        $"{found.Length} found, first {found[0]}");
    Report("first lookup", first);
    Report("second lookup", second);
}
catch (SocketException e)
{
    Console.WriteLine(
        $"lookup failed: {e.SocketErrorCode}");
}

static void Report(string what, TimeSpan t) =>
    Console.WriteLine(
        $"{what,-14}{t.TotalMilliseconds,6:F1} ms");
```

```text output
[...] found, first [...]
first lookup  [...] ms
second lookup [...] ms
```

On the machine used for this page (Windows 11, x64, .NET SDK 10.0.302, a consumer broadband line) the first line reported two addresses, both IPv4. The first lookup took between 17 and 39 ms over several runs and the second took under 1 ms every time. Your addresses and times will differ; the gap between the two lines should not.

The gap is caching. Every DNS record carries a time to live, the number of seconds it may be reused before it has to be fetched again ([RFC 1034, section 3.6](https://www.rfc-editor.org/rfc/rfc1034.html#section-3.6)), and resolvers at every level keep answers for that long. The second call never left the machine. The first one left the machine but almost certainly did not walk the tree either, because the recursive server had the record cached from somebody else's request.

:::dotnet
`Dns.GetHostAddressesAsync` is not a DNS client. It calls the operating system's name resolution API (`getaddrinfo` on Windows), so an entry in the `hosts` file wins without any DNS query, and IPv6 addresses are filtered out if the machine has no IPv6 installed ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostaddresses#remarks)). The cache that answered the second call belongs to the operating system, not to .NET.
:::

A name can map to several addresses, as it did here. The client picks one and moves on; the others are alternatives if the connection fails.

## Bands 2 and 4 first: TCP and HTTP with the encryption left out

TLS exists to make the conversation unreadable to anyone watching, which makes it a poor place to start reading. `example.com` also answers unencrypted HTTP on port 80, so this program skips band 3, opens a TCP connection, and types the request by hand.

```csharp run id=plain
using System.Net;
using System.Net.Sockets;
using System.Text;

const string host = "example.com";
string request =
    "GET / HTTP/1.1\r\n" +
    $"Host: {host}\r\n" +
    "Connection: close\r\n" +
    "\r\n";

using var tcp = new TcpClient();
using var limit = new CancellationTokenSource(
    TimeSpan.FromSeconds(10));
CancellationToken stop = limit.Token;
try
{
    await tcp.ConnectAsync(host, 80, stop);
    Socket socket = tcp.Client;
    var near = (IPEndPoint)socket.LocalEndPoint!;
    var far = (IPEndPoint)socket.RemoteEndPoint!;
    Console.WriteLine($"local port   {near.Port}");
    Console.WriteLine($"remote port  {far.Port}");

    NetworkStream stream = tcp.GetStream();
    byte[] bytes =
        Encoding.ASCII.GetBytes(request);
    await stream.WriteAsync(bytes, stop);
    Console.WriteLine(
        $"sent         {bytes.Length} bytes");

    using var all = new MemoryStream();
    await stream.CopyToAsync(all, stop);
    Console.WriteLine(
        $"received     {all.Length} bytes");

    string reply =
        Encoding.UTF8.GetString(all.ToArray());
    int blank = reply.IndexOf("\r\n\r\n");
    string[] head =
        reply[..blank].Split("\r\n");
    string body = reply[(blank + 4)..];

    Console.WriteLine();
    Console.WriteLine(head[0]);
    Console.WriteLine(
        $"header lines: {head.Length - 1}");
    Console.WriteLine(
        head.First(IsFraming));
    Console.WriteLine();
    Console.WriteLine("body starts:");
    Console.WriteLine(
        body[..24].Replace("\r\n", "\\r\\n"));
}
catch (Exception e) when (
    e is SocketException
      or IOException
      or OperationCanceledException)
{
    Console.WriteLine($"no network: {e.Message}");
}

static bool IsFraming(string line) =>
    line.StartsWith("Content-Length:") ||
    line.StartsWith("Transfer-Encoding:");
```

```text output
local port   [...]
remote port  80
sent         56 bytes
received     [...] bytes

HTTP/1.1 200 OK
header lines: [...]
[...]

body starts:
[...]
```

The last three wildcards hide values that depend on how the server is set up on the day. When this was run for the article, the bottom of the panel read:

```text
header lines: 11
Transfer-Encoding: chunked

body starts:
22f\r\n<!doctype html><htm
```

### What `ConnectAsync` did

`ConnectAsync` was given a name, so it repeated band 1 internally, then performed the TCP three-way handshake with the address it got. The client sends a segment with the SYN flag and a starting sequence number; the server answers with its own SYN and an acknowledgment of the client's; the client acknowledges that ([RFC 9293, section 3.5](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5)). The numbers exchanged are what let each side later detect missing, duplicated or reordered bytes. The client's side of the connection is established as soon as the server's SYN + ACK arrives (the state diagram in the same section shows it), so the time `ConnectAsync` takes with an IP address is a fair measurement of one round trip to the server.

The two port lines show how the connection is identified. Port 80 was the program's choice; the local port was picked by the operating system and changes on every run. A TCP connection is defined by the pair of endpoints, that is, the two addresses and the two ports together ([RFC 9293, section 3.4.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.4.1)), which is how one server port 80 can hold thousands of conversations at once and how your machine can hold several to the same server.

### What the 56 bytes were

Those 56 bytes are a complete HTTP/1.1 request. The format is a start line, then header lines, then an empty line, each ended by a carriage return and line feed ([RFC 9112, section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-2.1)). The start line is a method, a target and a version separated by single spaces ([section 3](https://www.rfc-editor.org/rfc/rfc9112.html#section-3)).

`Host` is the one header that every HTTP/1.1 request must carry ([RFC 9112, section 3.2](https://www.rfc-editor.org/rfc/rfc9112.html#section-3.2)). It looks redundant, because the connection already goes to that host's address, but the address is frequently shared by many sites and the header is how the server tells them apart. `Connection: close` asks the server to close the connection after this response. Without it an HTTP/1.1 connection stays open for more requests ([RFC 9112, section 9.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.3)) and `CopyToAsync`, which reads until the other side closes, would wait for the 10-second limit.

### Where the response ends

TCP delivers a stream of bytes. It promises the bytes arrive complete and in order, and explicitly promises nothing about how they are grouped: what one side sends in a single write may arrive as several reads, or merged with the next write ([RFC 9293, section 3.7](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.7)). So HTTP has to mark the end of a message itself, and the `22f` at the start of the body is how this server did it. With `Transfer-Encoding: chunked`, the body is sent as pieces, each preceded by its length in hexadecimal on a line of its own, and finished by a piece of length zero ([RFC 9112, section 7.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1)). `22f` is 559: the next 559 bytes are HTML, and the `0` that follows them is the end. A server that knows the size in advance sends `Content-Length` instead, and a client has to handle both ([RFC 9112, section 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)).

:::pitfall
Code that calls `Read` once and treats the result as "the response" works on a fast local network and fails elsewhere, because a read returns whatever bytes have arrived so far. Read until the framing says the message is complete: the blank line for the header section, then `Content-Length` bytes or the zero-length chunk for the body.
:::

::::exercise[Delete the Host header]
Remove the `Host` line from the request above, so the program sends only the request line, `Connection: close` and the blank line. The TCP connection will still succeed. What does the server do?

:::solution
It answers, and the answer is an error. RFC 9112 section 3.2 requires a server to reply `400 Bad Request` to an HTTP/1.1 request with no `Host` header, and this one does. The connection reached a machine that serves many sites, and the request did not say which one it wanted.

```csharp run
using System.Net.Sockets;
using System.Text;

using var tcp = new TcpClient();
using var limit = new CancellationTokenSource(
    TimeSpan.FromSeconds(10));
CancellationToken stop = limit.Token;
try
{
    await tcp.ConnectAsync(
        "example.com", 80, stop);
    NetworkStream stream = tcp.GetStream();
    byte[] request = Encoding.ASCII.GetBytes(
        "GET / HTTP/1.1\r\n" +
        "Connection: close\r\n" +
        "\r\n");
    await stream.WriteAsync(request, stop);

    using var reader = new StreamReader(stream);
    Console.WriteLine(
        await reader.ReadLineAsync(stop));
}
catch (Exception e) when (
    e is SocketException
      or IOException
      or OperationCanceledException)
{
    Console.WriteLine($"no network: {e.Message}");
}
```

```text output
HTTP/1.1 400 Bad Request
```
:::
::::

## Band 3: the same request, inside TLS

Everything the last program sent and received was readable by every network it crossed. HTTPS is the same HTTP exchange carried inside a TLS channel, which RFC 8446 defines by three properties: the server is authenticated, the data is visible only to the two endpoints, and it cannot be modified in transit without detection ([RFC 8446, section 1](https://www.rfc-editor.org/rfc/rfc8446.html#section-1)).

In code, that is one more stream wrapped around the TCP stream. This program performs all four bands and times each.

```csharp run id=secure
using System.Diagnostics;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text;

const string host = "example.com";
using var limit = new CancellationTokenSource(
    TimeSpan.FromSeconds(10));
CancellationToken stop = limit.Token;
try
{
    var clock = Stopwatch.StartNew();
    IPAddress[] found = await
        Dns.GetHostAddressesAsync(host, stop);
    double dnsMs = Lap(clock);

    using var tcp = new TcpClient();
    await tcp.ConnectAsync(found[0], 443, stop);
    double tcpMs = Lap(clock);

    using var tls =
        new SslStream(tcp.GetStream());
    var options =
        new SslClientAuthenticationOptions
        {
            TargetHost = host,
            ApplicationProtocols =
                [SslApplicationProtocol.Http11],
        };
    await tls.AuthenticateAsClientAsync(
        options, stop);
    double tlsMs = Lap(clock);

    byte[] request = Encoding.ASCII.GetBytes(
        "GET / HTTP/1.1\r\n" +
        $"Host: {host}\r\n" +
        "Connection: close\r\n" +
        "\r\n");
    await tls.WriteAsync(request, stop);
    using var reader = new StreamReader(tls);
    string? status =
        await reader.ReadLineAsync(stop);
    double httpMs = Lap(clock);

    var cert = tls.RemoteCertificate!;
    string issuer = cert.Issuer.Split(", ")[0];
    Show("version", tls.SslProtocol);
    Show("cipher", tls.NegotiatedCipherSuite);
    Show("alpn",
        tls.NegotiatedApplicationProtocol);
    Show("subject", cert.Subject);
    Show("issuer", issuer);
    Show("reply", status);
    Console.WriteLine();
    Time("1 DNS lookup", dnsMs);
    Time("2 TCP handshake", tcpMs);
    Time("3 TLS handshake", tlsMs);
    Time("4 HTTP, 1st line", httpMs);
}
catch (Exception e) when (
    e is SocketException
      or IOException
      or AuthenticationException
      or OperationCanceledException)
{
    Console.WriteLine($"no network: {e.Message}");
}

static double Lap(Stopwatch clock)
{
    double ms = clock.Elapsed.TotalMilliseconds;
    clock.Restart();
    return ms;
}

static void Show(string what, object? value) =>
    Console.WriteLine($"{what,-8} {value}");

static void Time(string what, double ms) =>
    Console.WriteLine($"{what,-17}{ms,6:F1} ms");
```

```text output
version  Tls13
cipher   [...]
alpn     http/1.1
subject  CN=example.com
issuer   [...]
reply    HTTP/1.1 200 OK

1 DNS lookup      [...] ms
2 TCP handshake   [...] ms
3 TLS handshake   [...] ms
4 HTTP, 1st line  [...] ms
```

The request text is byte for byte the one from the previous section, and so is the status line that came back. What changed is that both went through `tls` instead of straight into the TCP stream. (`version` is a literal in the panel because this server and this operating system both support TLS 1.3; an older client would negotiate 1.2 and print `Tls12`.)

### What the handshake exchanged

The TLS 1.3 handshake is three flights ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)):

1. **ClientHello**, unencrypted, because no keys exist yet. It carries the client's half of a key exchange, the cipher suites it supports, and extensions. Two extensions matter here. *Server Name Indication* is the host name, sent so that a server holding certificates for many sites at one address can choose the right one ([RFC 6066, section 3](https://www.rfc-editor.org/rfc/rfc6066.html#section-3)). *ALPN* is the list of application protocols the client is willing to speak over this connection ([RFC 7301, section 3.1](https://www.rfc-editor.org/rfc/rfc7301.html#section-3.1)).
2. **ServerHello**, with the server's half of the key exchange. Both sides can now compute the same keys, and everything after ServerHello is encrypted ([RFC 8446, section 1.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-1.2)): the server's certificate, a signature made with the certificate's private key over the handshake so far, and a Finished message.
3. The client's **Finished**. The client does not have to wait for anything after sending it, so the HTTP request leaves right behind it.

That is one round trip before the request can go, and it is why band 3 in Figure 1 is no taller than band 2. If you have read a description with a longer exchange in which the client encrypts a secret with the server's public key, it describes an older TLS version, not the one negotiated here.

`TargetHost` did two jobs. It was checked against the certificate: the `https` scheme requires the client to verify that the certificate is valid for the host in the URL ([RFC 9110, section 4.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-4.3.4)), and `SslStream` uses `TargetHost` for that validation ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.net.security.sslclientauthenticationoptions#properties)). This matters more than it may seem, because the program connected to `found[0]`, a bare IP address that came from an unauthenticated DNS answer. The certificate check is what ties the machine that answered back to the name you typed. `TargetHost` was also the name sent in the ClientHello, which the next program shows by changing it.

The program offered only `http/1.1` in ALPN because that is the only protocol it can speak. A browser offers `h2` first, and a server that picks it switches the connection to HTTP/2 ([RFC 9113, section 3.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-3.2)). The negotiation rides inside the two Hello messages and costs no extra round trip ([RFC 7301, section 1](https://www.rfc-editor.org/rfc/rfc7301.html#section-1)).

### One address, several certificates

This program connects three times to the same IP address, the one DNS returned for `example.com`, and changes only the name it asks for.

```csharp run id=names
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;

string[] names =
[
    "example.com",
    "example.org",
    "wrong-name.test",
];
using var limit = new CancellationTokenSource(
    TimeSpan.FromSeconds(15));
CancellationToken stop = limit.Token;
try
{
    IPAddress[] found = await
        Dns.GetHostAddressesAsync("example.com");
    IPAddress address = found[0];

    foreach (string name in names)
    {
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(address, 443, stop);
        using var tls =
            new SslStream(tcp.GetStream());
        var options =
            new SslClientAuthenticationOptions
            {
                TargetHost = name,
            };
        try
        {
            await tls.AuthenticateAsClientAsync(
                options, stop);
            var cert = tls.RemoteCertificate!;
            Console.WriteLine(
                $"{name,-16} {cert.Subject}");
        }
        catch (AuthenticationException)
        {
            Console.WriteLine(
                $"{name,-16} refused");
        }
    }
}
catch (Exception e) when (
    e is SocketException
      or IOException
      or OperationCanceledException)
{
    Console.WriteLine($"no network: {e.Message}");
}
```

```text output
example.com      CN=example.com
example.org      CN=example.org
wrong-name.test  refused
```

The same address and port presented a different certificate for each name it serves, and ended the handshake for a name it does not. The only thing that differed between the three attempts was `TargetHost`, so that is what reached the server in the ClientHello.

It also shows the limit of what HTTPS hides. Anyone on the path can still see the IP addresses, the ports, the size and timing of what is sent, and the host name, because the ClientHello that carries it is sent before encryption starts. The path, the query string, the headers and the body are inside the encrypted channel.

## The request a real client writes

`HttpClient` does the four bands for you. To see what it puts on the wire, this program plays the server as well: it listens on a loopback port, prints whatever arrives, and replies with a minimal response. It runs without a network, and it is given the URL from the first section, fragment included.

```csharp run id=capture
using System.Net;
using System.Net.Sockets;
using System.Text;

var listener =
    new TcpListener(IPAddress.Loopback, 0);
listener.Start();
var bound = (IPEndPoint)listener.LocalEndpoint;
int port = bound.Port;

Task server = Task.Run(async () =>
{
    using TcpClient peer =
        await listener.AcceptTcpClientAsync();
    NetworkStream stream = peer.GetStream();

    var seen = new StringBuilder();
    var buffer = new byte[1024];
    while (!$"{seen}".EndsWith("\r\n\r\n"))
    {
        int n = await stream.ReadAsync(buffer);
        if (n == 0) break;
        seen.Append(
            Encoding.ASCII.GetString(buffer, 0, n));
    }
    Console.WriteLine("server read:");
    Console.Write(
        $"{seen}".Replace("\r\n", "\\r\\n\n"));

    string body = "hello over loopback";
    byte[] reply = Encoding.ASCII.GetBytes(
        "HTTP/1.1 200 OK\r\n" +
        "Content-Type: text/plain\r\n" +
        $"Content-Length: {body.Length}\r\n" +
        "Connection: close\r\n" +
        "\r\n" + body);
    await stream.WriteAsync(reply);
});

using var http = new HttpClient();
string text = await http.GetStringAsync(
    $"http://127.0.0.1:{port}" +
    "/docs/intro?lang=en#setup");
await server;
listener.Stop();

Console.WriteLine("client got:");
Console.WriteLine(text);
```

```text output
server read:
GET /docs/intro?lang=en HTTP/1.1\r\n
Host: 127.0.0.1:[...]\r\n
\r\n
client got:
hello over loopback
```

By default `HttpClient` sends less than the hand-written request did: the request line, `Host`, and the blank line. The path and query arrived; `#setup` did not. `Host` carries the port because it is not the default for `http`. The server loop follows the advice in the pitfall above and reads until it has seen the blank line, however many reads that takes.

A browser's request for the same URL would have the same first two lines, followed by more headers describing the browser and what it accepts. Over HTTP/2 or HTTP/3 it would not be text at all: HTTP/2 sends binary frames and carries the method, scheme, host and path as the fields `:method`, `:scheme`, `:authority` and `:path` ([RFC 9113, section 8.3.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3.1)). The meaning is unchanged. Methods, status codes and headers are defined once, in RFC 9110, and all three versions are different ways of writing them onto a connection ([RFC 9110, section 1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-1.2)).

## Underneath: every message above was cut into packets

None of the programs so far has mentioned a router. That is by design. `TcpClient` gives you a reliable pipe, and the machinery that builds that pipe out of an unreliable network sits below it.

On the way out of the machine, each layer wraps what it is handed in its own header and passes the result down.

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="enc-title enc-desc">
<title id="enc-title">Encapsulation of the 56-byte HTTP request</title>
<desc id="enc-desc">Five rows, each wider than the one above. The HTTP request becomes the encrypted payload of a TLS record, which becomes the payload of a TCP segment, which becomes the payload of an IP packet, which becomes the payload of a link-layer frame. Each row adds a header on the left; TLS and the link layer also add a trailer on the right.</desc>
<text x="10" y="18" class="d-small d-bold">HTTP request: 56 bytes of text</text>
<rect x="200" y="26" width="90" height="32" class="d-box-accent"/>
<text x="245" y="47" text-anchor="middle" class="d-small d-bold">GET / ...</text>
<text x="10" y="86" class="d-small d-bold">TLS record: +5 header, +1 type, +16 tag = 78</text>
<rect x="160" y="94" width="40" height="32" class="d-box"/>
<text x="180" y="115" text-anchor="middle" class="d-small">TLS</text>
<rect x="200" y="94" width="90" height="32" class="d-box-accent"/>
<text x="245" y="115" text-anchor="middle" class="d-small">encrypted</text>
<rect x="290" y="94" width="30" height="32" class="d-box"/>
<text x="305" y="115" text-anchor="middle" class="d-small">tag</text>
<text x="10" y="154" class="d-small d-bold">TCP segment: +20 or more; ports, sequence no.</text>
<rect x="110" y="162" width="50" height="32" class="d-box"/>
<text x="135" y="183" text-anchor="middle" class="d-small">TCP</text>
<rect x="160" y="162" width="160" height="32" class="d-box-2"/>
<text x="240" y="183" text-anchor="middle" class="d-small d-muted">TLS record</text>
<text x="10" y="222" class="d-small d-bold">IPv4 packet: +20 or more; addresses, TTL</text>
<rect x="60" y="230" width="50" height="32" class="d-box"/>
<text x="85" y="251" text-anchor="middle" class="d-small">IP</text>
<rect x="110" y="230" width="210" height="32" class="d-box-2"/>
<text x="215" y="251" text-anchor="middle" class="d-small d-muted">TCP segment</text>
<text x="10" y="290" class="d-small d-bold">Link frame: Ethernet or Wi-Fi header, trailer</text>
<rect x="10" y="298" width="50" height="32" class="d-box"/>
<text x="35" y="319" text-anchor="middle" class="d-small">link</text>
<rect x="60" y="298" width="260" height="32" class="d-box-2"/>
<text x="190" y="319" text-anchor="middle" class="d-small d-muted">IP packet</text>
<rect x="320" y="298" width="30" height="32" class="d-box"/>
<text x="335" y="319" text-anchor="middle" class="d-small">chk</text>
<text x="10" y="354" class="d-small d-muted">Routers replace the bottom row at every hop, edit the</text>
<text x="10" y="368" class="d-small d-muted">TTL in the IP row, and do not look further up.</text>
</svg>
<figcaption>Figure 2. The request from the TLS program on its way out. Each layer treats the row above as opaque bytes and adds its own header. Boxes are not to scale.</figcaption>
</figure>

The numbers in Figure 2 come from the specifications. A TLS 1.3 record has a 5-byte header, and the encrypted part holds the data plus one byte giving its real type ([RFC 8446, sections 5.1 and 5.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-5.2)); the AES-GCM ciphers, one of which was negotiated above, append a 16-byte authentication tag ([RFC 5116, section 5.2](https://www.rfc-editor.org/rfc/rfc5116.html#section-5.2)). A TCP header is at least 20 bytes and begins with the two 16-bit port numbers ([RFC 9293, section 3.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.1)). An IPv4 header is at least 20 bytes ([RFC 791, section 3.1](https://www.rfc-editor.org/rfc/rfc791.html#section-3.1)). So the 56 bytes you wrote cross the network as at least 118, before the link layer adds its own.

IP is where the network stops making promises. It moves each packet, independently, one hop closer to the destination address, with no acknowledgments and no retransmission ([RFC 791, section 1.4](https://www.rfc-editor.org/rfc/rfc791.html#section-1.4)). In the architecture RFC 1122 describes, routers keep no connection state and forward each packet independently; everything needed for reliability lives in the two end hosts ([RFC 1122, section 1.1.2](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.2)). The ordering and completeness that the HTTP code relied on were built by TCP at the two ends, from the sequence numbers set up in band 2, by resending whatever was not acknowledged.

### Counting the hops

One field of the IP header can be used to make the routers visible. Every router that forwards a packet must reduce its time to live (TTL) by at least one, and a packet whose TTL reaches zero is destroyed ([RFC 791, section 3.2](https://www.rfc-editor.org/rfc/rfc791.html#section-3.2)), which stops a misrouted packet from circulating forever. The router that destroys it may send an ICMP "time exceeded" message back to the sender ([RFC 792](https://www.rfc-editor.org/rfc/rfc792.html)). Send a packet with TTL 1 and the first router reports itself; TTL 2 reaches the second; and so on until the destination answers. This is the method behind the `tracert` and `traceroute` commands, written out with `Ping`:

```csharp run id=hops
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

try
{
    IPAddress[] found = await
        Dns.GetHostAddressesAsync("example.com");
    using var ping = new Ping();
    var wait = TimeSpan.FromSeconds(2);
    int answered = 0, silent = 0, hops = 0;

    for (int ttl = 1; ttl <= 30; ttl++)
    {
        PingReply reply =
            await ping.SendPingAsync(
                found[0], wait, new byte[32],
                new PingOptions(ttl, true));

        IPStatus status = reply.Status;
        if (status == IPStatus.Success)
        {
            hops = ttl;
            break;
        }
        if (status == IPStatus.TtlExpired)
            answered++;
        else
            silent++;
    }

    Console.WriteLine(hops > 0
        ? $"reached in {hops} hops"
        : "not reached within 30 hops");
    Console.WriteLine(
        $"routers that answered   {answered}");
    Console.WriteLine(
        $"routers that kept quiet {silent}");
}
catch (Exception e) when (
    e is SocketException or PingException)
{
    Console.WriteLine($"no network: {e.Message}");
}
```

```text output
reached in [...] hops
routers that answered   [...]
routers that kept quiet [...]
```

From the machine used here the answer came back at TTL 12: nine routers reported themselves, two did not reply within two seconds, and the twelfth packet reached the server. Silence is allowed; RFC 792 says a router *may* send the message, and many networks filter ICMP. If yours does, the program reports "not reached" and the HTTP programs above still work, because they use TCP. To see each router's address, print `reply.Address` inside the loop.

Every packet of the TLS program made a similar journey: the three handshake segments, the ClientHello, the certificate, the request, each chunk of the response, and every acknowledgment going the other way.

## The layer model, after the fact

RFC 1122 names four layers in the internet protocol suite ([section 1.1.3](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3)). You have now used each of them, so the table is a summary and not a vocabulary list.

| Layer | Carries | Seen here as |
|---|---|---|
| Application | DNS, HTTP messages | `Dns`, request text |
| Transport | TCP: ports, ordering | `TcpClient` |
| Internet | IP: addresses, TTL | the hop count |
| Link | Ethernet, Wi-Fi: one hop | not visible in C# |

TLS has no row. The four-layer model predates it, and it sits between two rows: to TCP it is application data, and to HTTP it behaves like a transport. The seven-layer OSI model has the same difficulty; RFC 1122 notes that its application layer covers the top two OSI layers combined. Treat either model as a way to say which header a piece of information lives in, and which machines read it: routers read the internet layer, the two end hosts read everything above it.

The useful property is that each layer can be swapped without the others noticing. The same HTTP request ran over plain TCP and over TLS with no change to its text. The same TCP code would run over IPv6 or a different kind of link. HTTP/3 goes furthest and replaces the TCP and TLS rows together with QUIC, a transport built on UDP that has TLS 1.3 built in ([RFC 9114, section 1](https://www.rfc-editor.org/rfc/rfc9114.html#section-1)), while the HTTP semantics above it stay the same.

## Where the time went

Look again at the four timing lines from the TLS program. Over several runs on this machine the DNS and TCP lines were each around 20 ms, the TLS handshake 50 to 55 ms, and the wait for the first line of the response 60 to 70 ms. One 56-byte request and its small response cost roughly 150 ms, and almost none of that was spent transmitting data. It was spent waiting for round trips:

- **TCP** is the cleanest measurement of one round trip, since `ConnectAsync` does nothing else.
- **TLS** is one round trip plus real work at both ends: a key exchange, a signature to create and verify, and a certificate chain to validate.
- **HTTP** is one round trip plus however long the server takes to produce the response.

Round-trip time is set by distance and the networks in between, and buying more bandwidth does not reduce it. What helps is doing fewer of them:

- **Reuse the connection.** HTTP/1.1 connections persist by default, and a second request on an open connection skips bands 1 to 3 entirely. The exercise below measures that.
- **Multiplex.** HTTP/2 interleaves many requests on one connection ([RFC 9113, section 5](https://www.rfc-editor.org/rfc/rfc9113.html#section-5)), so a page with forty resources does not need forty handshakes or forty turns in a queue.
- **Merge handshakes.** QUIC sets up the transport and the encryption together, so HTTP/3 saves a round trip on a new connection ([RFC 9114, section 1](https://www.rfc-editor.org/rfc/rfc9114.html#section-1)). TLS 1.3 also lets a returning client send data in its first flight ("0-RTT"), with the documented cost that such data can be replayed by an attacker ([RFC 8446, section 2.3](https://www.rfc-editor.org/rfc/rfc8446.html#section-2.3)).

A large response adds round trips of its own. A TCP sender starts cautiously and may send only an *initial window* of data before it must wait for acknowledgments; RFC 6928, an experimental specification, sets that window at ten segments, about 14,600 bytes ([RFC 6928](https://www.rfc-editor.org/rfc/rfc6928.html)). A response that fits arrives in the one round trip of band 4. A larger one needs more, with the window growing each time.

::::exercise[Measure what connection reuse saves]
`HttpClient` keeps connections open and reuses them. Write a program that requests `https://example.com/` three times with one `HttpClient` and times each request. Before running it, predict which bands each request pays for.

:::solution
The first request pays for all four bands. The second and third find an open, already-encrypted connection in the client's pool and pay only for band 4.

```csharp run
using System.Diagnostics;

using var http = new HttpClient
{
    Timeout = TimeSpan.FromSeconds(10),
};
try
{
    for (int i = 1; i <= 3; i++)
    {
        var clock = Stopwatch.StartNew();
        using HttpResponseMessage reply =
            await http.GetAsync(
                "https://example.com/");
        await reply.Content
            .ReadAsByteArrayAsync();
        double ms =
            clock.Elapsed.TotalMilliseconds;

        int code = (int)reply.StatusCode;
        Console.WriteLine(
            $"request {i}: {code}, {ms,6:F1} ms");
    }
}
catch (Exception e) when (
    e is HttpRequestException
      or OperationCanceledException)
{
    Console.WriteLine($"no network: {e.Message}");
}
```

```text output
request 1: 200, [...] ms
request 2: 200, [...] ms
request 3: 200, [...] ms
```

On the machine used here the first request took about 150 ms and the other two between 15 and 35 ms each, close to a single round trip. This is one reason Microsoft's guidance is to share a long-lived `HttpClient` and not create one per request: every instance has its own connection pool ([HttpClient guidelines](https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines)), so a new client pays for bands 1 to 3 again.
:::
::::

## After the last byte of HTML

For a browser, the response that took four round trips to fetch is a list of further things to fetch. The HTML names stylesheets, scripts, images and fonts, and each one is a URL that goes through the steps on this page. Those on the same host skip to band 4 on the connection that is already open; each new host name starts again at band 1. Parsing the HTML, applying the CSS, running the scripts and painting the result is a separate subject, and it is the browser's work and not the network's.

::::exercise[Find the step that failed]
Each symptom below comes from a failure in exactly one band. Name the band, using what the programs above printed or threw.

1. `SocketException` with the error code `HostNotFound`, almost immediately.
2. `AuthenticationException`, after `ConnectAsync` succeeded.
3. `ConnectAsync` runs until the 10-second limit cancels it.
4. A reply arrives, and its first line is `HTTP/1.1 404 Not Found`.

:::solution
1. **Band 1.** No address was found for the name, so nothing was ever sent to a web server. Check the spelling of the host, then the DNS configuration.
2. **Band 3.** TCP connected, so the address and port are right and something is listening. The handshake failed: the server has no certificate for that name (the `wrong-name.test` case above), or presented one the client does not trust or that does not match `TargetHost`.
3. **Band 2.** The SYN went out and no SYN + ACK came back: the address is unreachable, or a firewall is discarding packets for that port. A machine that is reachable but has nothing listening on the port answers the SYN with a reset ([RFC 9293, section 3.5.2](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5.2)), which fails at once with `ConnectionRefused` instead of timing out.
4. **Band 4, and only in the sense that the application said no.** DNS, TCP and TLS all worked, and the server understood the request. Status codes beginning with 4 mean the server believes the request is at fault ([RFC 9110, section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)); here, there is nothing at that path.

Reading a network error as "which band?" before anything else narrows the search to one protocol and, usually, one machine.
:::
::::
