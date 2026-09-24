---
title: "IP Addresses, Subnetting, and CIDR by the Bits"
description: "Compute network, broadcast and host ranges for a CIDR block in C#, check them against System.Net.IPNetwork, then split one block into subnets sized to fit."
pillar: networking
order: 6
author: markus
published: 2026-09-24
updated: 2026-09-24
level: intermediate
tags: [ip-addresses, cidr, subnetting, ipv6, nat]
prerequisites: ["networking/how-the-internet-works", "networking/tcp-vs-udp", "networking/dns"]
sources:
  - title: "RFC 791: Internet Protocol"
    url: "https://www.rfc-editor.org/rfc/rfc791.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 1918: Address Allocation for Private Internets"
    url: "https://www.rfc-editor.org/rfc/rfc1918.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 4632: Classless Inter-domain Routing (CIDR): The Internet Address Assignment and Aggregation Plan"
    url: "https://www.rfc-editor.org/rfc/rfc4632.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 5737: IPv4 Address Blocks Reserved for Documentation"
    url: "https://www.rfc-editor.org/rfc/rfc5737.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 3849: IPv6 Address Prefix Reserved for Documentation"
    url: "https://www.rfc-editor.org/rfc/rfc3849.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 4291: IP Version 6 Addressing Architecture"
    url: "https://www.rfc-editor.org/rfc/rfc4291.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 3021: Using 31-Bit Prefixes on IPv4 Point-to-Point Links"
    url: "https://www.rfc-editor.org/rfc/rfc3021.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "RFC 3022: Traditional IP Network Address Translator (Traditional NAT)"
    url: "https://www.rfc-editor.org/rfc/rfc3022.html"
    publisher: "IETF"
    accessed: 2026-09-24
  - title: "IPNetwork Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.ipnetwork"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Bitwise and shift operators (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
draft: true
---

A cloud console hands you `203.0.113.0/24` (a documentation range stood in here for the block your provider would actually own) and asks for three subnets: 100 addresses for a web tier, 50 for a database tier, 20 for a management tier, none of them overlapping. This article builds the calculator that answers that, checks its arithmetic against .NET's own `System.Net.IPNetwork` type, and ends with the answer:

| Tier | CIDR | Usable addresses |
|---|---|---|
| web | `203.0.113.0/25` | `.1`-`.126` |
| database | `203.0.113.128/26` | `.129`-`.190` |
| management | `203.0.113.192/27` | `.193`-`.222` |

Getting there means treating an address as what it actually is underneath the dotted decimal: a fixed number of bits, split at a point the prefix length names.

## Thirty-two bits, written as four decimal numbers

An IPv4 address is a 32-bit number; RFC 791 states it plainly: "addresses are fixed length of four octets (32 bits)" ([RFC 791, section 3.2](https://www.rfc-editor.org/rfc/rfc791.html#section-3.2)). The dotted-decimal form, four numbers from 0 to 255 separated by dots, is purely for humans: each number is one octet (8 bits), and nothing about the protocol cares how it is printed. `IPAddress.GetAddressBytes` hands back exactly those four bytes, in the order they appear on the wire:

```csharp run id=bits
using System.Net;

IPAddress addr = IPAddress.Parse(
    "203.0.113.80");
byte[] octets = addr.GetAddressBytes();

foreach (byte b in octets)
    Console.Write(
        Convert.ToString(b, 2).PadLeft(8, '0') + " ");
Console.WriteLine();
Console.WriteLine(string.Join(".", octets));
```

```text output
11001011 00000000 01110001 01010000
203.0.113.80
```

Every operation this article performs, network address, broadcast address, "does this address belong to that block", is bit arithmetic on those 32 bits. The dotted form only has to be parsed in and printed back out at the edges.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="bitlayout-title bitlayout-desc">
<title id="bitlayout-title">The 32 bits of 203.0.113.80 split by a /26 prefix</title>
<desc id="bitlayout-desc">Four rows of eight bits, one row per octet. The first three octets and the first two bits of the fourth are highlighted as the network part fixed by the prefix length; the remaining six bits of the fourth octet are the host part that identifies one device on that network.</desc>
<text x="20" y="18" class="d-small d-bold">Octet 1 = 203</text>
<rect x="20" y="24" width="40" height="26" class="d-box-accent"/>
<text x="40" y="42" text-anchor="middle" class="d-mono">1</text>
<rect x="62" y="24" width="40" height="26" class="d-box-accent"/>
<text x="82" y="42" text-anchor="middle" class="d-mono">1</text>
<rect x="104" y="24" width="40" height="26" class="d-box-accent"/>
<text x="124" y="42" text-anchor="middle" class="d-mono">0</text>
<rect x="146" y="24" width="40" height="26" class="d-box-accent"/>
<text x="166" y="42" text-anchor="middle" class="d-mono">0</text>
<rect x="188" y="24" width="40" height="26" class="d-box-accent"/>
<text x="208" y="42" text-anchor="middle" class="d-mono">1</text>
<rect x="230" y="24" width="40" height="26" class="d-box-accent"/>
<text x="250" y="42" text-anchor="middle" class="d-mono">0</text>
<rect x="272" y="24" width="40" height="26" class="d-box-accent"/>
<text x="292" y="42" text-anchor="middle" class="d-mono">1</text>
<rect x="314" y="24" width="40" height="26" class="d-box-accent"/>
<text x="334" y="42" text-anchor="middle" class="d-mono">1</text>
<text x="20" y="78" class="d-small d-bold">Octet 2 = 0</text>
<rect x="20" y="84" width="40" height="26" class="d-box-accent"/>
<text x="40" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="62" y="84" width="40" height="26" class="d-box-accent"/>
<text x="82" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="104" y="84" width="40" height="26" class="d-box-accent"/>
<text x="124" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="146" y="84" width="40" height="26" class="d-box-accent"/>
<text x="166" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="188" y="84" width="40" height="26" class="d-box-accent"/>
<text x="208" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="230" y="84" width="40" height="26" class="d-box-accent"/>
<text x="250" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="272" y="84" width="40" height="26" class="d-box-accent"/>
<text x="292" y="102" text-anchor="middle" class="d-mono">0</text>
<rect x="314" y="84" width="40" height="26" class="d-box-accent"/>
<text x="334" y="102" text-anchor="middle" class="d-mono">0</text>
<text x="20" y="138" class="d-small d-bold">Octet 3 = 113</text>
<rect x="20" y="144" width="40" height="26" class="d-box-accent"/>
<text x="40" y="162" text-anchor="middle" class="d-mono">0</text>
<rect x="62" y="144" width="40" height="26" class="d-box-accent"/>
<text x="82" y="162" text-anchor="middle" class="d-mono">1</text>
<rect x="104" y="144" width="40" height="26" class="d-box-accent"/>
<text x="124" y="162" text-anchor="middle" class="d-mono">1</text>
<rect x="146" y="144" width="40" height="26" class="d-box-accent"/>
<text x="166" y="162" text-anchor="middle" class="d-mono">1</text>
<rect x="188" y="144" width="40" height="26" class="d-box-accent"/>
<text x="208" y="162" text-anchor="middle" class="d-mono">0</text>
<rect x="230" y="144" width="40" height="26" class="d-box-accent"/>
<text x="250" y="162" text-anchor="middle" class="d-mono">0</text>
<rect x="272" y="144" width="40" height="26" class="d-box-accent"/>
<text x="292" y="162" text-anchor="middle" class="d-mono">0</text>
<rect x="314" y="144" width="40" height="26" class="d-box-accent"/>
<text x="334" y="162" text-anchor="middle" class="d-mono">1</text>
<text x="20" y="198" class="d-small d-bold">Octet 4 = 80</text>
<rect x="20" y="204" width="40" height="26" class="d-box-accent"/>
<text x="40" y="222" text-anchor="middle" class="d-mono">0</text>
<rect x="62" y="204" width="40" height="26" class="d-box-accent"/>
<text x="82" y="222" text-anchor="middle" class="d-mono">1</text>
<rect x="104" y="204" width="40" height="26" class="d-box-good"/>
<text x="124" y="222" text-anchor="middle" class="d-mono">0</text>
<rect x="146" y="204" width="40" height="26" class="d-box-good"/>
<text x="166" y="222" text-anchor="middle" class="d-mono">1</text>
<rect x="188" y="204" width="40" height="26" class="d-box-good"/>
<text x="208" y="222" text-anchor="middle" class="d-mono">0</text>
<rect x="230" y="204" width="40" height="26" class="d-box-good"/>
<text x="250" y="222" text-anchor="middle" class="d-mono">0</text>
<rect x="272" y="204" width="40" height="26" class="d-box-good"/>
<text x="292" y="222" text-anchor="middle" class="d-mono">0</text>
<rect x="314" y="204" width="40" height="26" class="d-box-good"/>
<text x="334" y="222" text-anchor="middle" class="d-mono">0</text>
<text x="20" y="250" class="d-small d-muted">Accent = network bits, fixed by /26.</text>
<text x="20" y="266" class="d-small d-muted">Green = host bits, free per device.</text>
<text x="20" y="284" class="d-small d-bold">26 network bits, 6 host bits.</text>
</svg>
<figcaption>Figure 1. The same address, 203.0.113.80, split two different ways depending only on the prefix length. A /26 fixes the first 26 bits; the last 6 are free to vary across the 64 addresses of that subnet.</figcaption>
</figure>

## The prefix length says how many bits are fixed

CIDR notation writes a network as an address followed by `/` and a decimal prefix length: "a prefix is shown as ... the '/' (slash) character, followed by a decimal value between 0 and 32" ([RFC 4632, section 3.1](https://www.rfc-editor.org/rfc/rfc4632.html#section-3.1)). The prefix length is not a fourth kind of number to memorize; it converts directly into a subnet mask, a 32-bit value with that many leading 1 bits and the rest 0:

```csharp run id=mask-table
static uint MaskFor(int prefix) =>
    prefix == 0 ? 0u :
        0xFFFFFFFFu << (32 - prefix);

static string ToDotted(uint value) =>
    string.Join(".",
        BitConverter.GetBytes(value).Reverse());

foreach (int prefix in new[] { 8, 16, 24, 25, 26, 27 })
    Console.WriteLine(
        $"/{prefix,-3} {ToDotted(MaskFor(prefix))}");
```

```text output
/8   255.0.0.0
/16  255.255.0.0
/24  255.255.255.0
/25  255.255.255.128
/26  255.255.255.192
/27  255.255.255.224
```

`0xFFFFFFFFu << (32 - prefix)` is the whole idea: start with 32 one-bits, then push `32 - prefix` of them off the left-hand end, back-filling the vacated positions with zero, which is exactly what C#'s left-shift operator does ("the left-shift operation ... sets the low-order empty bit positions to zero", [Bitwise and shift operators](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators#left-shift-operator-)). A `/24` mask is `255.255.255.0` because the shift pushes out 8 bits; a `/26` mask is `255.255.255.192` because it pushes out only 6, leaving two more 1 bits in the last octet than a `/24` has.

That mask is what turns any address inside a network into the network's own identifying address: AND the address with the mask, and every host bit is forced to zero.

## Network address, broadcast address, and what's left over

`network = address & mask` zeroes out the host bits. Its opposite, `broadcast = network | ~mask`, forces every host bit to one instead: `~mask` is all zeros where the mask had 1s and all ones where it had 0s, so ORing it onto the network address sets exactly the host bits and leaves the network bits untouched. Everything strictly between those two is a usable host address, which is why the classic "usable hosts" count is `2^(32-prefix) - 2`, not `2^(32-prefix)`: two of the addresses in every block are spoken for before a single host is assigned.

```csharp run id=subnet-math
using System.Net;

static uint ToUInt(IPAddress a) =>
    BitConverter.ToUInt32(
        a.GetAddressBytes().Reverse().ToArray());
static IPAddress ToAddr(uint v) =>
    new(BitConverter.GetBytes(v).Reverse().ToArray());
static uint Mask(int prefix) =>
    prefix == 0 ? 0u :
        0xFFFFFFFFu << (32 - prefix);

static void Describe(string cidr)
{
    string[] parts = cidr.Split('/');
    uint addr = ToUInt(
        IPAddress.Parse(parts[0]));
    int prefix = int.Parse(parts[1]);
    uint mask = Mask(prefix);
    uint network = addr & mask;
    uint broadcast = network | ~mask;
    long usable = prefix >= 31 ? 0 :
        (1L << (32 - prefix)) - 2;
    Console.WriteLine(cidr);
    Console.WriteLine($"  network   {ToAddr(network)}");
    Console.WriteLine($"  broadcast {ToAddr(broadcast)}");
    Console.WriteLine($"  usable    {usable}");
}

Describe("203.0.113.80/26");
Describe("203.0.113.80/30");
Describe("203.0.113.80/31");
```

```text output
203.0.113.80/26
  network   203.0.113.64
  broadcast 203.0.113.127
  usable    62
203.0.113.80/30
  network   203.0.113.80
  broadcast 203.0.113.83
  usable    2
203.0.113.80/31
  network   203.0.113.80
  broadcast 203.0.113.81
  usable    0
```

The `/26` and `/30` lines are the ordinary case: fewer host bits means a smaller block, but the shape (one network address, one broadcast address, everything else usable) does not change. The `/31` line is where the ordinary shape breaks, and `Describe` says so honestly: the formula gives zero usable addresses, because with only one host bit there is no room for a network address, a broadcast address and even one host to be three different values. RFC 3021 carves out that exact case for point-to-point links and overrides the general rule: "in a point-to-point link with a 31-bit subnet mask, the two addresses ... MUST be interpreted as host addresses" ([RFC 3021, section 2.1](https://www.rfc-editor.org/rfc/rfc3021.html#section-2.1)), so both `203.0.113.80` and `203.0.113.81` are legitimate hosts there, not a wasted network/broadcast pair. A `/32` is the other edge case, one address with no host bits at all; it shows up as a single-address route (a loopback, for instance) rather than as a network anyone subnets.

::::exercise[Work out a block by hand, then check it]
Before running anything, work out the network address, broadcast address and usable host count for `198.51.100.200/28`.

:::solution
A `/28` mask is `255.255.255.240` (four host bits, matching the `/mask-table` output above extended one step further). `200` in binary is `11001000`; ANDed with `11110000` that gives `11000000`, decimal 192, so the network is `198.51.100.192`. The broadcast sets those same four host bits to 1: `198.51.100.207`. Usable hosts: `2^4 - 2 = 14`.

```csharp run
using System.Net;

static uint ToUInt(IPAddress a) =>
    BitConverter.ToUInt32(
        a.GetAddressBytes().Reverse().ToArray());
static IPAddress ToAddr(uint v) =>
    new(BitConverter.GetBytes(v).Reverse().ToArray());
static uint Mask(int prefix) =>
    prefix == 0 ? 0u :
        0xFFFFFFFFu << (32 - prefix);

uint addr = ToUInt(
    IPAddress.Parse("198.51.100.200"));
int prefix = 28;
uint mask = Mask(prefix);
uint network = addr & mask;
uint broadcast = network | ~mask;
long usable = (1L << (32 - prefix)) - 2;

Console.WriteLine($"network   {ToAddr(network)}");
Console.WriteLine($"broadcast {ToAddr(broadcast)}");
Console.WriteLine($"usable    {usable}");
```

```text output
network   198.51.100.192
broadcast 198.51.100.207
usable    14
```
:::
::::

## What System.Net.IPNetwork does when the bits don't line up

.NET 8 added `IPNetwork`, a struct pairing an `IPAddress` with a prefix length, with `Parse`, `TryParse` and a `Contains` method for exactly the membership test the last section computed by hand. Its documentation is specific about what it expects to receive: "this type disallows arbitrary IP-address/prefix-length CIDR pairs. `BaseAddress` must be defined so that all bits after the network prefix are set to zero. ... The constructor and the parsing methods will throw in case there are non-zero bits after the prefix" ([IPNetwork Struct, Remarks](https://learn.microsoft.com/en-us/dotnet/api/system.net.ipnetwork)). That is, the documented contract is that `IPNetwork.Parse("203.0.113.81/26")` should throw, because `.81` has non-zero bits past bit 26.

Tested on .NET 10.0.401 on Windows 11, x64, it does not throw:

```csharp run id=ipnetwork-quirk
using System.Net;

string cidr = "203.0.113.81/26";
bool parsed = IPNetwork.TryParse(
    cidr, out IPNetwork tryResult);
IPNetwork parseResult =
    IPNetwork.Parse(cidr);
Console.WriteLine(
    $"input        {cidr}");
Console.WriteLine(
    $"TryParse ok  {parsed}");
Console.WriteLine(
    $"TryParse ->  {tryResult}");
Console.WriteLine(
    $"Parse    ->  {parseResult}");
```

```text output
input        203.0.113.81/26
TryParse ok  True
TryParse ->  203.0.113.64/26
Parse    ->  203.0.113.64/26
```

Both `TryParse` and the plain `Parse` accepted the misaligned pair and quietly normalized it to `203.0.113.64/26`, the same network your own `Describe` function computed for that address. That is a friendlier outcome than an exception for a calculator that only ever reads addresses, but it is not the behavior the documentation on this same page describes, and it is exactly the kind of gap the editorial brief warns against treating as guaranteed: the documented contract says "will throw," a real run on this runtime does not, and a program that depended on the throw to reject bad input would not learn anything was wrong. Do not build validation on undocumented, and evidently unstable, exception behavior; check `network.BaseAddress == network` yourself if that distinction matters to your program, the way the next section's classifier checks membership rather than trusting normalization silently.

## Classless addressing replaced three fixed sizes

CIDR is called "classless" because it replaced a scheme with named, fixed-size classes. RFC 791 itself defines three of them by their leading bits: "in class a, the high order bit is zero, the next 7 bits are the network, and the last 24 bits are the local address," with class B taking 14 network bits and class C taking 21 ([RFC 791, section 3.2](https://www.rfc-editor.org/rfc/rfc791.html#section-3.2)). That gave exactly three possible usable-host counts per network: about 16,777,214, 65,534, or 254. RFC 4632 spells out why that stopped working, and the gap between the last two sizes is the whole problem: "Class C, with a maximum of 254 host addresses, is too small, whereas Class B, which allows up to 65534 host addresses, is too large for most organizations but was the best fit available for use with subnetting" ([RFC 4632, section 2](https://www.rfc-editor.org/rfc/rfc4632.html#section-2)). An organization with, say, 300 hosts had no class sized for it: it either wasted a Class B built for 65,534 or split itself across multiple Class C blocks, and the resulting flood of separate Class B and Class C allocations threatened both the pool of remaining addresses and the size of the global routing table. A prefix length picks any network size, not just three, and two adjacent blocks of the same size can be summarized as one shorter prefix in a router's table (`203.0.112.0/24` and `203.0.113.0/24` aggregate to `203.0.112.0/23`), which is the "aggregation" half of what RFC 4632's title promises. Nothing about the bit arithmetic in this article needed classes to exist; they only explain why "network" used to mean one of three fixed shapes instead of a size you choose.

::::exercise[Find the bug in one line]
This function is meant to compute a subnet mask for any prefix length from 0 to 32, the same idea as `MaskFor` earlier but written as a single expression, without the `prefix == 0` special case:

```csharp run id=shift-bug
static uint MaskFor(int prefix) =>
    0xFFFFFFFFu << (32 - prefix);

static string ToDotted(uint value) =>
    string.Join(".",
        BitConverter.GetBytes(value).Reverse());

foreach (int prefix in new[] { 0, 8, 24, 32 })
    Console.WriteLine(
        $"/{prefix,-3} {ToDotted(MaskFor(prefix))}");
```

Before running it, predict the four lines it prints, then run it. One of them is wrong. Which, and why?

:::solution
```text output
/0   255.255.255.255
/8   255.0.0.0
/24  255.255.255.0
/32  255.255.255.255
```

`/0` is wrong: a `/0` mask should be `0.0.0.0` (no bits fixed at all; it is the mask a default route uses), but this prints all 255s instead. The cause is the shift count, not the arithmetic: for `int` and `uint`, "the low-order five bits of the right-hand operand define the shift count. That is, the shift count is computed from `count & 0x1F`" ([Bitwise and shift operators, shift count section](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators#shift-count-of-the-shift-operators)). For `/0`, `32 - prefix` is 32, and `32 & 0x1F` is 0, so `0xFFFFFFFFu << 32` actually runs as `0xFFFFFFFFu << 0`, leaving every bit set. The `/32` line happens to come out right, but only by coincidence: `32 - 32` is 0 already, so there is no wraparound to hide. `MaskFor`'s original `prefix == 0 ? 0u : ...` earlier in this article exists specifically to dodge this one input; a version without it is correct for every prefix except the one that means "no bits at all."
:::
::::

## Solving the worked problem: three subnets, one block

The web, database and management tiers from the opening need 100, 50 and 20 hosts. Each of those numbers has to round up to a power-of-two-minus-two: the smallest block with at least 100 usable addresses is a `/25` (126 usable), the smallest with at least 50 is a `/26` (62 usable), and the smallest with at least 20 is a `/27` (30 usable). Handing out the largest block first and packing the rest immediately after it (variable-length subnet masking, VLSM) avoids leaving gaps:

```csharp run id=vlsm
using System.Net;

static uint ToUInt(IPAddress a) =>
    BitConverter.ToUInt32(
        a.GetAddressBytes().Reverse().ToArray());
static byte LastOctet(uint v) => (byte)v;

static int PrefixFor(int hostsNeeded)
{
    int prefix = 32;
    while ((1L << (32 - prefix)) - 2 < hostsNeeded)
        prefix--;
    return prefix;
}

(string name, int hosts)[] tiers =
[
    ("web", 100),
    ("db", 50),
    ("mgmt", 20),
];

uint cursor = ToUInt(
    IPAddress.Parse("203.0.113.0"));
Console.WriteLine("tier  need  cidr     range");
foreach (var (name, hosts) in
    tiers.OrderByDescending(t => t.hosts))
{
    int prefix = PrefixFor(hosts);
    uint size = 1u << (32 - prefix);
    uint network = cursor;
    uint broadcast = network + size - 1;
    string cidr = $".{LastOctet(network)}/{prefix}";
    string range =
        $".{LastOctet(network + 1)}-" +
        $".{LastOctet(broadcast - 1)}";
    Console.WriteLine(
        $"{name,-4}  {hosts,4}  {cidr,-8} {range}");
    cursor = network + size;
}
uint blockEnd = ToUInt(
    IPAddress.Parse("203.0.113.0"))
    + 256;
Console.WriteLine(
    $"free     -  .{LastOctet(cursor)}, " +
    $"{blockEnd - cursor} addresses");
```

```text output
tier  need  cidr     range
web    100  .0/25    .1-.126
db      50  .128/26  .129-.190
mgmt    20  .192/27  .193-.222
free     -  .224, 32 addresses
```

That is the table from the opening, derived rather than asserted: `PrefixFor` walks the prefix down from `/32` until the usable-host formula from the previous section clears the requirement, and the running `cursor` places each block immediately after the one before it, so `web`'s 128 addresses (`.0` to `.127`) leave `db` starting at `.128`, whose 64 addresses (`.128` to `.191`) leave `mgmt` starting at `.192`. The 32 addresses from `.224` to `.255` are left over, free for a fourth tier or future growth, out of the 256 the original `/24` held.

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="vlsm-title vlsm-desc">
<title id="vlsm-title">203.0.113.0/24 split into three sized subnets</title>
<desc id="vlsm-desc">Three horizontal bars of decreasing length, one per tier, each proportional to its usable-address count, followed by a shorter bar of the same length as the management tier representing the addresses left unassigned.</desc>
<text x="20" y="18" class="d-small d-bold">web needs 100 -> /25</text>
<rect x="20" y="24" width="320" height="22" class="d-box-accent"/>
<text x="20" y="62" class="d-small d-muted">.1-.126 (126 usable, needs 100)</text>
<text x="20" y="82" class="d-small d-bold">db needs 50 -> /26</text>
<rect x="20" y="88" width="158" height="22" class="d-box-accent"/>
<text x="20" y="126" class="d-small d-muted">.129-.190 (62 usable, needs 50)</text>
<text x="20" y="146" class="d-small d-bold">mgmt needs 20 -> /27</text>
<rect x="20" y="152" width="76" height="22" class="d-box-accent"/>
<text x="20" y="190" class="d-small d-muted">.193-.222 (30 usable, needs 20)</text>
<text x="20" y="210" class="d-small d-bold">unassigned space</text>
<rect x="20" y="216" width="76" height="22" class="d-box-2"/>
<text x="20" y="254" class="d-small d-muted">.224-.255 (32 addresses spare)</text>
</svg>
<figcaption>Figure 2. The bar for each tier is drawn to a length proportional to its usable-address count, so the web tier's 126 addresses take up exactly twice the width of the database tier's 62. The two smaller, equal-width bars are the management tier and what is still unassigned.</figcaption>
</figure>

## Address space nobody has to hand out

Every address used so far has come from a block reserved for documentation, so that this article never claims a real network's addresses as its own; RFC 5737 sets aside `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24` for exactly that purpose, because designated ranges "reduce the likelihood of conflicts and confusion arising from the use of addresses assigned for some other purpose" ([RFC 5737](https://www.rfc-editor.org/rfc/rfc5737.html)). A different, much larger set of blocks exists for a different reason: private networks that never need a globally unique address at all. RFC 1918 reserves `10.0.0.0/8`, `172.16.0.0/12` and `192.168.0.0/16` for that, citing both "a concern within the community that globally unique address space will be exhausted" and, separately, that "the amount of routing overhead will grow beyond the capabilities of Internet Service Providers" if every internal host needed a public, globally routed address ([RFC 1918, section 2](https://www.rfc-editor.org/rfc/rfc1918.html#section-2)).

```csharp run id=is-private
using System.Net;

IPNetwork[] privateRanges =
[
    IPNetwork.Parse("10.0.0.0/8"),
    IPNetwork.Parse("172.16.0.0/12"),
    IPNetwork.Parse("192.168.0.0/16"),
];

bool IsPrivate(string address) =>
    privateRanges.Any(r =>
        r.Contains(IPAddress.Parse(address)));

foreach (string ip in new[]
{
    "10.4.5.6",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "203.0.113.5",
})
    Console.WriteLine(
        $"{ip,-15} {IsPrivate(ip)}");
```

```text output
10.4.5.6        True
172.16.0.1      True
172.31.255.254  True
192.168.1.1     True
203.0.113.5     False
```

The `172.16.0.0/12` line is the one worth checking by hand, because "172-dot-something" is easy to over-generalize as private. A `/12` mask fixes only the first 12 bits, which covers the second octet only partway:

```csharp run id=rfc1918-bounds
using System.Net;

var block = IPNetwork.Parse(
    "172.16.0.0/12");
uint mask = 0xFFFFFFFFu <<
    (32 - block.PrefixLength);
uint baseValue = BitConverter.ToUInt32(
    block.BaseAddress.GetAddressBytes()
        .Reverse().ToArray());
uint broadcast = baseValue | ~mask;
IPAddress last = new(
    BitConverter.GetBytes(broadcast)
        .Reverse().ToArray());

Console.WriteLine($"first  {block.BaseAddress}");
Console.WriteLine($"last   {last}");
```

```text output
first  172.16.0.0
last   172.31.255.255
```

The block runs from `172.16.0.0` to `172.31.255.255` and stops there; an address such as `172.32.0.0` has an entirely different, second-octet value one higher, and is not covered by this reservation at all. `/12` buys sixteen consecutive values of the second octet (`16` through `31`), not the whole range from `16` up.

Because private addresses are not globally routable, a private network still needs something at its edge to reach the public internet, and that something is network address translation. RFC 3022 defines Network Address Port Translation as "a method by which many network addresses and their TCP/UDP ... ports are translated into a single network address and its ... ports" ([RFC 3022, Abstract](https://www.rfc-editor.org/rfc/rfc3022.html)), distinguishing it from plain (Basic) NAT, where "translation ... is limited to IP addresses alone" and each private host still needs one public address of its own ([RFC 3022, section 2](https://www.rfc-editor.org/rfc/rfc3022.html#section-2)). NAPT is what makes a whole `/24` of private hosts share one public address: it maps each private `(address, port)` pair to a different port on the single shared public address ([RFC 3022, section 2.2](https://www.rfc-editor.org/rfc/rfc3022.html#section-2.2)), which is also why the port a connection actually leaves on can differ from the port your program bound, a rewrite [How the Internet Works](/networking/how-the-internet-works/#underneath-every-message-above-was-cut-into-packets) already shows happening mid-path. The two ideas fit together: RFC 1918 says which addresses never need to be globally unique, and NAT/NAPT is the mechanism that lets a device holding one of them still reach a host that does need one.

::::exercise[Extend the classifier]
`IsPrivate` above answers one yes/no question. Extend it into a `Classify` function that returns `"private"` for an RFC 1918 address, `"docs"` for an RFC 5737 or RFC 3849 address, and `"other"` for anything else, then run it on a private address, a documentation address, and an IPv6 documentation address.

:::solution
Adding the three documentation ranges to the same kind of lookup, and falling through to `"other"` when nothing matches, handles all three families with one loop. Tested on the same .NET 10.0.401/Windows 11/x64 combination as the earlier `Parse` quirk, `IPNetwork.Contains` returns `false` for an address from a different address family rather than throwing, which is what lets the same list check an IPv6 address without a special case; Microsoft's reference page documents only `ArgumentNullException` for `Contains(IPAddress)` and says nothing about mixed-family input, so this is this run's observed behavior on this runtime, not a documented guarantee, and a program should not depend on it without its own test.

```csharp run
using System.Net;

(string label, IPNetwork range)[] known =
[
    ("private", IPNetwork.Parse("10.0.0.0/8")),
    ("private", IPNetwork.Parse("172.16.0.0/12")),
    ("private", IPNetwork.Parse("192.168.0.0/16")),
    ("docs", IPNetwork.Parse("192.0.2.0/24")),
    ("docs", IPNetwork.Parse("198.51.100.0/24")),
    ("docs", IPNetwork.Parse("203.0.113.0/24")),
];

string Classify(string address)
{
    IPAddress ip = IPAddress.Parse(address);
    foreach (var (label, range) in known)
        if (range.Contains(ip))
            return label;
    return "other";
}

foreach (string ip in new[]
{
    "192.168.1.1",
    "203.0.113.9",
    "2001:db8::9",
})
    Console.WriteLine($"{ip,-13} {Classify(ip)}");
```

```text output
192.168.1.1   private
203.0.113.9   docs
2001:db8::9   other
```

`2001:db8::9` comes back `"other"` correctly: it is an RFC 3849 documentation address, but this particular classifier was only given IPv4 documentation ranges to check against, and an honest classifier says "not one of my known ranges" rather than guessing.
:::
::::

## IPv6: the same idea at 128 bits

IPv6 keeps the network-bits-then-host-bits idea and quadruples the address size: "IPv6 addresses are 128-bit identifiers" ([RFC 4291, section 2](https://www.rfc-editor.org/rfc/rfc4291.html#section-2)), written as eight groups of up to four hex digits separated by colons, `x:x:x:x:x:x:x:x` ([RFC 4291, section 2.2](https://www.rfc-editor.org/rfc/rfc4291.html#section-2.2)). A double colon compresses one run of zero groups, and the spec is strict about how often: "the '::' can only appear once in an address" ([RFC 4291, section 2.2](https://www.rfc-editor.org/rfc/rfc4291.html#section-2.2)), because a second occurrence would make the number of zero groups it stands for ambiguous.

```csharp run id=v6
using System.Net;

IPAddress full = IPAddress.Parse(
    "2001:0db8:0000:0000:0000:" +
    "0000:0000:0001");
Console.WriteLine($"parsed   {full}");

try
{
    IPAddress.Parse("2001:db8::1::2");
}
catch (FormatException e)
{
    Console.WriteLine(
        $"rejected: {e.GetType().Name}");
}

var subnet = IPNetwork.Parse(
    "2001:db8:1234:5678::/64");
Console.WriteLine(
    $"network  {subnet.BaseAddress}/" +
    $"{subnet.PrefixLength}");

IPAddress inSubnet = IPAddress.Parse(
    "2001:db8:1234:5678::42");
IPAddress outOfSubnet = IPAddress.Parse(
    "2001:db8:1234:5679::1");
Console.WriteLine(
    "in range " +
    subnet.Contains(inSubnet));
Console.WriteLine(
    "in range " +
    subnet.Contains(outOfSubnet));
```

```text output
parsed   2001:db8::1
rejected: FormatException
network  2001:db8:1234:5678::/64
in range True
in range False
```

`IPAddress.ToString` compresses the longest run of zero groups on its own, which is why the fully expanded address printed back as `2001:db8::1`; a second `::` in the input is rejected outright, exactly as the "only once" rule requires. `IPNetwork.Parse` and `Contains` work on IPv6 the same way they do on IPv4, just with a prefix length that runs to 128 instead of 32: `2001:db8:1234:5678::/64` reaches every address that shares its first 64 bits and none that differ in them, which is why the second `Contains` call is `False` despite both addresses sharing the article's `2001:db8::/32` documentation prefix ([RFC 3849](https://www.rfc-editor.org/rfc/rfc3849.html)).

`/64` is not an arbitrary round number here. For unicast addresses that are not built from the reserved `000` prefix pattern, RFC 4291 requires the interface identifier, the part of the address that names one interface rather than a network, to be exactly 64 bits: "Interface IDs are required to be 64 bits long" ([RFC 4291, section 2.5.1](https://www.rfc-editor.org/rfc/rfc4291.html#section-2.5.1)). That flips the usual subnetting trade-off around: IPv4 subnetting is a fight over a scarce 32-bit budget, choosing a prefix just long enough to avoid waste, while an ordinary IPv6 subnet is expected to hand out a fixed `/64`, 2^64 addresses, regardless of how many hosts will ever actually attach to it, because the address size makes exhaustion the wrong thing to optimize for.

::::exercise[Does the address belong to the block?]
For each pair, decide whether the address falls inside the given CIDR block, using only what a prefix length fixes:

- A: is `203.0.113.70` inside `203.0.113.0/26`?
- B: is `198.51.100.100` inside `198.51.100.128/25`?
- C: is `10.1.3.200` inside `10.1.2.0/23`?
- D: is `2001:db8:abcd:1::5` inside `2001:db8:abcd::/48`?

:::solution
A: no. `/26` on a network ending in `.0` covers only `.0` to `.63`; `.70` is in the next `/26` block over.

B: no. `/25` splits the last octet at 128; `.128/25` covers `.128` to `.255`, and `100` is below that split.

C: yes. `/23` fixes only 23 bits, borrowing one bit from the third octet, so `10.1.2.0/23` covers both `10.1.2.0/24` and `10.1.3.0/24` as one block; `10.1.3.200` is in the second half of it.

D: yes. `/48` fixes the first three of the eight hex groups; the fourth group (`1` vs. the network's implicit `0`) is inside the part `/48` leaves free.

```csharp run
using System.Net;

(string label, string cidr, string address)[]
    cases =
[
    ("A", "203.0.113.0/26", "203.0.113.70"),
    ("B", "198.51.100.128/25",
        "198.51.100.100"),
    ("C", "10.1.2.0/23", "10.1.3.200"),
    ("D", "2001:db8:abcd::/48",
        "2001:db8:abcd:1::5"),
];

foreach (var (label, cidr, address) in cases)
{
    IPNetwork net = IPNetwork.Parse(cidr);
    bool inside = net.Contains(
        IPAddress.Parse(address));
    Console.WriteLine($"{label}  {inside}");
}
```

```text output
A  False
B  False
C  True
D  True
```
:::
::::
