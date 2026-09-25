---
title: "TCP vs UDP: Reliability, Ordering and Cost"
description: "What TCP's reliability and ordering actually cost, and what UDP leaves undone, shown with loopback C# code, RFC citations and real measurements."
pillar: networking
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [tcp, udp, sockets, flow-control, quic]
prerequisites: ["networking/how-the-internet-works"]
sources:
  - title: "RFC 9293: Transmission Control Protocol (TCP)"
    url: "https://www.rfc-editor.org/rfc/rfc9293.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 5681: TCP Congestion Control"
    url: "https://www.rfc-editor.org/rfc/rfc5681.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 768: User Datagram Protocol"
    url: "https://www.rfc-editor.org/rfc/rfc768.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 8085: UDP Usage Guidelines"
    url: "https://www.rfc-editor.org/rfc/rfc8085.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport"
    url: "https://www.rfc-editor.org/rfc/rfc9000.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 1035: Domain Names - Implementation and Specification"
    url: "https://www.rfc-editor.org/rfc/rfc1035.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 792: Internet Control Message Protocol"
    url: "https://www.rfc-editor.org/rfc/rfc792.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "Socket.ReceiveBufferSize Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.socket.receivebuffersize"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "UdpClient Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.udpclient"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

TCP and UDP sit at the same layer and share the same job, handing bytes from one program to another across an IP network, and they disagree about almost everything else. TCP turns an unreliable network into what looks like a single ordered stream of bytes; UDP hands over one packet at a time and promises nothing about any of them. Neither choice is free. This article builds a loopback client and server for each protocol, watches where TCP's guarantees come from and what they cost when a receiver falls behind, and watches what happens to UDP when nobody is listening.

## What each one actually promises

RFC 9293 states TCP's job in one line: "TCP provides a reliable, in-order, byte-stream service to applications" ([RFC 9293, section 2.2](https://www.rfc-editor.org/rfc/rfc9293.html#section-2.2)). Three separate words are doing work there, and UDP fails all three on purpose. RFC 768 is even shorter about it: UDP "provides a procedure for application programs to send messages to other programs with a minimum of protocol mechanism. The protocol is transaction oriented, and delivery and duplicate protection are not guaranteed" ([RFC 768](https://www.rfc-editor.org/rfc/rfc768.html)).

**What TCP promises:**

| Guarantee | TCP |
|---|---|
| Delivery | Retransmits until acked |
| Order | Stream stays in order |
| Duplicates | Removed |
| Structure | None: one continuous stream |
| Pace | Flow + congestion control |

**What UDP promises:**

| Guarantee | UDP |
|---|---|
| Delivery | Lost datagram just gone |
| Order | Independent; no order |
| Duplicates | Not removed |
| Structure | One datagram per send |
| Pace | None: no slow-down |

The last two rows in each table are where most confusion starts, because they cut in opposite directions: TCP gives you delivery but takes away your message boundaries, and UDP gives you message boundaries but takes away delivery. The rest of this article is a handful of small loopback programs that make each row concrete.

## Datagrams keep their shape; a stream does not

This program starts a UDP "server," really just another `UdpClient` bound to a loopback port, that echoes back whatever it receives. The client sends three messages of different lengths, one after another, with no delay between them, then reads three replies.

```csharp run id=udp-echo
using System.Net;
using System.Net.Sockets;
using System.Text;

var server = new UdpClient(
    new IPEndPoint(IPAddress.Loopback, 0));
var serverEnd =
    (IPEndPoint)server.Client.LocalEndPoint!;

Task echo = Task.Run(async () =>
{
    for (int i = 0; i < 3; i++)
    {
        UdpReceiveResult msg =
            await server.ReceiveAsync();
        await server.SendAsync(
            msg.Buffer, msg.RemoteEndPoint);
    }
});

using var client = new UdpClient(0);
string[] sent =
[
    "0:a",
    "1:a longer second message",
    "2:z",
];
foreach (string s in sent)
    await client.SendAsync(
        Encoding.ASCII.GetBytes(s), serverEnd);

var byIndex = new string[3];
for (int i = 0; i < sent.Length; i++)
{
    UdpReceiveResult reply =
        await client.ReceiveAsync();
    string text =
        Encoding.ASCII.GetString(reply.Buffer);
    int colon = text.IndexOf(':');
    int idx = int.Parse(text[..colon]);
    byIndex[idx] =
        $"{reply.Buffer.Length,2} bytes -> " +
        $"\"{text[(colon + 1)..]}\"";
}
await echo;
for (int i = 0; i < byIndex.Length; i++)
    Console.WriteLine($"reply {i}: {byIndex[i]}");
```

```text output
reply 0:  3 bytes -> "a"
reply 1: 25 bytes -> "a longer second message"
reply 2:  3 bytes -> "z"
```

Each `ReceiveAsync` returns exactly one `SendAsync`, byte for byte. Notice the code does not assume the three replies come back in the order they were sent: it reads an index off the front of each message and files the reply into that slot. RFC 768 promises the receiver gets whichever complete datagrams arrive, each intact, and nothing about their relative order; matching by content instead of position is how a program should treat that promise, not by hoping loopback happens to preserve order.

::::exercise[Send without waiting for any of it]
Change the sending loop above so all three `SendAsync` calls start together with `Task.WhenAll`, instead of one after another. Before running it, predict whether the three replies still come back as three separate, correctly sized messages.

:::solution
Yes. UDP does not care how the sends were scheduled on the client; the kernel still hands the receiver one datagram per send, each with its original length. Concurrent sending can change *which* reply arrives in *which* order (a reason the earlier program keys on the embedded index rather than position), but it cannot merge two datagrams into one or split one into two.

```csharp run
using System.Net;
using System.Net.Sockets;
using System.Text;

var server = new UdpClient(
    new IPEndPoint(IPAddress.Loopback, 0));
var serverEnd =
    (IPEndPoint)server.Client.LocalEndPoint!;

Task echo = Task.Run(async () =>
{
    for (int i = 0; i < 3; i++)
    {
        UdpReceiveResult msg =
            await server.ReceiveAsync();
        await server.SendAsync(
            msg.Buffer, msg.RemoteEndPoint);
    }
});

using var client = new UdpClient(0);
string[] sent = ["0:x", "1:yy", "2:zzz"];
await Task.WhenAll(sent.Select(s =>
    client.SendAsync(
        Encoding.ASCII.GetBytes(s),
        serverEnd).AsTask()));

var byIndex = new string[3];
for (int i = 0; i < sent.Length; i++)
{
    UdpReceiveResult reply =
        await client.ReceiveAsync();
    string text =
        Encoding.ASCII.GetString(reply.Buffer);
    int colon = text.IndexOf(':');
    int idx = int.Parse(text[..colon]);
    byIndex[idx] =
        $"{reply.Buffer.Length,2} bytes -> " +
        $"\"{text[(colon + 1)..]}\"";
}
await echo;
for (int i = 0; i < byIndex.Length; i++)
    Console.WriteLine($"reply {i}: {byIndex[i]}");
```

```text output
reply 0:  3 bytes -> "x"
reply 1:  4 bytes -> "yy"
reply 2:  5 bytes -> "zzz"
```
:::
::::

Now the same experiment over TCP, with a deliberately dumb echo: the server waits 200 ms (long enough for all three writes to have arrived), does exactly one `ReadAsync`, and echoes back whatever that single call returned.

```csharp run id=tcp-echo
using System.Net;
using System.Net.Sockets;
using System.Text;

var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    using TcpClient peer =
        await listener.AcceptTcpClientAsync();
    NetworkStream stream = peer.GetStream();
    await Task.Delay(200);
    var buffer = new byte[256];
    int n = await stream.ReadAsync(buffer);
    Console.WriteLine(
        $"server: one Read returned {n} bytes");
    await stream.WriteAsync(buffer.AsMemory(0, n));
});

using var client = new TcpClient();
await client.ConnectAsync(IPAddress.Loopback, port);
NetworkStream toServer = client.GetStream();

string[] sent = ["a", "bb", "ccc"];
foreach (string s in sent)
    await toServer.WriteAsync(
        Encoding.ASCII.GetBytes(s));

var reply = new byte[256];
int total = await toServer.ReadAsync(reply);
Console.WriteLine(
    "client: got back " +
    $"\"{Encoding.ASCII.GetString(reply, 0, total)}\" " +
    $"({total} bytes for {sent.Length} writes)");
listener.Stop();
await server;
```

```text output
server: one Read returned 6 bytes
client: got back "abbccc" (6 bytes for 3 writes)
```

Three writes went in; one read came out, with the three messages run together and no marker between them. RFC 9293 calls this out directly: "applications may perform writes at the granularity of messages in the upper-layer protocol, but TCP guarantees no correlation between the boundaries of TCP segments sent and received and the boundaries of the read or write buffers of user application data" ([RFC 9293, section 3.7](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.7)). Nothing here is a bug in `NetworkStream`. The connection genuinely does not know where one write ended and the next began; three writes might just as easily have shown up as three separate reads, or two, depending on timing the application does not control.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="shape-title shape-desc">
<title id="shape-title">UDP keeps message boundaries; TCP does not</title>
<desc id="shape-desc">Top: three UDP sends arrive as three separate receives, matched one to one. Bottom: three TCP writes sit in one continuous stream with no gaps, and a single read pulls back all three runs together as one block of bytes.</desc>
<defs>
<marker id="shape-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="shape-arrow-acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="16" class="d-bold d-small">UDP: three sends, three receives</text>
<rect x="20" y="24" width="90" height="26" rx="4" class="d-box"/>
<text x="65" y="42" text-anchor="middle" class="d-mono d-small">send 1</text>
<rect x="135" y="24" width="90" height="26" rx="4" class="d-box"/>
<text x="180" y="42" text-anchor="middle" class="d-mono d-small">send 2</text>
<rect x="250" y="24" width="90" height="26" rx="4" class="d-box"/>
<text x="295" y="42" text-anchor="middle" class="d-mono d-small">send 3</text>
<path d="M65 50 V78" class="d-line" marker-end="url(#shape-arrow)"/>
<path d="M180 50 V78" class="d-line" marker-end="url(#shape-arrow)"/>
<path d="M295 50 V78" class="d-line" marker-end="url(#shape-arrow)"/>
<rect x="20" y="80" width="90" height="26" rx="4" class="d-box-good"/>
<text x="65" y="98" text-anchor="middle" class="d-mono d-small">recv 1</text>
<rect x="135" y="80" width="90" height="26" rx="4" class="d-box-good"/>
<text x="180" y="98" text-anchor="middle" class="d-mono d-small">recv 2</text>
<rect x="250" y="80" width="90" height="26" rx="4" class="d-box-good"/>
<text x="295" y="98" text-anchor="middle" class="d-mono d-small">recv 3</text>
<text x="20" y="122" class="d-muted d-small">Each receive is one send, whatever the order.</text>
<path d="M20 142 H340" class="d-line d-dashed"/>
<text x="20" y="164" class="d-bold d-small">TCP: three writes, one stream</text>
<rect x="20" y="172" width="320" height="28" class="d-box"/>
<path d="M126 172 V200 M232 172 V200" class="d-line d-dashed"/>
<text x="73" y="190" text-anchor="middle" class="d-mono d-small">w1</text>
<text x="179" y="190" text-anchor="middle" class="d-mono d-small">w2</text>
<text x="286" y="190" text-anchor="middle" class="d-mono d-small">w3</text>
<path d="M180 200 V228" class="d-accent" marker-end="url(#shape-arrow-acc)"/>
<rect x="20" y="230" width="320" height="30" rx="4" class="d-box-accent"/>
<text x="180" y="250" text-anchor="middle" class="d-small d-bold">one Read: 6 bytes, all three</text>
<text x="20" y="280" class="d-muted d-small">No marker separates w1, w2 and w3</text>
<text x="20" y="296" class="d-muted d-small">in the stream; the app must add one.</text>
</svg>
<figcaption>Figure 1. The same three sends over UDP and over TCP. UDP hands back one receive per send; TCP hands back whatever bytes had accumulated by the time something read the stream.</figcaption>
</figure>

::::exercise[Read once per message sent]
A tempting fix is to keep the plain byte-stream server above but call `ReadAsync` exactly three times, once per message the client is expected to send, assuming each call returns one message's worth of bytes. Before running anything, predict what the second and third calls do.

:::solution
They wait, because there is nothing left to read. All three writes had already arrived and been consumed by the first `ReadAsync`, which returned all 6 bytes at once (as above); the second and third calls have no more data to return and no way to know that the "message" they are waiting for was already delivered. On a real connection, a call like this simply blocks until either more data arrives or the wait is abandoned; the program below bounds each call at 300 ms to show the wait instead of hanging.

```csharp run
using System.Net;
using System.Net.Sockets;
using System.Text;

var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    using TcpClient peer =
        await listener.AcceptTcpClientAsync();
    NetworkStream stream = peer.GetStream();
    await Task.Delay(200);
    var buffer = new byte[256];
    for (int i = 0; i < 3; i++)
    {
        using var limit =
            new CancellationTokenSource(
                TimeSpan.FromMilliseconds(300));
        try
        {
            int n = await stream.ReadAsync(
                buffer, limit.Token);
            Console.WriteLine(
                $"read {i}: {n} bytes");
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine(
                $"read {i}: timed out, " +
                "nothing more to read");
        }
    }
});

using var client = new TcpClient();
await client.ConnectAsync(IPAddress.Loopback, port);
NetworkStream toServer = client.GetStream();
foreach (string s in new[] { "a", "bb", "ccc" })
    await toServer.WriteAsync(
        Encoding.ASCII.GetBytes(s));

await server;
listener.Stop();
```

```text output
read 0: 6 bytes
read 1: timed out, nothing more to read
read 2: timed out, nothing more to read
```

"One read per message" is not a rule TCP has any way to honor.
:::
::::

## Framing a stream yourself

If message boundaries matter, TCP requires the application to put them there. A common, simple scheme is length-prefixing: send a fixed-size count of bytes ahead of each message, and have the reader pull exactly that many bytes regardless of how many `Read` calls it takes.

```csharp run id=tcp-framed
using System.Net;
using System.Net.Sockets;
using System.Text;

var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    using TcpClient peer =
        await listener.AcceptTcpClientAsync();
    NetworkStream stream = peer.GetStream();
    for (int i = 0; i < 3; i++)
    {
        byte[] msg = await ReadFramed(stream);
        await WriteFramed(stream, msg);
    }
});

using var client = new TcpClient();
await client.ConnectAsync(IPAddress.Loopback, port);
NetworkStream toServer = client.GetStream();

string[] sent = ["a", "bb", "ccc"];
foreach (string s in sent)
    await WriteFramed(
        toServer, Encoding.ASCII.GetBytes(s));

foreach (string s in sent)
{
    byte[] reply = await ReadFramed(toServer);
    Console.WriteLine(
        $"got \"{Encoding.ASCII.GetString(reply)}\"" +
        $", expected \"{s}\"");
}
listener.Stop();
await server;

static async Task WriteFramed(
    NetworkStream stream, byte[] payload)
{
    byte[] header =
        BitConverter.GetBytes(payload.Length);
    await stream.WriteAsync(header);
    await stream.WriteAsync(payload);
}

static async Task<byte[]> ReadFramed(
    NetworkStream stream)
{
    byte[] header = await ReadExact(stream, 4);
    int length = BitConverter.ToInt32(header);
    return await ReadExact(stream, length);
}

static async Task<byte[]> ReadExact(
    NetworkStream stream, int count)
{
    var buffer = new byte[count];
    int read = 0;
    while (read < count)
    {
        int n = await stream.ReadAsync(
            buffer.AsMemory(read));
        if (n == 0)
            throw new IOException("closed early");
        read += n;
    }
    return buffer;
}
```

```text output
got "a", expected "a"
got "bb", expected "bb"
got "ccc", expected "ccc"
```

`ReadExact` loops until it has the promised number of bytes, so it no longer matters whether the network delivered those bytes in one read, three reads or ten; the framing, not the read pattern, defines the message. This is what every text protocol built on TCP does one way or another: [HTTP/1.1](/networking/http-explained/) marks the end of a message with a blank line and either `Content-Length` or chunked encoding, and a length prefix like this one is the same idea with the count computed up front instead of counted out.

## The handshake, and what a lost segment costs

TCP's reliability starts before any data moves. Opening a connection is a three-segment exchange that RFC 9293 calls the three-way handshake: the initiator sends a segment with the SYN flag set and a starting sequence number; the responder answers with its own SYN, plus an acknowledgment of the initiator's sequence number; the initiator acknowledges that in turn ([RFC 9293, section 3.5](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.5)). With the plain `TcpClient`/`TcpListener` calls used throughout this article, no application data reaches the other side until this finishes, which is why opening a TCP connection costs a full round trip before anything useful goes anywhere. UDP has no such step: the first datagram a `UdpClient` sends is the first bit of application data to leave the machine.

<figure class="diagram">
<svg viewBox="0 0 360 230" role="img" aria-labelledby="hs-title hs-desc">
<title id="hs-title">The TCP three-way handshake, with sequence numbers</title>
<desc id="hs-desc">Client sends SYN with sequence number x. Server replies with SYN and sequence number y, acknowledging x+1. Client replies with ACK acknowledging y+1. Only after this does either side send data.</desc>
<defs>
<marker id="hs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="50" y="18" text-anchor="middle" class="d-bold d-small">client</text>
<text x="310" y="18" text-anchor="middle" class="d-bold d-small">server</text>
<path d="M50 26 V206" class="d-line d-dashed"/>
<path d="M310 26 V206" class="d-line d-dashed"/>
<text x="180" y="52" text-anchor="middle" class="d-mono d-small">SYN seq=x</text>
<path d="M54 58 H306" class="d-line" marker-end="url(#hs-arrow)"/>
<text x="180" y="98" text-anchor="middle" class="d-mono d-small">SYN seq=y, ACK x+1</text>
<path d="M306 104 H54" class="d-line" marker-end="url(#hs-arrow)"/>
<text x="180" y="144" text-anchor="middle" class="d-mono d-small">ACK y+1</text>
<path d="M54 150 H306" class="d-line" marker-end="url(#hs-arrow)"/>
<rect x="20" y="168" width="320" height="24" rx="4" class="d-box-accent"/>
<text x="180" y="185" text-anchor="middle" class="d-small">data may now flow either way</text>
<text x="20" y="214" class="d-muted d-small">One round trip spent before byte one moves.</text>
</svg>
<figcaption>Figure 2. x and y are each side's own starting sequence number, chosen independently. Every later byte is numbered relative to these, which is what lets a receiver detect a gap.</figcaption>
</figure>

Once the connection is open, every byte TCP sends is numbered, and every acknowledgment names the next byte the receiver expects; the retransmission timeout (RTO) that decides when to give up waiting and resend "must be dynamically determined" from measured round-trip time rather than fixed, computed according to the algorithm in RFC 6298 ([RFC 9293, section 3.8.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.8.1)). None of the programs above have shown a loss, because loopback essentially never drops a packet; the mechanism is still worth drawing, because it is the reason TCP can promise delivery over a network that drops packets constantly.

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="rto-title rto-desc">
<title id="rto-title">A lost segment and its retransmission</title>
<desc id="rto-desc">A data segment is sent and never acknowledged, shown as a faded arrow that does not reach the far side. After the retransmission timeout expires, the same segment is sent again, and this time an acknowledgment returns.</desc>
<defs>
<marker id="rto-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="rto-arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-bad"/></marker>
</defs>
<text x="50" y="18" text-anchor="middle" class="d-bold d-small">sender</text>
<text x="310" y="18" text-anchor="middle" class="d-bold d-small">receiver</text>
<path d="M50 26 V244" class="d-line d-dashed"/>
<path d="M310 26 V244" class="d-line d-dashed"/>
<text x="180" y="48" text-anchor="middle" class="d-mono d-small">DATA seq=1000</text>
<path d="M54 54 H260" class="d-bad d-dashed" marker-end="url(#rto-arrow-bad)"/>
<text x="200" y="78" text-anchor="middle" class="d-text-bad d-small">lost in the network</text>
<rect x="20" y="92" width="320" height="22" rx="4" class="d-box-2"/>
<text x="180" y="107" text-anchor="middle" class="d-small">sender's timer runs out: RTO expires</text>
<text x="180" y="140" text-anchor="middle" class="d-mono d-small">DATA seq=1000 (resent)</text>
<path d="M54 146 H306" class="d-line" marker-end="url(#rto-arrow)"/>
<text x="180" y="180" text-anchor="middle" class="d-mono d-small">ACK 1200</text>
<path d="M306 186 H54" class="d-line" marker-end="url(#rto-arrow)"/>
<text x="20" y="216" class="d-muted d-small">The receiver never signals the loss; the</text>
<text x="20" y="232" class="d-muted d-small">sender infers it purely from silence.</text>
<text x="20" y="250" class="d-muted d-small">seq=1000, len=200 -> next expected is 1200.</text>
</svg>
<figcaption>Figure 3. TCP has no negative acknowledgment. A missing ACK, not a report of loss, is what triggers a resend, which is why the timer has to be tuned to the connection's own round-trip time rather than a fixed guess.</figcaption>
</figure>

UDP has none of this. There is no retransmission timer because there is nothing to retransmit: once `SendAsync` returns, the datagram is the kernel's problem, and RFC 768 makes no promise about what happens to it next.

## Flow control: the receiver sets TCP's pace

Reliable delivery is only half of what a receiver needs from a sender; the other half is not being flooded faster than it can keep up. TCP's `Window` field in every segment tells the other side how many more bytes it is currently willing to accept ([RFC 9293, section 3.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.1)), and a sender that has filled that window has to stop, whether or not it has more to send. The next program makes a receiver that accepts the connection and then does nothing: it neither reads nor closes anything for a full second. The sender keeps writing 4&nbsp;KB chunks and, instead of blocking forever, races each write against a 150&nbsp;ms timer to show exactly where it stops making progress.

```csharp run id=tcp-window
using System.Net;
using System.Net.Sockets;

var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)listener.LocalEndpoint).Port;

Task<long> server = Task.Run(async () =>
{
    using TcpClient peer =
        await listener.AcceptTcpClientAsync();
    await Task.Delay(1000);
    NetworkStream stream = peer.GetStream();
    var buf = new byte[65536];
    long total = 0;
    int n;
    while ((n = await stream.ReadAsync(buf)) > 0)
        total += n;
    return total;
});

using var client = new TcpClient();
await client.ConnectAsync(IPAddress.Loopback, port);
NetworkStream toServer = client.GetStream();

var chunk = new byte[4096];
long sent = 0;
int writes = 0;
Task pending;
while (true)
{
    pending = toServer.WriteAsync(chunk).AsTask();
    if (await Task.WhenAny(
        pending, Task.Delay(150)) != pending)
        break;
    await pending;
    sent += chunk.Length;
    writes++;
}
Console.WriteLine(
    $"write {writes + 1} was still pending after " +
    $"150 ms; {sent} bytes had gone through before that");
await pending;
sent += chunk.Length;
toServer.Close();

long received = await server;
listener.Stop();
Console.WriteLine(
    "receiver drained everything sent: " +
    $"{received == sent}");
```

```text output
write [...] was still pending after 150 ms; [...] bytes had gone through before that
receiver drained everything sent: True
```

Measurements from here on were taken on .NET 10.0.401, on Windows 11, x64; the exact counts below are specific to that machine and this loopback network on 2026-09-22, and it is the shape of the result, not the digits, that would repeat elsewhere. The stall showed up consistently around 560 writes, roughly 2.3&nbsp;MB, well past the 4&nbsp;KB the program never actually configures as a window size: nothing here changes any buffer, so the number reflects whatever this operating system negotiates by default, and it will differ on another machine or another Windows build. The behavior it demonstrates does not: the client's `WriteAsync` calls succeed instantly at first, then suddenly stop completing, because the accepted connection's advertised window has closed while its owner is asleep. Once the server wakes up and starts reading, the pending write completes and the connection finishes normally; `received == sent` came back `True` on every run, which is the point. Nothing already accepted by the network was lost, it was only delayed exactly as long as the slow reader took to become fast again. That delay is the price flow control charges to keep a fast sender from overrunning a slow receiver's buffer.

:::pitfall
Do not read the stalled write above as "TCP was slow here." It was correct: the client asked to send more than the receiver had agreed to hold, and TCP made it wait rather than dropping data on the floor or silently overflowing the receiver's memory. A protocol without this mechanism would need the application to build its own, the same way [framing](#framing-a-stream-yourself) has to be built for message boundaries.
:::

## Congestion control: TCP's other brake

The stall above came from the receiver's advertised window, the limit covered in the last section. TCP has a second, independent brake with a different job: stopping a sender from overrunning the *network* between the two ends, since a router queue that fills up and starts dropping packets hurts every connection sharing that link, not just this one. RFC 9293 treats this as a hard requirement rather than an optional tuning knob: "implementing congestion control (e.g., [RFC 5681]) is a TCP requirement, but it is a complex topic on its own and not described in detail in this document" ([RFC 9293, section 2](https://www.rfc-editor.org/rfc/rfc9293.html#section-2)), and points to RFC 5681 for the actual algorithm.

Flow control is governed by the receiver's advertised window (the `Window` field from the last section, commonly written `rwnd`). Congestion control is governed by a second number the *sender* keeps for itself, the congestion window (`cwnd`), and a connection may only have the smaller of the two in flight at once. `rwnd` reflects what the receiver's buffer can hold; `cwnd` reflects what the sender believes the network path between them can carry right now, a number nothing on the wire states directly and that the sender has to infer from how its own segments are treated.

RFC 5681 defines two phases for how `cwnd` grows. In slow start, "a TCP increments cwnd by at most SMSS bytes for each ACK received that cumulatively acknowledges new data" ([RFC 5681, section 3.1](https://www.rfc-editor.org/rfc/rfc5681.html#section-3.1)), which roughly doubles the window every round trip; once `cwnd` passes a threshold called `ssthresh`, the connection switches to congestion avoidance, where "cwnd is incremented by roughly 1 full-sized segment per round-trip time" ([RFC 5681, section 3.1](https://www.rfc-editor.org/rfc/rfc5681.html#section-3.1)) instead, a far more cautious climb. Either way, growth only ever happens on evidence the network is coping: RFC 5681 is explicit that "the algorithms specified in this document work in terms of using loss as the signal of congestion" ([RFC 5681, section 3](https://www.rfc-editor.org/rfc/rfc5681.html#section-3)). A dropped segment, detected the same way the retransmission timeout earlier detects one, tells the sender it pushed too hard, and `cwnd` is cut back, not merely paused.

None of the loopback programs on this page can show `cwnd` changing, and that is not an oversight: loopback traffic never leaves the machine, crosses no shared or queued link, and essentially never drops a packet, so the one signal congestion control reacts to, loss, never occurs here. Every stall this article demonstrates comes from the receiver's advertised window, not from the sender's own congestion window. `cwnd` growing after a slow start and shrinking after a loss is real and observable on an actual network path (a packet capture on a congested link shows the segment spacing widen and then narrow again), just not on the loopback interface every program on this page runs against.

## No pace-setting: UDP keeps sending

`UdpClient` sends and receives "connectionless UDP datagrams" ([UdpClient class](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.udpclient#remarks)); UDP has no window field and nothing analogous to it. A sender has no way to learn whether the receiver's socket is being read, and no obligation to slow down if it is not. This program sends 200 one-kilobyte datagrams as fast as it can, entirely before it ever tries to receive one, to a server whose kernel receive buffer has deliberately been set small.

```csharp run id=udp-loss
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;

var server = new UdpClient(
    new IPEndPoint(IPAddress.Loopback, 0));
server.Client.ReceiveBufferSize = 4096;
var serverEnd =
    (IPEndPoint)server.Client.LocalEndPoint!;

using var client = new UdpClient(0);
var payload = new byte[1024];
var clock = Stopwatch.StartNew();
const int count = 200;
for (int i = 0; i < count; i++)
    await client.SendAsync(payload, serverEnd);
double sendMs = clock.Elapsed.TotalMilliseconds;

int received = 0;
try
{
    using var stop = new CancellationTokenSource(
        TimeSpan.FromMilliseconds(300));
    while (true)
    {
        await server.ReceiveAsync(stop.Token);
        received++;
    }
}
catch (OperationCanceledException) { }

Console.WriteLine(
    $"sent {count} datagrams in {sendMs,5:F1} ms " +
    "without a receiver reading yet");
Console.WriteLine(
    $"receiver saw {received} of {count}; the rest " +
    "were dropped with no error reported to the sender");
```

```text output
sent 200 datagrams in [...] ms without a receiver reading yet
receiver saw 4 of 200; the rest were dropped with no error reported to the sender
```

All 200 `SendAsync` calls succeeded; none threw, none blocked noticeably. `server.Client.ReceiveBufferSize = 4096` limits the receiving socket to buffering 4&nbsp;KB before the kernel starts discarding, and 4&nbsp;KB is exactly four of the 1024-byte datagrams. The other 196 were dropped by the operating system before this program ever called `ReceiveAsync`, and nothing told the sender that happened, which is exactly what RFC 768's "does not guarantee delivery" means in practice: not that loss is likely on every send, but that when it happens, silence is the only signal the sender gets.

::::exercise[Change the size of the slack]
`ReceiveBufferSize` was set to 4096 above. Predict, then measure, what happens to the count if that line is deleted and the socket is left with whatever buffer size .NET and Windows choose by default.

:::solution
More of the 200 datagrams arrive, because the default buffer is bigger than 4096 bytes, but it is still finite, so at a high enough send rate some are still dropped. On this machine, removing the explicit `ReceiveBufferSize` and re-running the program above changed the second line to:

```text
receiver saw 64 of 200; the rest were dropped with no error reported to the sender
```

64 datagrams of 1024 bytes is 64&nbsp;KB, a plausible default socket buffer size; [`Socket.ReceiveBufferSize`](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.socket.receivebuffersize) documents that "the default value depends on the operating system." Making the buffer bigger raises how much a sender can outrun a receiver before losses start; it never removes the possibility, and a program that needs to know what actually arrived still has to build that feedback itself, the same way it has to build message framing over TCP.
:::
::::

A related surprise: "connectionless" does not always mean "no error ever." If a `UdpClient` is `Connect`-ed to a fixed destination and that destination has nothing listening on the port, the sends themselves still succeed, because UDP has no handshake to fail. RFC 792 defines a Destination Unreachable message that a host "may" send back when a datagram arrives for a port with no process listening ([RFC 792](https://www.rfc-editor.org/rfc/rfc792.html)), and on Windows, a connected `UdpClient` surfaces that ICMP message as a `SocketException` on the *next* call, typically a receive, not the send that triggered it:

```csharp run
using System.Net;
using System.Net.Sockets;

using var client = new UdpClient(0);
client.Connect(IPAddress.Loopback, 59999);
var payload = new byte[] { 1, 2, 3 };

client.Send(payload);
Console.WriteLine("first send: no exception");
await Task.Delay(200);

try
{
    client.Client.ReceiveTimeout = 200;
    var buf = new byte[16];
    client.Client.Receive(buf);
    Console.WriteLine("receive: no exception");
}
catch (SocketException e)
{
    Console.WriteLine($"receive failed: {e.SocketErrorCode}");
}
```

```text output
first send: no exception
receive failed: ConnectionReset
```

Nobody was listening on port 59999, yet the send that went nowhere raised nothing; only the later receive discovered it, via an error code that on any other socket would suggest a broken connection. UDP has no connection to break, so treat that specific error as informational, not as proof that anything about the transport itself failed.

## What the guarantees cost in bytes

None of the above is free even when it works perfectly. A UDP header is four 16-bit fields, source port, destination port, length and checksum, for a fixed 8 bytes ([RFC 768](https://www.rfc-editor.org/rfc/rfc768.html)). A TCP header starts at 20 bytes and grows with options ([RFC 9293, section 3.1](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.1)); it carries a 32-bit sequence number and acknowledgment number that UDP has no use for, because UDP tracks neither order nor receipt. Opening a connection costs the round-trip handshake shown earlier, and closing one costs a four-way FIN exchange followed by a TIME-WAIT period before either side discards the connection's state ([RFC 9293, section 3.6](https://www.rfc-editor.org/rfc/rfc9293.html#section-3.6)). UDP has neither cost, because it has no connection state to open or close.

**UDP's cost:**

| | UDP |
|---|---|
| Header | 8 bytes |
| Setup | none |
| Bookkeeping | none |
| Close | none |

**TCP's cost:**

| | TCP |
|---|---|
| Header | 20+ bytes |
| Setup | 1 RTT handshake |
| Bookkeeping | seq numbers, timers, buffers |
| Close | 4-way FIN, then TIME-WAIT |

That overhead buys the delivery, order and pacing described earlier for every byte an application writes, whether or not the application actually needs all three for that particular byte. [A single DNS query](/networking/dns/) is the clearest case in the other direction: RFC 1035 recommends UDP for ordinary lookups specifically because a query and its answer are short and few, so a handshake would cost more than the query itself is worth. The same document caps a plain UDP DNS message at 512 bytes: "longer messages are truncated and the TC bit is set in the header" ([RFC 1035, section 4.2.1](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.2.1)), and TCP is defined on the same port 53 precisely so a resolver that gets a truncated answer can repeat the query there and receive the complete one, because past that size TCP's bookkeeping stops being the more expensive option.

## Choosing between TCP, UDP and building on top of UDP

RFC 8085 is written for exactly this decision, aimed at anyone building a protocol directly on UDP, and its core requirement is blunt: "it is up to the applications that use UDP for Internet communication to employ suitable mechanisms to prevent congestion collapse and establish a degree of fairness," because UDP itself provides none ([RFC 8085, section 1](https://www.rfc-editor.org/rfc/rfc8085.html#section-1)). For a bulk transfer, it recommends implementing TFRC or window-based TCP-like congestion control ([RFC 8085, section 3.1.2](https://www.rfc-editor.org/rfc/rfc8085.html#section-3.1.2)); for something that trades only a few datagrams, it recommends not sending more than one UDP datagram per round trip on average ([RFC 8085, section 3.1.3](https://www.rfc-editor.org/rfc/rfc8085.html#section-3.1.3)). Reaching for raw UDP without reading that is how a program becomes the thing everyone else's congestion control was tuned to compete against.

QUIC is what following that advice thoroughly looks like: a transport built on top of UDP datagrams, with its own sequence numbers, acknowledgments and congestion control, plus [TLS 1.3 folded in](/networking/tls-and-https/) rather than layered on afterward ([RFC 9000, section 1](https://www.rfc-editor.org/rfc/rfc9000.html#section-1)). It exists on UDP rather than as a new protocol next to TCP because "QUIC packets are carried in UDP datagrams... to better facilitate deployment," since operating systems, routers and firewalls everywhere already know how to move UDP ([RFC 9000, section 1](https://www.rfc-editor.org/rfc/rfc9000.html#section-1)). The part QUIC could not get from either existing protocol is independent streams: a single TCP connection is one byte stream, so one lost segment stalls every request sharing that connection, however unrelated, until the retransmission described earlier arrives; QUIC multiplexes several streams over one connection and does not order bytes on one stream relative to another ([RFC 9000, section 2](https://www.rfc-editor.org/rfc/rfc9000.html#section-2)), so a loss on one stream no longer blocks the others. That is a real gap TCP cannot close without becoming a different protocol, which is exactly why HTTP/3 moved to a UDP-based transport instead of trying to patch it into TCP.

::::exercise[Pick a transport]
For each case, name TCP, plain UDP, or a UDP-based protocol like QUIC that adds its own reliability, and say what guarantee (or its absence) drove the choice.

1. Submitting a payment amount to a bank's API.
2. A live multiplayer game sending each player's position, twenty times a second.
3. A voice call's audio frames.
4. A resolver's first attempt at looking up a short domain name.

:::solution
1. **TCP.** TCP guarantees the request's bytes arrive complete and in order on one connection, and it tells the application if the connection fails instead of silently losing data; that is what makes it the right transport for a payment. It does not by itself guarantee the payment happens exactly once: a client that times out after the request was actually processed has no way to learn that from TCP, and a naive retry can double-submit. Exactly-once still needs an idempotency key, or an equivalent, at the application layer on top of TCP's byte-level guarantee.
2. **Plain UDP**, usually with a small custom sequence number of the application's own so a receiver can tell an old position update from the current one. A position from 100 ms ago is worse than no update at all, so TCP's insistence on delivering everything, in order, before letting newer data through is actively harmful here.
3. **Plain UDP** for the same reason as the game: a late audio frame is useless once its moment has passed, and re-sending it only delays the frames after it. Real-time voice and video protocols build their own light error concealment instead of TCP's exhaustive retransmission.
4. **Plain UDP**, per RFC 1035's recommendation above; it is one small request and one small answer, cheap enough to just retry outright if it is lost, and a handshake would roughly double the cost of every lookup.
:::
::::
