---
title: "DNS: How Names Become Addresses"
description: "How a name becomes an address: the hierarchy, the recursive resolver's own iterative queries, real record types, TTL caching, and C# failure diagnostics."
pillar: networking
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [dns, recursive-resolution, dns-records, ttl-caching, dns-troubleshooting]
prerequisites: ["networking/how-the-internet-works"]
sources:
  - title: "RFC 1034: Domain Names - Concepts and Facilities"
    url: "https://www.rfc-editor.org/rfc/rfc1034.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 1035: Domain Names - Implementation and Specification"
    url: "https://www.rfc-editor.org/rfc/rfc1035.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 8499: DNS Terminology"
    url: "https://www.rfc-editor.org/rfc/rfc8499.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 2308: Negative Caching of DNS Queries (DNS NCACHE)"
    url: "https://www.rfc-editor.org/rfc/rfc2308.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 2606: Reserved Top Level DNS Names"
    url: "https://www.rfc-editor.org/rfc/rfc2606.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 5737: IPv4 Address Blocks Reserved for Documentation"
    url: "https://www.rfc-editor.org/rfc/rfc5737.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "Root Servers"
    url: "https://www.iana.org/domains/root/servers"
    publisher: "IANA"
    accessed: 2026-09-22
  - title: "Dns.GetHostAddresses Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostaddresses"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dns.GetHostEntry Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostentry"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

A DNS lookup is not one exchange with one server. It is a client asking a single question of a *recursive resolver*, and that resolver privately interrogating a chain of *authoritative* servers until it can hand back one finished answer. Those are two different resolution styles, layered, and mixing up which side does which is the single most common way people get DNS wrong.

If you have followed one HTTPS request end to end, you have already seen a DNS lookup happen as the first of four exchanges ([What Happens When You Request a URL, Step by Step in C#](/networking/how-the-internet-works/)). This article stays inside that first exchange and takes it apart: the hierarchy behind it, the two resolution styles, what each record type actually stores, what a TTL controls, and how to tell DNS failure modes apart from the wire up. Measurements and captured output below were taken on Windows 11, x64, with the .NET 10 SDK (10.0.401), on 2026-09-22; DNS answers depend on the network and the date, so most of the values below are wildcarded and a few are quoted separately as one dated capture.

## What is the hierarchy below the root?

A domain name reads right to left as a path through a tree. `www.iana.org` is the node `www`, under `iana`, under `org`, under the root, written `.`. The tree is cut into *zones*: "'cuts' in the name space can be made between any two adjacent nodes. After all cuts are made, each group of connected name space is a separate zone" ([RFC 1034, section 4.2](https://www.rfc-editor.org/rfc/rfc1034.html#section-4.2)). Each zone is authoritative for its own piece and stores, at the cut, an NS record set naming the servers for the zone below it — RFC 8499 calls this act of adding that NS set in the parent *delegation* ([RFC 8499, section 7](https://www.rfc-editor.org/rfc/rfc8499.html#section-7)).

Three levels matter for almost every lookup:

- **The root zone** (`.`) delegates each top-level domain — `org`, `com`, and so on — to that TLD's own servers. It is served by 13 letter-named services, `a.root-servers.net` through `m.root-servers.net`, each running on multiple physical machines behind anycast addresses ([IANA, Root Servers](https://www.iana.org/domains/root/servers)).
- **The TLD zone** (`org`) delegates each registered domain — `iana.org` — to the name servers its registrant chose.
- **The authoritative zone** for that domain (`iana.org`) holds the actual records: the A, MX, TXT and other data a client is really after.

Not every name that looks reserved is actually delegated. RFC 2606 reserves `.example`, `.test`, `.invalid` and `.localhost` as top-level domains "recommended for use in documentation" so nobody can register under them by accident ([RFC 2606, section 2](https://www.rfc-editor.org/rfc/rfc2606.html#section-2)); it does not say IANA created a working zone there. The failure-modes section below queries a name under `.example` directly and shows what actually comes back.

## What's the difference between a recursive resolver and an iterative one?

The program that runs on your machine is what RFC 8499 calls a *stub resolver*, and it does not walk the tree itself. It sends one query with the **RD** (recursion desired) bit set to a *recursive resolver* — your router, your ISP, or a public service such as `1.1.1.1` — and that single query is a *recursive query*: "the first server pursues the query for the client at another server" ([RFC 8499, section 6](https://www.rfc-editor.org/rfc/rfc8499.html#section-6)).

The recursive resolver is the one that does the walking, and it does not do it recursively. It performs *iterative resolution*: "the client repeatedly makes non-recursive queries and follows referrals and/or aliases" (same section). Concretely, it sends query after query with RD cleared to root, then to the TLD servers, then to the authoritative servers, following each *referral* — "a referral to name servers which have zones which are closer ancestors to the name than the server sending the reply" ([RFC 1034, section 4.3.1](https://www.rfc-editor.org/rfc/rfc1034.html#section-4.3.1)) — until one of them answers with authority. Only then does it turn that chain of iterative work into the single recursive answer it owes the stub resolver.

So "recursive" and "iterative" describe two different legs of the same lookup, not two competing ways to do the same leg: your machine's query is recursive; the resolver's queries to the hierarchy are iterative. A server's **RA** (recursion available) bit, not the RD bit a client sends, is what tells you whether a server actually offers to do that work; root, TLD and authoritative servers all leave RA clear.

<figure class="diagram">
<svg viewBox="0 0 360 380" role="img" aria-labelledby="dnswalk-title dnswalk-desc">
<title id="dnswalk-title">One recursive query becomes three iterative ones</title>
<desc id="dnswalk-desc">A stub resolver on the left sends one recursive query, RD=1, to a recursive resolver on the right. The resolver then makes three of its own iterative queries, RD=0, shown as loops on its own lifeline: to root, which refers it to the org TLD; to the org TLD, which refers it to iana.org's servers; and to iana.org's own authoritative server, which answers. Only then does the resolver send one recursive answer back to the stub resolver.</desc>
<defs>
<marker id="dnswalk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="55" y="20" text-anchor="middle" class="d-bold d-small">you</text>
<text x="290" y="20" text-anchor="middle" class="d-bold d-small">resolver</text>
<path d="M55 30 V366" class="d-line d-dashed"/>
<path d="M290 30 V366" class="d-line d-dashed"/>
<rect x="10" y="34" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="48" class="d-small d-bold">1 recursive query, RD=1</text>
<text x="172" y="70" text-anchor="middle" class="d-small d-mono">A? www.iana.org</text>
<path d="M59 76 H286" class="d-line" marker-end="url(#dnswalk-arrow)"/>
<rect x="10" y="92" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="106" class="d-small d-bold">2 resolver iterates, RD=0</text>
<path d="M290 128 C332 128 332 152 290 152" class="d-line" marker-end="url(#dnswalk-arrow)"/>
<text x="335" y="124" text-anchor="end" class="d-small">root</text>
<text x="20" y="168" class="d-muted d-small">referral: org's NS + glue</text>
<path d="M290 180 C332 180 332 204 290 204" class="d-line" marker-end="url(#dnswalk-arrow)"/>
<text x="335" y="176" text-anchor="end" class="d-small">.org TLD</text>
<text x="20" y="220" class="d-muted d-small">referral: iana.org's NS + glue</text>
<path d="M290 232 C332 232 332 256 290 256" class="d-line" marker-end="url(#dnswalk-arrow)"/>
<text x="335" y="228" text-anchor="end" class="d-small">iana.org auth</text>
<text x="20" y="272" class="d-text-good d-small">answer, aa=1: a CNAME</text>
<rect x="10" y="286" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="300" class="d-small d-bold">3 recursive answer</text>
<path d="M286 330 H59" class="d-line" marker-end="url(#dnswalk-arrow)"/>
<text x="172" y="324" text-anchor="middle" class="d-small">that CNAME, now cached</text>
<text x="20" y="356" class="d-muted d-small">One RD=1 query out; three RD=0</text>
<text x="20" y="370" class="d-muted d-small">queries the resolver runs, unseen.</text>
</svg>
<figcaption>Figure 1. The stub resolver's one recursive query, and the three iterative queries the recursive resolver makes on its behalf before it can answer.</figcaption>
</figure>

This program reproduces exactly that walk by talking UDP port 53 directly, first to a root server, then to whichever server each referral names, with RD cleared every time — the same three iterative hops Figure 1 draws.

```csharp run id=walk
using System.Net;
using System.Net.Sockets;
using System.Text;

byte[] BuildQuery(string name, ushort qtype)
{
    var msg = new List<byte>();
    void W16(int v)
    {
        msg.Add((byte)(v >> 8));
        msg.Add((byte)v);
    }
    W16(Random.Shared.Next(ushort.MaxValue));
    W16(0x0000); // RD = 0: iterative
    W16(1); W16(0); W16(0); W16(0);
    foreach (string label in name.Split('.'))
    {
        byte[] b = Encoding.ASCII.GetBytes(label);
        msg.Add((byte)b.Length);
        msg.AddRange(b);
    }
    msg.Add(0);
    W16(qtype); W16(1); // class IN
    return msg.ToArray();
}

string ReadName(byte[] buf, ref int pos)
{
    var name = new StringBuilder();
    int p = pos;
    bool jumped = false;
    while (buf[p] != 0)
    {
        if ((buf[p] & 0xC0) == 0xC0)
        {
            int target = ((buf[p] & 0x3F) << 8) | buf[p + 1];
            if (!jumped) pos = p + 2;
            jumped = true;
            p = target;
            continue;
        }
        int len = buf[p];
        name.Append(Encoding.ASCII.GetString(buf, p + 1, len));
        name.Append('.');
        p += len + 1;
    }
    if (!jumped) pos = p + 1;
    return name.Length > 0
        ? name.ToString(0, name.Length - 1) : "";
}

async Task<byte[]> Ask(string server, string name, ushort qtype)
{
    using var udp = new UdpClient();
    byte[] q = BuildQuery(name, qtype);
    var ep = new IPEndPoint(IPAddress.Parse(server), 53);
    await udp.SendAsync(q, q.Length, ep);
    Task<UdpReceiveResult> recv = udp.ReceiveAsync();
    if (await Task.WhenAny(recv, Task.Delay(4000)) != recv)
        throw new TimeoutException($"{server} silent");
    return (await recv).Buffer;
}

(bool aa, int answerCount, string answer,
    List<string> delegated, string glueIp) Step(byte[] buf)
{
    bool aa = (buf[2] & 0x04) != 0;
    int an = (buf[6] << 8) | buf[7];
    int nsCount = (buf[8] << 8) | buf[9];
    int arCount = (buf[10] << 8) | buf[11];
    int pos = 12;
    ReadName(buf, ref pos);
    pos += 4;
    string answer = "";
    for (int i = 0; i < an; i++)
    {
        ReadName(buf, ref pos);
        int type = (buf[pos] << 8) | buf[pos + 1];
        pos += 8; // type, class, ttl
        int len = (buf[pos] << 8) | buf[pos + 1];
        pos += 2;
        int p2 = pos;
        answer = type == 5 ? "CNAME " + ReadName(buf, ref p2)
            : $"type {type}";
        pos += len;
    }
    var delegated = new List<string>();
    for (int i = 0; i < nsCount; i++)
    {
        ReadName(buf, ref pos);
        pos += 8;
        int len = (buf[pos] << 8) | buf[pos + 1];
        pos += 2;
        int p2 = pos;
        delegated.Add(ReadName(buf, ref p2));
        pos += len;
    }
    delegated.Sort();
    string glueIp = "";
    for (int i = 0; i < arCount; i++)
    {
        ReadName(buf, ref pos);
        int type = (buf[pos] << 8) | buf[pos + 1];
        pos += 8;
        int len = (buf[pos] << 8) | buf[pos + 1];
        pos += 2;
        if (type == 1 && glueIp == "")
            glueIp = $"{buf[pos]}.{buf[pos+1]}." +
                     $"{buf[pos+2]}.{buf[pos+3]}";
        pos += len;
    }
    return (aa, an, answer, delegated, glueIp);
}

const string root = "198.41.0.4"; // a.root-servers.net
const string name = "www.iana.org";
string[] hops = ["root", ".org TLD", "iana.org auth"];
string server = root;
try
{
    for (int i = 0; i < hops.Length; i++)
    {
        byte[] buf = await Ask(server, name, 1);
        var s = Step(buf);
        Console.WriteLine(
            $"{hops[i],-13} aa={s.aa} " +
            (s.answerCount > 0
                ? $"answer={s.answer}"
                : $"referral, {s.delegated.Count} NS"));
        if (s.answerCount > 0) break;
        server = s.glueIp;
    }
}
catch (Exception e) when (e is SocketException or TimeoutException)
{
    Console.WriteLine($"walk failed: {e.GetType().Name}");
}
```

```text output
root          aa=False referral, [...] NS
.org TLD      aa=False referral, [...] NS
iana.org auth aa=True answer=[...]
```

The run used for this page, 2026-09-22:

```text
root          aa=False referral, 6 NS
.org TLD      aa=False referral, 4 NS
iana.org auth aa=True
  answer=CNAME
  www.iana.org.cdn.cloudflare.net
```

Every hop clears `aa` except the last, exactly the invariant RFC 1034 describes: a server answers with authority only for the zone it actually holds, and refers you elsewhere for everything else. The final answer is a CNAME, not an A record — `iana.org`'s zone does not hold an address for `www`, it holds an alias into a CDN's own zone, which is why "what each record type stores" comes next.

Every query above went out as one UDP datagram, which is the normal case: "messages carried by UDP are restricted to 512 bytes (not counting the IP or UDP headers). Longer messages are truncated and the TC bit is set in the header" ([RFC 1035, section 4.2.1](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.2.1)). The root's referral above, with six NS records and their glue, still fit; a bigger answer — a large TXT record, or a signed zone's DNSSEC records — can set that TC bit, and a client that respects it retries the identical query over a TCP connection to the same server rather than trusting a half-arrived UDP answer.

::::exercise[Predict a root server's response to RD=1]
The program above always clears RD. Change the `0x0000` in `BuildQuery` to `0x0100` (RD = 1) and query the root server directly for `example.com`. Before running it, predict: does the root server perform the recursive walk for you and hand back an A record?

:::solution
No. Root servers do not offer recursion at all, so setting RD on the query changes nothing about the reply; RFC 1035 defines RA as a bit "set or cleared in a response, and denotes whether recursive query support is available in the name server" ([RFC 1035, section 4.1.1](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.1.1)) — it is the server's own declaration, not something a client can request into existence.

```csharp run
using System.Net;
using System.Net.Sockets;
using System.Text;

byte[] BuildQuery(string name, ushort qtype)
{
    var msg = new List<byte>();
    void W16(int v)
    {
        msg.Add((byte)(v >> 8));
        msg.Add((byte)v);
    }
    W16(Random.Shared.Next(ushort.MaxValue));
    W16(0x0100); // RD = 1, asked anyway
    W16(1); W16(0); W16(0); W16(0);
    foreach (string label in name.Split('.'))
    {
        byte[] b = Encoding.ASCII.GetBytes(label);
        msg.Add((byte)b.Length);
        msg.AddRange(b);
    }
    msg.Add(0);
    W16(qtype); W16(1);
    return msg.ToArray();
}

using var udp = new UdpClient();
byte[] q = BuildQuery("example.com", 1);
var ep = new IPEndPoint(
    IPAddress.Parse("198.41.0.4"), 53);
await udp.SendAsync(q, q.Length, ep);
UdpReceiveResult r = await udp.ReceiveAsync();
byte[] buf = r.Buffer;
int flags = (buf[2] << 8) | buf[3];
bool ra = (flags & 0x80) != 0;
int an = (buf[6] << 8) | buf[7];
int ns = (buf[8] << 8) | buf[9];
Console.WriteLine(
    $"ra={ra} answers={an} referral-ns={ns}");
```

```text output
ra=[...] answers=[...] referral-ns=[...]
```

The run used for this page: `ra=False answers=0 referral-ns=13` — still a bare referral to the 13 `.com` servers, still `ra=False`. The client's RD bit is a request; the server you actually reached is the one that decides, and a root server's answer is that it never recurses for anyone.
:::
::::

## What does each record type actually store?

RFC 1035 defines a fixed set of resource record types, each a 16-bit number carried in every query and answer: "A 1 a host address", "NS 2 an authoritative name server", "CNAME 5 the canonical name for an alias", "MX 15 mail exchange", "TXT 16 text strings" ([RFC 1035, section 3.2.2](https://www.rfc-editor.org/rfc/rfc1035.html#section-3.2.2)).

| Type | # | Stores | RFC 1035 RDATA |
|---|--:|---|---|
| A | 1 | An IPv4 address | "ADDRESS A 32 bit Internet address" |
| AAAA | 28 | An IPv6 address (RFC 3596, not RFC 1035) | 128-bit address |
| CNAME | 5 | Another name to look up instead | "A `<domain-name>` which specifies the canonical ... name" |
| NS | 2 | A name server authoritative for this zone | "A `<domain-name>` which specifies a host ... authoritative" |
| MX | 15 | A mail server and its preference | "PREFERENCE", then "a host willing to act as a mail exchange" |
| TXT | 16 | Free-form text | "One or more `<character-string>`s" |

`Dns.GetHostAddressesAsync` asks for A and AAAA and hides the wire format entirely; it calls the operating system's resolver rather than speaking DNS itself, and "IPv6 addresses are filtered from the results ... if the local computer does not have IPv6 installed" ([Microsoft Learn, Dns.GetHostAddresses, Remarks](https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostaddresses#remarks)). `Dns.GetHostEntryAsync` does the reverse: given an address, it looks up the PTR record and returns it as `HostName`.

```csharp run id=addresses
using System.Net;

const string host = "example.com";
IPAddress[] found = await Dns.GetHostAddressesAsync(host);
Console.WriteLine(
    $"{host}: {found.Length} found, " +
    $"first {found[0]} ({found[0].AddressFamily})");

foreach (string ip in new[] { "1.1.1.1", "8.8.8.8" })
{
    IPHostEntry entry =
        await Dns.GetHostEntryAsync(IPAddress.Parse(ip));
    Console.WriteLine($"{ip,-9} -> {entry.HostName}");
}
```

```text output
example.com: [...] found, first [...] ([...])
1.1.1.1   -> one.one.one.one
8.8.8.8   -> dns.google
```

`GetHostAddressesAsync` only ever asks for A/AAAA, so the other types need the same wire-level approach as the walk above. This program asks `iana.org`'s own authoritative server (found the way the walk above found it) for its NS and MX records directly, then asks a recursive resolver for `example.com`'s TXT records, since a domain's own authoritative server is not guaranteed to hold every record type a reader might want and `example.com`'s is queried differently for this page.

```csharp run id=records
using System.Net;
using System.Net.Sockets;
using System.Text;

byte[] BuildQuery(string name, ushort qtype, bool rd)
{
    var msg = new List<byte>();
    void W16(int v)
    {
        msg.Add((byte)(v >> 8));
        msg.Add((byte)v);
    }
    W16(Random.Shared.Next(ushort.MaxValue));
    W16(rd ? 0x0100 : 0x0000);
    W16(1); W16(0); W16(0); W16(0);
    foreach (string label in name.Split('.'))
    {
        byte[] b = Encoding.ASCII.GetBytes(label);
        msg.Add((byte)b.Length);
        msg.AddRange(b);
    }
    msg.Add(0);
    W16(qtype); W16(1);
    return msg.ToArray();
}

string ReadName(byte[] buf, ref int pos)
{
    var name = new StringBuilder();
    int p = pos;
    bool jumped = false;
    while (buf[p] != 0)
    {
        if ((buf[p] & 0xC0) == 0xC0)
        {
            int target = ((buf[p] & 0x3F) << 8) | buf[p + 1];
            if (!jumped) pos = p + 2;
            jumped = true;
            p = target;
            continue;
        }
        int len = buf[p];
        name.Append(Encoding.ASCII.GetString(buf, p + 1, len));
        name.Append('.');
        p += len + 1;
    }
    if (!jumped) pos = p + 1;
    return name.Length > 0
        ? name.ToString(0, name.Length - 1) : "";
}

async Task<byte[]> Ask(
    string server, string name, ushort qtype, bool rd)
{
    using var udp = new UdpClient();
    byte[] q = BuildQuery(name, qtype, rd);
    var ep = new IPEndPoint(IPAddress.Parse(server), 53);
    await udp.SendAsync(q, q.Length, ep);
    return (await udp.ReceiveAsync()).Buffer;
}

// iana.org's own authoritative server,
// found the same way the walk above found it
const string iana = "199.4.138.53";
var lines = new List<string>();
foreach (ushort type in new ushort[] { 2, 15 }) // NS, MX
{
    byte[] buf = await Ask(iana, "iana.org", type, false);
    int count = (buf[6] << 8) | buf[7];
    int pos = 12;
    ReadName(buf, ref pos);
    pos += 4;
    for (int i = 0; i < count; i++)
    {
        ReadName(buf, ref pos);
        pos += 4; // type, class
        uint ttl = (uint)((buf[pos] << 24) | (buf[pos + 1] << 16)
            | (buf[pos + 2] << 8) | buf[pos + 3]);
        pos += 4;
        int len = (buf[pos] << 8) | buf[pos + 1];
        pos += 2;
        int start = pos;
        int p2 = type == 15 ? pos + 2 : pos;
        string target = ReadName(buf, ref p2);
        string kind = type == 2 ? "NS" : "MX";
        lines.Add($"{kind} ttl={ttl} {target}");
        pos = start + len;
    }
}
lines.Sort();
foreach (string line in lines) Console.WriteLine(line);

byte[] txt = await Ask("1.1.1.1", "example.com", 16, true);
int txtCount = (txt[6] << 8) | txt[7];
Console.WriteLine($"example.com TXT: {txtCount} record(s)");
```

```text output
MX ttl=3600 pechora1.icann.org
MX ttl=3600 pechora6.icann.org
MX ttl=3600 pechora7.icann.org
MX ttl=3600 pechora8.icann.org
NS ttl=86400 a.iana-servers.net
NS ttl=86400 b.iana-servers.net
NS ttl=86400 c.iana-servers.net
NS ttl=86400 ns.icann.org
example.com TXT: [...] record(s)
```

These are direct answers from `iana.org`'s own authoritative server, not a caching resolver's copy, so every run used to check this page found the same content and the same two TTLs: 86400 seconds for every NS record, 3600 for every MX record. `example.com`'s TXT records went through a caching recursive resolver instead, so their count is wildcarded; the run used for this page found 2, one of them `v=spf1 -all` — the record format is simply one or more strings, and mail systems, domain-verification tools and anything else that wants to stash text next to a name reuse it rather than inventing a new type.

The CNAME case is already above: `www.iana.org` has no A record of its own in `iana.org`'s zone, only a CNAME into a name that belongs to a different zone entirely. A resolver chasing that answer has to start the walk over for the new name before it can hand back an address — CNAME is the one type whose value is itself a question, not an answer.

## What does a TTL actually control?

Every resource record carries its own TTL, and it means exactly one thing: "how long a RR can be cached before it should be discarded" ([RFC 1034, section 3.6](https://www.rfc-editor.org/rfc/rfc1034.html#section-3.6)) by whatever holds a copy of it. That "whatever" is not one cache. A stub resolver's operating system keeps one, the recursive resolver you asked keeps another, and a browser can keep a third; each one starts its own countdown at the moment it first cached the record and serves that copy until its own countdown reaches zero, independently of what the other caches are doing. Two caches that fetched the same record ten seconds apart are ten seconds out of sync until both expire.

The `iana.org` records above show how differently zone operators set this. The NS records — which server is authoritative — carry an 86400-second (one day) TTL; delegation rarely changes, and a resolver holding a day-old NS set is in no danger of pointing at the wrong servers. The MX records carry 3600 seconds (one hour), tighter because operators expect to repoint mail delivery faster than they repoint delegation. `example.com`'s A record is fronted by a CDN, where addresses can rotate for load balancing, so its TTL runs to double digits or low hundreds of seconds rather than a full day.

:::note[Absence gets cached too]
A missing answer is cached exactly like a present one. When a name genuinely does not exist, the authoritative server's response carries its zone's SOA record in the authority section, and "the TTL of this record is set from the minimum of the MINIMUM field of the SOA record and the TTL of the SOA itself, and indicates how long a resolver may cache the negative answer" ([RFC 2308, section 3](https://www.rfc-editor.org/rfc/rfc2308.html#section-3)). RFC 2308 also recommends a ceiling on that: "values of one to three hours have been found to work well ... values exceeding one day have been found to be problematic" ([RFC 2308, section 5](https://www.rfc-editor.org/rfc/rfc2308.html#section-5)).
:::

That is the real mechanism behind "I fixed the record and I'm still seeing the old value": there is no separate propagation delay to wait out. There is only whichever TTL governs the copy you happen to be hitting — a positive one if the old answer is still cached, or a negative one, bounded by the zone's SOA, if you deleted a record and are now getting a cached "doesn't exist" for the name you meant to add.

## What do DNS failure modes look like, and how do you tell them apart?

A DNS query fails in exactly a few distinguishable ways, and RFC 1035 gives each one a number in the response header's RCODE field: `0` no error, `1` format error, `2` "the name server was unable to process this query due to a problem with the name server" (SERVFAIL), `3` "the domain name referenced in the query does not exist" (NXDOMAIN, meaningful only from an authoritative server), `4` not implemented, `5` refused ([RFC 1035, section 4.1.1](https://www.rfc-editor.org/rfc/rfc1035.html#section-4.1.1)). A query that gets no response at all is a fourth case the header can't carry, because there is no header — it is a timeout.

This program produces all three you are likely to hit, plus one to compare against: a name that provably does not exist, an address that provably will not answer, and a server built to answer with an error.

```csharp run id=failures
using System.Net;
using System.Net.Sockets;
using System.Text;

byte[] BuildQuery(string name, ushort qtype)
{
    var msg = new List<byte>();
    void W16(int v)
    {
        msg.Add((byte)(v >> 8));
        msg.Add((byte)v);
    }
    W16(Random.Shared.Next(ushort.MaxValue));
    W16(0x0000);
    W16(1); W16(0); W16(0); W16(0);
    foreach (string label in name.Split('.'))
    {
        byte[] b = Encoding.ASCII.GetBytes(label);
        msg.Add((byte)b.Length);
        msg.AddRange(b);
    }
    msg.Add(0);
    W16(qtype); W16(1);
    return msg.ToArray();
}

async Task<byte[]?> Ask(
    string server, string name, ushort qtype,
    int timeoutMs, int port = 53)
{
    using var udp = new UdpClient();
    byte[] q = BuildQuery(name, qtype);
    var ep = new IPEndPoint(IPAddress.Parse(server), port);
    await udp.SendAsync(q, q.Length, ep);
    try
    {
        Task<UdpReceiveResult> recv = udp.ReceiveAsync();
        return await Task.WhenAny(recv, Task.Delay(timeoutMs)) == recv
            ? (await recv).Buffer : null;
    }
    catch (SocketException)
    {
        // A router on the path can refuse a documentation
        // address immediately (ICMP unreachable) instead of
        // just staying silent; treat both as "no answer".
        return null;
    }
}

// 1. NXDOMAIN: .example is reserved by RFC 2606 but was
// never delegated, so the root itself is authoritative
// for the fact that this name does not exist.
byte[]? nx = await Ask(
    "198.41.0.4", "nothing-here.example", 1, 4000);
if (nx is { } buf1)
{
    int rcode = ((buf1[2] << 8) | buf1[3]) & 0xF;
    Console.WriteLine($"NXDOMAIN test: rcode={rcode}");
}

// 2. Timeout: 192.0.2.1 is TEST-NET-1, reserved so it
// can never be a real, answering address.
byte[]? to = await Ask("192.0.2.1", "example.com", 1, 3000);
Console.WriteLine(
    $"timeout test: {(to is null ? "no reply" : "answered")}");

// 3. SERVFAIL: a fake authoritative server, on loopback,
// built to refuse every query.
using var fake = new UdpClient(
    new IPEndPoint(IPAddress.Loopback, 0));
int fakePort = ((IPEndPoint)fake.Client.LocalEndPoint!).Port;
Task server = Task.Run(async () =>
{
    UdpReceiveResult req = await fake.ReceiveAsync();
    byte[] reply = (byte[])req.Buffer.Clone();
    reply[2] = 0x80; // QR=1 (response)
    reply[3] = 0x02; // RCODE=2, SERVFAIL
    await fake.SendAsync(
        reply, reply.Length, req.RemoteEndPoint);
});
byte[]? sf = await Ask(
    "127.0.0.1", "broken.test", 1, 2000, fakePort);
await Task.WhenAny(server, Task.Delay(2000));
if (sf is { } buf2)
{
    int rcode = ((buf2[2] << 8) | buf2[3]) & 0xF;
    Console.WriteLine($"SERVFAIL test: rcode={rcode}");
}

// 4. What System.Net.Dns does with the NXDOMAIN name
try
{
    await Dns.GetHostAddressesAsync("nothing-here.example");
}
catch (SocketException e)
{
    Console.WriteLine(
        $"Dns.GetHostAddressesAsync -> " +
        $"SocketException {e.SocketErrorCode}");
}
```

```text output
NXDOMAIN test: rcode=3
timeout test: no reply
SERVFAIL test: rcode=2
Dns.GetHostAddressesAsync -> SocketException HostNotFound
```

At the wire, NXDOMAIN and SERVFAIL are unambiguous, different numbers. `Dns.GetHostAddressesAsync` does not preserve that distinction: Microsoft's own documentation of the equivalent `GetHostEntry` call says the identical `HostNotFound` exception (Windows Sockets error 11001) "can be returned if the DNS server does not respond" and separately "if ... it cannot be found in the database(s) being queried" ([Microsoft Learn, Dns.GetHostEntry, Remarks](https://learn.microsoft.com/en-us/dotnet/api/system.net.dns.gethostentry#remarks)) — a genuinely missing name and an upstream server's failure surface through the same catch block. If your code needs to react differently to "this name doesn't exist" versus "something upstream is broken", catching `SocketException` cannot tell you which; you have to read the RCODE yourself, the way the program above does.

That gives a short, real decision procedure for "the lookup failed":

- **No response inside your timeout** — the server address is wrong, unreachable, or a firewall is dropping the packets, as the TEST-NET-1 case simulates. Some paths answer that with silence; others answer it faster, with an ICMP "unreachable" that turns into a `SocketException` on the receive, which is why the program above catches one around a plain timeout. Retrying the same server will not help; a different resolver, or a route to the same one, might.
- **RCODE 3, NXDOMAIN, from an authoritative answer** — the name genuinely does not exist under that parent. Check the spelling and the zone, not the network.
- **RCODE 2, SERVFAIL** — the server tried and gave up: a broken delegation, an unreachable upstream on its own path, or (for a validating resolver) a signature it could not verify. The failure is at the server you asked or beyond it, not at the name itself.
- **A stale answer instead of a failure** — not an error at all; see the TTL section above before assuming anything is broken.

::::exercise[Extend the negative-caching demo]
RFC 2308 says the effective negative-cache TTL is "the minimum of the MINIMUM field of the SOA record and the TTL of the SOA itself" — two numbers, not one. The NXDOMAIN case above reads only the RCODE. Extend it to also parse the SOA record in the authority section (after the two domain names MNAME and RNAME come five 32-bit fields: SERIAL, REFRESH, RETRY, EXPIRE, MINIMUM) and print both the SOA's own TTL and its MINIMUM field.

:::solution
The root's SOA for `.example`'s absence is a real record you can decode with the same field layout as any other RR, just with RDATA that is two names followed by five integers.

```csharp run
using System.Net;
using System.Net.Sockets;
using System.Text;

byte[] BuildQuery(string name, ushort qtype)
{
    var msg = new List<byte>();
    void W16(int v)
    {
        msg.Add((byte)(v >> 8));
        msg.Add((byte)v);
    }
    W16(Random.Shared.Next(ushort.MaxValue));
    W16(0x0000);
    W16(1); W16(0); W16(0); W16(0);
    foreach (string label in name.Split('.'))
    {
        byte[] b = Encoding.ASCII.GetBytes(label);
        msg.Add((byte)b.Length);
        msg.AddRange(b);
    }
    msg.Add(0);
    W16(qtype); W16(1);
    return msg.ToArray();
}

string ReadName(byte[] buf, ref int pos)
{
    var name = new StringBuilder();
    int p = pos;
    bool jumped = false;
    while (buf[p] != 0)
    {
        if ((buf[p] & 0xC0) == 0xC0)
        {
            int target = ((buf[p] & 0x3F) << 8) | buf[p + 1];
            if (!jumped) pos = p + 2;
            jumped = true;
            p = target;
            continue;
        }
        int len = buf[p];
        name.Append(Encoding.ASCII.GetString(buf, p + 1, len));
        name.Append('.');
        p += len + 1;
    }
    if (!jumped) pos = p + 1;
    return name.Length > 0
        ? name.ToString(0, name.Length - 1) : "";
}

uint Read32(byte[] buf, ref int pos)
{
    uint v = (uint)((buf[pos] << 24) | (buf[pos + 1] << 16)
        | (buf[pos + 2] << 8) | buf[pos + 3]);
    pos += 4;
    return v;
}

using var udp = new UdpClient();
byte[] q = BuildQuery("nothing-here.example", 1);
var ep = new IPEndPoint(IPAddress.Parse("198.41.0.4"), 53);
await udp.SendAsync(q, q.Length, ep);
UdpReceiveResult r = await udp.ReceiveAsync();
byte[] buf = r.Buffer;
int pos = 12;
ReadName(buf, ref pos);
pos += 4;
ReadName(buf, ref pos); // SOA owner name
pos += 2; pos += 2; // type, class
uint soaTtl = Read32(buf, ref pos);
pos += 2; // rdlength
ReadName(buf, ref pos); // MNAME
ReadName(buf, ref pos); // RNAME
Read32(buf, ref pos); // SERIAL
Read32(buf, ref pos); // REFRESH
Read32(buf, ref pos); // RETRY
Read32(buf, ref pos); // EXPIRE
uint minimum = Read32(buf, ref pos);
uint effective = Math.Min(soaTtl, minimum);
Console.WriteLine(
    $"SOA ttl={soaTtl} minimum={minimum} " +
    $"effective negative TTL={effective}");
```

```text output
SOA ttl=[...] minimum=[...] effective negative TTL=[...]
```

The run used for this page:

```text
SOA ttl=86400 minimum=86400
effective negative TTL=86400
```

A day, at the top of what RFC 2308 calls problematic, which is exactly why a resolver that just cached "no such name" for you can keep saying so for longer than you'd expect after the record finally shows up.
:::
::::
