---
title: "What Happens When You Request a URL, Step by Step in C#"
description: "Follow one request to example.com through DNS, TCP, TLS 1.3 and HTTP, reproducing every step from C# and timing each round trip on a real connection."
pillar: networking
order: 1
author: markus
published: 2026-09-21
updated: 2026-09-21
level: beginner
tags: [dns, tcp, tls, http, network-layers]
prerequisites: []
sources:
  - title: "RFC 9110: HTTP Semantics"
    url: "https://www.rfc-editor.org/rfc/rfc9110.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 9111: HTTP Caching"
    url: "https://www.rfc-editor.org/rfc/rfc9111.html"
    publisher: "IETF"
    accessed: 2026-09-21
  - title: "RFC 9112: HTTP/1.1"
    url: "https://www.rfc-editor.org/rfc/rfc9112.html"
    publisher: "IETF"
    accessed: 2026-09-18
  - title: "RFC 9113: HTTP/2"
    url: "https://www.rfc-editor.org/rfc/rfc9113.html"
    publisher: "IETF"
    accessed: 2026-09-21
  - title: "RFC 9114: HTTP/3"
    url: "https://www.rfc-editor.org/rfc/rfc9114.html"
    publisher: "IETF"
    accessed: 2026-09-21
  - title: "RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport"
    url: "https://www.rfc-editor.org/rfc/rfc9000.html"
    publisher: "IETF"
    accessed: 2026-09-21
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
    accessed: 2026-09-21
  - title: "RFC 9293: Transmission Control Protocol (TCP)"
    url: "https://www.rfc-editor.org/rfc/rfc9293.html"
    publisher: "IETF"
    accessed: 2026-09-21
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
    accessed: 2026-09-21
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
    accessed: 2026-09-21
  - title: "RFC 1122: Requirements for Internet Hosts - Communication Layers"
    url: "https://www.rfc-editor.org/rfc/rfc1122.html"
    publisher: "IETF"
    accessed: 2026-09-21
  - title: "RFC 3022: Traditional IP Network Address Translator (Traditional NAT)"
    url: "https://www.rfc-editor.org/rfc/rfc3022.html"
    publisher: "IETF"
    accessed: 2026-09-21
  - title: "Dns.GetHostAddresses Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostaddresses"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "SslClientAuthenticationOptions Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.security.sslclientauthenticationoptions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "TcpClient.NoDelay Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcpclient.nodelay"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "HttpClient guidelines for .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "HttpConnectionPool.cs (SocketsHttpHandler), dotnet/runtime"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Net.Http/src/System/Net/Http/SocketsHttpHandler/ConnectionPool/HttpConnectionPool.cs"
    publisher: "GitHub"
    accessed: 2026-09-21
  - title: "Populating the page: how browsers work"
    url: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work"
    publisher: "MDN Web Docs"
    accessed: 2026-09-21
  - title: "Example Domains"
    url: "https://www.iana.org/help/example-domains"
    publisher: "IANA"
    accessed: 2026-09-18
  - title: "ping"
    url: "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ping"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
draft: false
---

Requesting `https://example.com/` is four separate conversations, held one after another: a DNS lookup that turns the name into an address, a TCP handshake that opens a connection to that address, a TLS handshake that encrypts the connection and proves who is at the other end, and an HTTP exchange that finally asks for the page. On a fresh connection each costs about one network round trip (the time for a packet to reach the other end and the answer to come back, abbreviated RTT): the first to a DNS resolver, usually close to you, and the other three to the web server. Without shortcuts such as connection reuse, nothing in a later conversation can start until the earlier one has finished.

<figure class="diagram">
<svg viewBox="0 0 360 480" role="img" aria-labelledby="seq-title seq-desc">
<title id="seq-title">The four exchanges behind one HTTPS request</title>
<desc id="seq-desc">A sequence diagram with your machine on the left and the remote end on the right. Four bands follow each other downwards: a DNS query and answer, the three TCP handshake segments, the three TLS 1.3 handshake flights, and the HTTP request and response. Each band is marked as one round trip. TLS messages after ServerHello and both HTTP messages are drawn in the accent color because they are encrypted.</desc>
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
<text x="10" y="458" class="d-small d-muted">{ } and accent color: encrypted on the wire.</text>
<text x="10" y="474" class="d-small d-muted">The last arrow of a band leaves with the first of the next.</text>
</svg>
<figcaption>Figure 1. One request, four exchanges. On a fresh connection each band has to finish before the next can begin, so the page cannot start arriving until about four round trips have passed: one to the resolver and three to the web server.</figcaption>
</figure>

The core path is the URL section and bands 1 to 4; the packets, hop counting and layer sections that follow are extensions. Bands 1 and 3 each get their own C# program; bands 2 and 4 share one. Every program runs against the real `example.com`. IANA keeps `example.com` online for documentation and says it may be used in examples without asking, though it warns against building anything that depends on its web server ([IANA, Example Domains](https://www.iana.org/help/example-domains)). That warning shapes the output panels: `[...]` stands wherever a value depends on your network, the date, or how that server is configured this month.

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

static void Show(
    string part, object value) =>
    Console.WriteLine(
        $"{part,-9} {value}");
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

If you type a bare `example.com`, the browser applies its own policy to choose a scheme. Once it holds an `http` URL, one written rule can still change it: when a site has previously sent a `Strict-Transport-Security` header over HTTPS, the browser must rewrite `http` to `https` for that host before making the request, without asking the network first ([RFC 6797, section 8.3](https://www.rfc-editor.org/rfc/rfc6797.html#section-8.3)).

::::exercise[Plan a request from its URL]
A program is given this URL, with a real space in the path:

```text
http://shop.test:8080/a b?id=7#c
```

Before it sends a byte, decide: which port does it connect to, is there a TLS handshake, what is the first line of the request, and what goes in the `Host` header?

:::solution
Port 8080 (an explicit port beats the scheme's default), no TLS (the scheme is `http`), and the fragment is dropped. The space in the path is not legal in a request line, so `Uri` percent-encodes it. The `Host` header carries the port whenever it is not the default for the scheme.

```csharp run
var url = new Uri(
    "http://shop.test:8080/a b?id=7#c");

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
line 1   GET /a%20b?id=7 HTTP/1.1
line 2   Host: shop.test:8080
```
:::
::::

## Band 1: the name becomes an address

Packets are delivered to IP addresses, not names, so the host name has to be translated first. The domain name system stores that mapping as a tree of names split into *zones*, each run by whoever is responsible for that part of the tree ([RFC 1034, sections 3.1 and 4.2](https://www.rfc-editor.org/rfc/rfc1034.html#section-3.1)). No single server holds everything, so answering `example.com` from scratch means asking a root server, being referred to the servers for `com`, and being referred again to the servers for `example.com`, which hold the address record ([RFC 1034, section 5.3.3](https://www.rfc-editor.org/rfc/rfc1034.html#section-5.3.3)).

Your program does none of that walking. It contains what RFC 1034 calls a *[stub resolver](/networking/dns/)*: it sends one question to a *recursive* server (usually run by your ISP, your router or a public DNS service) and that server follows the referrals and returns a finished answer ([RFC 1034, sections 4.3.1 and 5.3.1](https://www.rfc-editor.org/rfc/rfc1034.html#section-5.3.1)). The question normally travels as [a single UDP packet](/networking/tcp-vs-udp/) to port 53 ([RFC 1035, section 4.2](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.2)), which is why band 1 in Figure 1 has no handshake of its own. DNS queries can also be carried inside HTTPS requests ([RFC 8484](https://www.rfc-editor.org/rfc/rfc8484.html)), with the same kind of record coming back.

This program times three lookups. The first is `localhost`, which involves no network at all, and it is there to measure something else. The other two are for `example.com`, one after the other:

```csharp run id=lookup
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

const string host = "example.com";
try
{
    await Lookup("localhost");
    IPAddress[] found =
        await Lookup(host);
    await Lookup(host);
    Console.WriteLine(
        $"{found.Length} found, " +
        $"first {found[0]}");
}
catch (SocketException e)
{
    Console.WriteLine(
        $"lookup failed: " +
        $"{e.SocketErrorCode}");
}

static async Task<IPAddress[]> Lookup(
    string name)
{
    var clock = Stopwatch.StartNew();
    IPAddress[] found = await
        Dns.GetHostAddressesAsync(
            name);
    double ms =
    clock.Elapsed.TotalMilliseconds;
    Console.WriteLine(
        $"{name,-12} " +
        $"{ms,6:F1} ms");
    return found;
}
```

```text output
localhost    [...] ms
example.com  [...] ms
example.com  [...] ms
[...] found, first [...]
```

Measurements from here on were taken on Windows 11, x64, with the .NET 10 SDK (10.0.401, runtime 10.0.12). The operating system's `ping example.com` reported round trips of 12 to 20 ms, and every timing on this page is specific to that machine and network on 2026-09-21; expect different numbers, and the same shape.

The `localhost` line took 18 to 24 ms over three runs even though no packet left the machine. The extra time is start-up work in the first name lookup of a process (loading the networking code, initializing the resolver), paid once. Without a throwaway lookup in front, that cost would land on whichever measurement came first and be mistaken for network time.

After that, `example.com` took 1 to 3 ms on its first lookup and 0.5 ms on the second in the same three runs. The first was fast, which points to a stored answer somewhere between this machine and the recursive resolver, either in the operating system's own cache or in a resolver on the path; this program cannot tell which layer answered. A run that follows a long enough pause finds no stored answer anywhere on that path, and then the first lookup has to leave the machine and costs at least a round trip to the recursive server, and more if that server does not have the record either. The stored answer is what the lifetime in Figure 1 is for: every DNS record carries a time to live, the number of seconds it may be reused before it has to be fetched again ([RFC 1034, section 3.6](https://www.rfc-editor.org/rfc/rfc1034.html#section-3.6)), and resolvers at every level keep answers for that long.

:::dotnet
`Dns.GetHostAddressesAsync` is not a DNS client. It calls the operating system's name resolution API (`getaddrinfo` on Windows), so an entry in the `hosts` file wins without any DNS query (one reason `localhost` needs no network), and IPv6 addresses are filtered out if the machine has no IPv6 installed ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostaddresses#remarks)). Which layer answered a fast lookup, the operating system or a cache further along the path, is something this program cannot tell you.
:::

A name can map to several addresses, as it did here. The client picks one and moves on; the others are alternatives if the connection fails.

## Bands 2 and 4: TCP and HTTP without TLS

TLS exists to make the conversation unreadable to anyone watching, which makes it a poor place to start reading. `example.com` also answers unencrypted HTTP on port 80, so this program skips band 3, opens a TCP connection, and types the request by hand.

```csharp run id=plain
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

const string host = "example.com";
const StringComparison ic =
    OrdinalIgnoreCase;
string request =
    "GET / HTTP/1.1\r\n" +
    $"Host: {host}\r\n" +
    "Connection: close\r\n" +
    "\r\n";

using var tcp = new TcpClient();
using var limit =
    new CancellationTokenSource(
        TimeSpan.FromSeconds(10));
CancellationToken stop = limit.Token;
try
{
    await tcp.ConnectAsync(host, 80, stop);
    Socket sock = tcp.Client;
    Console.WriteLine(
        $"local    " +
        $"{sock.LocalEndPoint}");
    Console.WriteLine(
        $"remote   " +
        $"{sock.RemoteEndPoint}");

    NetworkStream stream =
        tcp.GetStream();
    byte[] bytes =
        Encoding.ASCII.GetBytes(request);
    await stream.WriteAsync(bytes, stop);
    Console.WriteLine(
        $"sent     {bytes.Length} bytes");

    using var all = new MemoryStream();
    await stream.CopyToAsync(all, stop);
    Console.WriteLine(
        $"received {all.Length} bytes");

    string reply = Encoding.UTF8.GetString(
        all.ToArray());
    int blank = reply.IndexOf(
        "\r\n\r\n", Ordinal);
    if (blank < 0)
        throw new IOException(
            "no blank line");
    string[] head =
        reply[..blank].Split("\r\n");
    string body = reply[(blank + 4)..];
    string start =
        body[..Math.Min(24, body.Length)];
    string framing =
        head.FirstOrDefault(IsFraming)
        ?? "neither framing header";
    string shown =
        start.Replace("\r\n", "\\r\\n");

    Console.WriteLine($"""

        {head[0]}
        header lines: {head.Length - 1}
        {framing}

        body starts:
        {shown}
        """);
}
catch (Exception e) when (e is
    SocketException or IOException
    or OperationCanceledException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}

static bool IsFraming(string line) =>
    line.StartsWith("Content-Length:", ic)
    || line.StartsWith(
        "Transfer-Encoding:", ic);
```

```text output
local    [...]
remote   [...]:80
sent     56 bytes
received [...] bytes

HTTP/1.1 200 OK
header lines: [...]
[...]

body starts:
[...]
```

The wildcards hide values that depend on the day and the server. In the run used for this page the bottom of the panel read:

```text
header lines: 11
Transfer-Encoding: chunked

body starts:
22f\r\n<!doctype html><htm
```

The two address lines show what identifies a TCP connection: the pair of endpoints, each an address and a port ([RFC 9293, section 3.4.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.4.1)). On this machine they printed in a bracketed form such as `[::ffff:203.0.113.5]:80`, where the digits after `::ffff:` are the IPv4 address. The remote endpoint is the address DNS returned with port 80, which was the program's choice. The local port was picked by the operating system and changes on every run. That pairing is how one server port 80 can hold thousands of conversations at once and how your machine can hold several to the same server.

### What `ConnectAsync` did

`ConnectAsync` was given a name, so it repeated band 1 internally, then performed the TCP three-way handshake with the address it got. The client sends a segment with the SYN flag and a starting sequence number; the server answers with its own SYN and an acknowledgment of the client's; the client acknowledges that ([RFC 9293, section 3.5](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5)). The numbers exchanged are what let each side later detect missing, duplicated or reordered bytes. The client's side of the connection is established as soon as the server's SYN + ACK arrives (the state diagram in the same section shows it), so the time `ConnectAsync` takes with an IP address is a fair measurement of one round trip to the server.

### What the 56 bytes were

Those 56 bytes are [a complete HTTP/1.1 request](/networking/http-explained/). The format is a start line, then header lines, then an empty line, each ended by a carriage return and line feed ([RFC 9112, section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-2.1)). The start line is a method, a target and a version separated by single spaces ([section 3](https://www.rfc-editor.org/rfc/rfc9112.html#section-3)).

`Host` is the one header that every HTTP/1.1 request must carry ([RFC 9112, section 3.2](https://www.rfc-editor.org/rfc/rfc9112.html#section-3.2)). It looks redundant, because the connection already goes to that host's address, but an address can serve many sites (the certificate experiment below shows one that does), and the header is how the server tells them apart. `Connection: close` asks the server to close the connection after this response. Without it an HTTP/1.1 connection stays open for more requests ([RFC 9112, section 9.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.3)), and `CopyToAsync`, which reads until the other side closes, would wait until the server gave up on the idle connection or the 10-second limit cancelled the read. In the second case the program prints only the failure line for `OperationCanceledException` and shows no response.

### Where the response ends

TCP delivers a stream of bytes. It promises the bytes arrive complete and in order, and explicitly promises nothing about how they are grouped: what one side sends in a single write may arrive as several reads, or merged with the next write ([RFC 9293, section 3.7](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.7)). So HTTP has to mark the end of a message itself, and the `22f` at the start of the body is how this server did it. With `Transfer-Encoding: chunked`, the body is sent as pieces, each preceded by its length in hexadecimal on a line of its own, and finished by a piece of length zero ([RFC 9112, section 7.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1)). A server that knows the size in advance sends `Content-Length` instead, and a client has to handle both ([RFC 9112, section 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)). Header names are case-insensitive ([RFC 9110, section 5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1)), which is why `IsFraming` ignores case.

<figure class="diagram">
<svg viewBox="0 0 360 250" role="img" aria-labelledby="chunk-title chunk-desc">
<title id="chunk-title">A chunked HTTP response body, byte by byte</title>
<desc id="chunk-desc">Three stacked blocks. The first, highlighted, is the size line 22f followed by a line break, five bytes. The second is 559 bytes of HTML. The third, highlighted, is a line break, the digit 0, a line break and a final line break, seven bytes, which marks the end of the body.</desc>
<text x="20" y="18" class="d-small d-bold">Body bytes as they arrive, top to bottom</text>
<rect x="20" y="28" width="320" height="30" rx="4" class="d-box-accent"/>
<text x="180" y="48" text-anchor="middle" class="d-mono">22f\r\n</text>
<text x="20" y="76" class="d-small d-muted">Size line: hex 22f is 559, then a line break.</text>
<rect x="20" y="88" width="320" height="44" rx="4" class="d-box-2"/>
<text x="180" y="115" text-anchor="middle" class="d-small">559 bytes of HTML</text>
<text x="20" y="150" class="d-small d-muted">The data. Exactly as many bytes as announced.</text>
<rect x="20" y="162" width="320" height="30" rx="4" class="d-box-accent"/>
<text x="180" y="182" text-anchor="middle" class="d-mono">\r\n0\r\n\r\n</text>
<text x="20" y="210" class="d-small d-muted">Line break, then a chunk of size 0: the end.</text>
<text x="20" y="238" class="d-small d-bold">5 + 559 + 7 = 571 bytes of body.</text>
</svg>
<figcaption>Figure 2. The body of the response above, as captured in one run. The receiver never needs to know the total in advance: it reads a size, that many bytes, and repeats until a size of 0.</figcaption>
</figure>

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
catch (Exception e) when (e is
    SocketException or IOException
    or OperationCanceledException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}
```

```text output
HTTP/1.1 400 Bad Request
```
:::
::::

## Band 3: the same request, inside TLS

Everything the last program sent and received was readable by every network it crossed. HTTPS is the same HTTP exchange carried inside a TLS channel, which RFC 8446 defines by three properties: the server is authenticated, the data is visible only to the two endpoints, and it cannot be modified in transit without detection ([RFC 8446, section 1](https://www.rfc-editor.org/rfc/rfc8446.html#section-1)).

In code, that is one more stream wrapped around the TCP stream. This program performs all four bands three times, each time on a brand-new connection, and prints one row of timings per round. The lines to read are the four `await` calls, each followed by a `Lap()`; the request text is byte for byte the one from the previous section.

```csharp run id=secure
using System.Diagnostics;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text;

const string host = "example.com";
var options =
    new SslClientAuthenticationOptions
{
    TargetHost = host,
    ApplicationProtocols =
        [SslApplicationProtocol.Http11],
};
byte[] request = Encoding.ASCII.GetBytes(
    "GET / HTTP/1.1\r\n" +
    $"Host: {host}\r\n" +
    "Connection: close\r\n\r\n");
var clock = new Stopwatch();
string info = "";

Console.WriteLine(
    "round   dns   tcp" +
    "   tls  http");
try
{
    for (int round = 1;
        round <= 3;
        round++)
    {
        clock.Restart();
        IPAddress[] found = await
            Dns.GetHostAddressesAsync(
                host);
        double dns = Lap();

        using var tcp = new TcpClient();
        tcp.NoDelay = true;
        await tcp.ConnectAsync(
            found[0], 443);
        double connect = Lap();

        using var tls = new SslStream(
            tcp.GetStream());
        await tls
            .AuthenticateAsClientAsync(
                options);
        double handshake = Lap();

        await tls.WriteAsync(request);
        using var reader =
            new StreamReader(tls);
        string? status =
            await reader.ReadLineAsync();
        double reply = Lap();

        Console.WriteLine(
            $"{round,5}" +
            $"{dns,6:F1}" +
            $"{connect,6:F1}" +
            $"{handshake,6:F1}" +
            $"{reply,6:F1}");
        info = $"{tls.SslProtocol} " +
        $"{status}\n" +
        $"{tls.NegotiatedCipherSuite}";
    }
    Console.WriteLine(info);
}
catch (Exception e) when (e is
    SocketException or IOException
    or AuthenticationException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}

double Lap()
{
    double ms =
    clock.Elapsed.TotalMilliseconds;
    clock.Restart();
    return ms;
}
```

```text output
round   dns   tcp   tls  http
    1 [...]
    2 [...]
    3 [...]
Tls13 HTTP/1.1 200 OK
[...]
```

Both messages went through `tls` instead of straight into the TCP stream, and the status line that came back is the same. The `Tls13` in the panel is a literal because this server and this operating system both support TLS 1.3; an older client would negotiate 1.2 and print `Tls12`. The suite negotiated on this machine was `TLS_AES_256_GCM_SHA384`. The exercise in "Where the time went" takes `NoDelay = true` out and shows what it costs.

### What the handshake exchanged

[The TLS 1.3 handshake is three flights](/networking/tls-and-https/) ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)):

1. **ClientHello**, unencrypted, because no keys exist yet. It carries the client's half of a key exchange, the cipher suites it supports, and extensions. Two extensions matter here. *Server Name Indication* is the host name, sent so that a server holding certificates for many sites at one address can choose the right one ([RFC 6066, section 3](https://www.rfc-editor.org/rfc/rfc6066.html#section-3)). *ALPN* is the list of application protocols the client is willing to speak over this connection ([RFC 7301, section 3.1](https://www.rfc-editor.org/rfc/rfc7301.html#section-3.1)).
2. **ServerHello**, with the server's half of the key exchange. Both sides can now compute the same keys, and everything after ServerHello is encrypted ([RFC 8446, section 1.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-1.2)): the server's certificate, a signature made with the certificate's private key over the handshake so far, and a Finished message.
3. The client's **Finished**. The client does not have to wait for anything after sending it, so the HTTP request leaves right behind it.

That is one round trip before the request can go, and it is why band 3 in Figure 1 is no taller than band 2. If you have read a description with a longer exchange in which the client encrypts a secret with the server's public key, it describes an older TLS version, not the one negotiated here.

`TargetHost` did two jobs. It was checked against the certificate: the `https` scheme requires the client to verify that the certificate is valid for the host in the URL ([RFC 9110, section 4.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-4.3.4)), and `SslStream` uses `TargetHost` for that validation ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.net.security.sslclientauthenticationoptions#properties)). The program connected to `found[0]`, a bare IP address that came from an unauthenticated DNS answer, so the certificate check is what ties the machine that answered back to the name you typed. `TargetHost` was also the name sent in the ClientHello, which the next program shows by changing it.

The program offered only `http/1.1` in ALPN because that is the only protocol it can speak. A client that also speaks HTTP/2 lists `h2`, and a server that selects it switches the connection to HTTP/2 ([RFC 9113, section 3.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-3.2)). The negotiation rides inside the two Hello messages and costs no extra round trip ([RFC 7301, section 1](https://www.rfc-editor.org/rfc/rfc7301.html#section-1)).

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
try
{
    IPAddress[] found = await
        Dns.GetHostAddressesAsync(
            "example.com");
    foreach (string name in names)
    {
        string outcome = await Ask(
            found[0],
            name);
        Console.WriteLine(
            $"{name,-16} {outcome}");
    }
}
catch (Exception e) when (e is
    SocketException or IOException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}

static async Task<string> Ask(
    IPAddress address, string name)
{
    using var tcp = new TcpClient();
    await tcp.ConnectAsync(address, 443);
    using var tls =
        new SslStream(tcp.GetStream());
    try
    {
        await tls
            .AuthenticateAsClientAsync(name);
        return
        tls.RemoteCertificate!.Subject;
    }
    catch (AuthenticationException)
    {
        return "refused";
    }
}
```

```text output
example.com      CN=example.com
example.org      CN=example.org
wrong-name.test  refused
```

The same address and port presented a different certificate for each name it serves, and the handshake failed for a name it does not serve (another server might instead present a default certificate that the client then rejects). The only thing that differed between the three attempts was the host name passed to `AuthenticateAsClientAsync`, so that is what reached the server in the ClientHello.

:::note[What an observer on the path still sees]
The ClientHello that carries the host name is sent before encryption starts, so anyone on the path can see:

- the IP addresses and ports, the size and timing of what is sent, and the host name;
- but not the path, the query string, the headers or the body, which are inside the encrypted channel.
:::

## The request a real client writes

`HttpClient` does the four bands for you. To see what it puts on the wire, this program plays the server as well: it listens on a loopback port, prints whatever arrives, and replies with a minimal response. It runs without a network, and it is given the URL from the first section, fragment included.

```csharp run id=capture
using System.Net;
using System.Net.Sockets;
using System.Text;
using static System.StringComparison;

var listener =
    new TcpListener(IPAddress.Loopback, 0);
listener.Start();
var bound = (IPEndPoint)listener.LocalEndpoint;
int port = bound.Port;
const string blankLine = "\r\n\r\n";

Task server = Task.Run(async () =>
{
    using TcpClient peer = await
        listener.AcceptTcpClientAsync();
    NetworkStream stream = peer.GetStream();

    var seen = new StringBuilder();
    var buffer = new byte[1024];
    while (!seen.ToString().EndsWith(
        blankLine, Ordinal))
    {
        int n = await stream.ReadAsync(
            buffer);
        if (n == 0) break;
        seen.Append(
            Encoding.ASCII.GetString(
                buffer, 0, n));
    }
    Console.WriteLine("server read:");
    Console.Write(
        seen.ToString().Replace(
            "\r\n", "\\r\\n\n"));

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

By default `HttpClient` sends less than the hand-written request did: the request line, `Host`, and the blank line. The path and query arrived; `#setup` did not. `Host` carries the port because it is not the default for `http`. The server loop follows the advice in the pitfall above and keeps reading until it has seen `blankLine`, however many reads that takes.

A browser's request for the same URL would have the same first two lines, followed by more headers describing the browser and what it accepts. Over HTTP/2 or HTTP/3 it would not be text at all: HTTP/2 sends binary frames and carries the method, scheme, host and path as the fields `:method`, `:scheme`, `:authority` and `:path` ([RFC 9113, section 8.3.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3.1)). The meaning is unchanged. Methods, status codes and headers are defined once, in RFC 9110, and all three versions are different ways of writing them onto a connection ([RFC 9110, section 1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-1.2)).

## Underneath: every message above was cut into packets

None of the programs so far has mentioned a router, because `TcpClient` gives you a reliable pipe and the machinery that builds that pipe out of an unreliable network sits below it.

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
<text x="10" y="354" class="d-small d-muted">Forwarding needs only the IP row: a router swaps</text>
<text x="10" y="368" class="d-small d-muted">the link row per hop and lowers the TTL.</text>
</svg>
<figcaption>Figure 3. The request from the TLS program on its way out. Each layer treats the row above as opaque bytes and adds its own header. Boxes are not to scale.</figcaption>
</figure>

The numbers in Figure 3 come from the specifications. A TLS 1.3 record has a 5-byte header, and the encrypted part holds the data plus one byte giving its real type ([RFC 8446, sections 5.1 and 5.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-5.2)). The suite negotiated above, `TLS_AES_256_GCM_SHA384`, uses AES-GCM, which appends a 16-byte authentication tag ([RFC 5116, section 5.2](https://www.rfc-editor.org/rfc/rfc5116.html#section-5.2)); a suite with a different cipher could differ, so the 78 is the figure for this connection. A TCP header is at least 20 bytes and begins with the two 16-bit port numbers ([RFC 9293, section 3.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.1)). An IPv4 header is at least 20 bytes ([RFC 791, section 3.1](https://www.rfc-editor.org/rfc/rfc791.html#section-3.1)). So the 56 bytes you wrote cross the network as at least 118, before the link layer adds its own.

IP is where the network stops making promises. It moves each packet, independently, one hop closer to the destination [IP address](/networking/ip-addresses-and-subnets/), with no acknowledgments and no retransmission ([RFC 791, section 1.4](https://www.rfc-editor.org/rfc/rfc791.html#section-1.4)). In the architecture RFC 1122 describes, routers keep no connection state and forward each packet independently; everything needed for reliability lives in the two end hosts ([RFC 1122, section 1.1.2](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.2)). The ordering and completeness that the HTTP code relied on were built by TCP at the two ends, from the sequence numbers set up in band 2, by resending whatever was not acknowledged.

:::note[Where addresses get rewritten]
That is the model, and real paths bend it. Where a network address port translator sits on the path, it rewrites the source address and TCP or UDP port of each outgoing packet so that many private machines can share one public address, and it remembers the mapping to route the replies back ([RFC 3022, section 2.2](https://www.rfc-editor.org/rfc/rfc3022.html#section-2.2)). So the local port printed by the plain-TCP program is your machine's view; the server may see a different port, and a different address, on the same connection. A box that reads and rewrites TCP ports is not a router that reads only IP. The rule "routers read only IP" describes what forwarding requires, not what every box on the path does.
:::

### Counting the hops

One field of the IP header can be used to make the routers visible. Every router that forwards a packet must reduce its time to live (TTL) by at least one, and a packet whose TTL reaches zero is destroyed ([RFC 791, section 3.2](https://www.rfc-editor.org/rfc/rfc791.html#section-3.2)), which stops a misrouted packet from circulating forever. The router that destroys it may send an ICMP "time exceeded" message back to the sender ([RFC 792](https://www.rfc-editor.org/rfc/rfc792.html)). Send a packet with TTL 1 and the first router reports itself; TTL 2 reaches the second; and so on until the destination answers. This is the method behind the `tracert` and `traceroute` commands, written out with `Ping`. The 32-byte payload below mirrors the `/l` default of the Windows `ping` command itself ([Microsoft Learn, ping](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ping)); its contents make no difference to the result.

```csharp run id=hops
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

try
{
    IPAddress[] found = await
        Dns.GetHostAddressesAsync(
            "example.com");
    using var ping = new Ping();
    var wait = TimeSpan.FromSeconds(2);
    int answered = 0,
        silent = 0, ttl = 0;
    IPStatus status = IPStatus.Unknown;

    while (ttl < 30)
    {
        ttl++;
        var options = new PingOptions
        {
            Ttl = ttl,
        };
        PingReply reply = await
            ping.SendPingAsync(
                found[0],
                wait,
                new byte[32],
                options);
        status = reply.Status;

        if (status ==
            IPStatus.TtlExpired)
            answered++;
        else if (status ==
            IPStatus.TimedOut)
            silent++;
        else
            break;
    }

    Console.WriteLine(
        $"stopped at hop {ttl}: {status}");
    Console.WriteLine(
        "routers that answered  " +
        answered);
    Console.WriteLine(
        "routers with no answer " +
        silent);
}
catch (Exception e) when (
    e is SocketException or PingException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}
```

```text output
stopped at hop [...]: [...]
routers that answered  [...]
routers with no answer [...]
```

Three runs on this machine each stopped at hop 11 with `Success`, meaning the destination itself answered at TTL 11. Nine routers reported themselves and one stayed silent within the two-second wait. An earlier run of a slightly different version of this program counted eight and two, so those counts move. Silence is allowed: RFC 792 says a router *may* send the message, and a network that filters ICMP will leave gaps or, if it filters everything, leave the program at hop 30 with `TimedOut`. The HTTP programs above would still work in that case, because they use TCP. Sending pings with a chosen TTL was tried on Windows only; other systems may need different privileges or behave differently. To see each router's address, print `reply.Address` inside the loop.

Every packet of the TLS program made a similar journey: the three handshake segments, the ClientHello, the certificate, the request, each chunk of the response, and every acknowledgment going the other way.

## The layer model, after the fact

RFC 1122 names four layers in the internet protocol suite ([section 1.1.3](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3)). You have now used each of them:

- **Application** carries DNS and HTTP messages. You saw it as the `Dns` calls and the request text.
- **Transport** is TCP: ports, ordering, resending. You saw it as `TcpClient`.
- **Internet** is IP: addresses and the TTL. You saw it as the hop count.
- **Link** is Ethernet or Wi-Fi, one hop at a time. C# never shows it to you.

TLS has no layer of its own. The four-layer model predates it, and it sits between two of them: to TCP it is application data, and to HTTP it behaves like a transport. The seven-layer OSI model has the same difficulty; RFC 1122 notes that its application layer covers the top two OSI layers combined. Either model tells you which header a piece of information lives in and which machines read it. In the model, routers need the internet layer and the two end hosts read everything above it, with the exceptions in the previous section.

Each layer can be swapped without the others noticing. The same HTTP request ran over plain TCP and over TLS with no change to its text, and the same TCP code would run over IPv6 or a different kind of link. HTTP/3 goes furthest and replaces the TCP and TLS layers together with QUIC, a transport whose packets are carried in UDP datagrams ([RFC 9000, section 1](https://www.rfc-editor.org/rfc/rfc9000.html#section-1)) and which incorporates TLS 1.3 ([RFC 9114, section 1.2](https://www.rfc-editor.org/rfc/rfc9114.html#section-1.2)), while the HTTP semantics above it stay the same.

## Where the time went

Here is what the timing rows from the TLS program looked like over six runs on this machine, with `ping` reporting 12 to 20 ms.

**Time per band, minimum to maximum over six runs**

| Band | Round 1 | Rounds 2 and 3 |
|---|---:|---:|
| 1 DNS | 15 to 18 ms | 0.6 to 1.2 ms |
| 2 TCP | 15 to 29 ms | 11 to 20 ms |
| 3 TLS | 49 to 54 ms | 21 to 31 ms |
| 4 HTTP | 23 to 28 ms | 19 to 36 ms |

Round 1 is slower than the rest, most of all in DNS and TLS, although every round opens a new connection to the same server. The only difference is that the process has never done any of this before, so the extra is one-time start-up cost inside the program; the `localhost` line above measured part of it. This program does not show which part of the runtime is responsible. The last column is the fair one.

In that column, TCP is the cleanest measurement of one round trip, since `ConnectAsync` does nothing else. TLS and HTTP each took between one and two of those round trips here. Figure 1 draws one round trip each, and this program does not separate the surplus: for TLS it fits the certificate and key work at both ends, and for HTTP the server's own processing time. DNS is nearly free only because the answer was stored on this machine; a cold lookup would add at least a round trip to the resolver.

Round-trip time is set by distance and the networks in between, and buying more bandwidth does not reduce it. What helps is doing fewer round trips:

- **Reuse the connection.** HTTP/1.1 connections persist by default, and a second request on an open connection skips bands 1 to 3 entirely. The exercise below measures that.
- **Multiplex.** HTTP/2 interleaves many requests on one connection ([RFC 9113, section 5](https://www.rfc-editor.org/rfc/rfc9113.html#section-5)), so a page with forty resources does not need forty handshakes or forty turns in a queue.
- **Merge handshakes.** QUIC uses a combined cryptographic and transport handshake to cut connection setup latency ([RFC 9000, section 7](https://www.rfc-editor.org/rfc/rfc9000.html#section-7)), which is how HTTP/3 aims to need fewer round trips than TCP with TLS on top. TLS 1.3 also lets a returning client send data in its first flight ("0-RTT"), with the documented cost that such data can be replayed by an attacker ([RFC 8446, section 2.3](https://www.rfc-editor.org/rfc/rfc8446.html#section-2.3)).

A large response adds round trips of its own. A TCP sender starts cautiously and may send only an *initial window* of data before it must wait for acknowledgments; RFC 6928, an experimental specification, sets that window at ten segments, about 14,600 bytes ([RFC 6928](https://www.rfc-editor.org/rfc/rfc6928.html)). A response that fits arrives in the one round trip of band 4. A larger one needs more, with the window growing each time.

::::exercise[Take NoDelay away]
The TLS program creates its `TcpClient` with `NoDelay = true`. Write a program that opens the TLS connection, then times how long a request takes to get the first line of its response, with `NoDelay` set to `false` and to `true`, alternating three times each. Before running it, predict the difference. The Microsoft Learn page for [`NoDelay`](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcpclient.nodelay#remarks) and RFC 9293 section 3.7.4 are the places to start.

:::solution
Across five runs of this program on this machine (15 samples of each setting), 13 of the `false` timings were between 69 and 116 ms and two were about 26 and 30 ms. The `true` timings were 20 to 48 ms, mostly 22 to 30, about one round trip. So on this connection `NoDelay = true` usually removed 40 to 60 ms from the first request, and the delay did not appear every time.

```csharp run
using System.Diagnostics;
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Text;

IPAddress ip = (await
    Dns.GetHostAddressesAsync(
        "example.com"))[0];
byte[] request = Encoding.ASCII.GetBytes(
    "GET / HTTP/1.1\r\nHost: example.com\r\n" +
    "Connection: close\r\n\r\n");
try
{
    for (int i = 0; i < 6; i++)
    {
        bool noDelay = i % 2 == 1;
        using var tcp = new TcpClient
        {
            NoDelay = noDelay,
        };
        await tcp.ConnectAsync(ip, 443);
        using var tls =
            new SslStream(tcp.GetStream());
        await tls.AuthenticateAsClientAsync(
            "example.com");

        var clock = Stopwatch.StartNew();
        await tls.WriteAsync(request);
        using var reader = new StreamReader(tls);
        await reader.ReadLineAsync();
        double ms =
            clock.Elapsed.TotalMilliseconds;
        Console.WriteLine(
            $"NoDelay {noDelay,-5} " +
            $"{ms,6:F1} ms");
    }
}
catch (Exception e) when (e is
    SocketException or IOException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}
```

```text output
NoDelay False [...] ms
NoDelay True  [...] ms
NoDelay False [...] ms
NoDelay True  [...] ms
NoDelay False [...] ms
NoDelay True  [...] ms
```

The usual explanation is Nagle's algorithm. With it on, a TCP sender that has unacknowledged data buffers further small writes until the acknowledgment arrives ([RFC 9293, section 3.7.4](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.7.4)), and .NET's documentation says that with `NoDelay` false a `TcpClient` holds back small amounts of outgoing data ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcpclient.nodelay#remarks)). If the client's small TLS Finished message is still unacknowledged when the small request is written, Nagle's algorithm holds the request back. A receiver is allowed to hold an acknowledgment back, for less than half a second, in the hope of sending it along with data ([RFC 9293, section 3.8.6.3](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.8.6.3)); if the server does that after the Finished message, the request waits for it. That would produce a delay of this size, but no packets were captured: the timing effect is measured, and the mechanism is the standard explanation, not something this program observed.

It is also why `SocketsHttpHandler`, the handler behind `HttpClient`, creates its sockets with `NoDelay = true` (in the current [dotnet/runtime source](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Net.Http/src/System/Net/Http/SocketsHttpHandler/ConnectionPool/HttpConnectionPool.cs)), and why a hand-written client that leaves the default on can meet this delay whenever a small write follows another write that has not been acknowledged yet.
:::
::::

::::exercise[Measure what connection reuse saves]
`HttpClient` keeps connections open and reuses them. Write a program that requests `https://example.com/` three times with one `HttpClient`, times each request, and then makes a fourth request with a second, new `HttpClient`. Before running it, predict which bands each request pays for and which of the four should be slowest.

:::solution
The first request pays for all four bands, plus the one-time start-up costs seen in round 1 of the TLS program. The second and third find an open, already-encrypted connection in the client's pool and pay only for band 4. The new client has an empty pool, so it pays for bands 1 to 4 again, but the process is warm by then and the address is stored locally.

```csharp run
using System.Diagnostics;

try
{
    using var shared = NewClient();
    for (int i = 1; i <= 3; i++)
        Console.WriteLine(
            $"shared {i}: " +
            $"{await Time(shared)}");

    using var fresh = NewClient();
    Console.WriteLine(
        $"new client: " +
        $"{await Time(fresh)}");
}
catch (Exception e) when (e is
    HttpRequestException
    or OperationCanceledException)
{
    Console.WriteLine($"failed: {e.GetType().Name}");
}

static HttpClient NewClient() =>
    new()
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

static async Task<string> Time(HttpClient http)
{
    var clock = Stopwatch.StartNew();
    using HttpResponseMessage reply =
        await http.GetAsync(
            "https://example.com/");
    await reply.Content.ReadAsByteArrayAsync();
    double ms = clock.Elapsed.TotalMilliseconds;
    int code = (int)reply.StatusCode;
    return $"{code}, {ms,6:F1} ms";
}
```

```text output
shared 1: 200, [...] ms
shared 2: 200, [...] ms
shared 3: 200, [...] ms
new client: 200, [...] ms
```

Over three runs on this machine the first request took 154 to 225 ms, the second and third 23 to 34 ms (one to two round trips, band 4 alone), and the new client 61 to 68 ms, about what the sum of the bands in the last column of the table predicts. This is one reason Microsoft's guidance is to share a long-lived `HttpClient` and not create one per request: every instance has its own connection pool ([HttpClient guidelines](https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines)), so a new client pays for bands 1 to 3 again.
:::
::::

## After the last byte of HTML

For a browser, the response that took four round trips to fetch is a list of further things to fetch. The HTML names stylesheets, scripts, images and fonts, and each one is a URL that goes through the steps on this page. A host with an idle open connection can skip to band 4 on it (browsers also open several connections to one host in parallel, and each extra one pays bands 2 and 3). A new host name normally needs its own lookup and its own connection, though an HTTP/2 client may reuse one connection for another name that the server's certificate covers ([RFC 9113, section 9.1.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.1.1)).

A browser also asks itself whether it needs the network at all. An HTTP cache stores responses so that future equivalent requests cost less time and bandwidth, and a browser keeps a private one ([RFC 9111, section 1](https://www.rfc-editor.org/rfc/rfc9111.html#section-1)). A repeat visit can therefore skip every band for a stored response, or reuse an open connection and pay for band 4 only. Parsing the HTML, applying the CSS, running scripts and painting the result comes after all of that; MDN's [Populating the page: how browsers work](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work) covers that half.

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
