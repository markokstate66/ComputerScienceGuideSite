# Wanted cross-links: /networking/ip-addresses-and-subnets/

No links to unpublished articles are requested from this side; every article it builds on (`how-the-internet-works`, `tcp-vs-udp`, `dns`) is already published, and the direct link to `how-the-internet-works`'s NAT paragraph is already live in the body.

The two forward-references already waiting in `docs/crosslinks/networking/how-the-internet-works.md` ("IP addresses" and "network address port translation", both pointing here) can now be wired, since this article's route exists. — Status: wired one of the two ("IP addresses", first natural occurrence), dropped the other ("network address port translation") as a duplicate link to the same target in the same article, per the no-duplicate-link-per-article rule; see `docs/crosslinks/networking/how-the-internet-works.md` for detail.

## Boundary with sibling articles

- `how-the-internet-works.md` owns the mechanics of NAT rewriting a packet mid-path (its "Underneath" section) and the four-layer model. This article does not re-derive either; it links to that section for the rewriting mechanism and only adds why private addresses need NAT at all (RFC 1918's motivation) and what NAPT specifically multiplexes (RFC 3022 section 2.2), which the other article does not cover.
- `tcp-vs-udp.md` owns ports, sockets and the transport layer. This article never assigns or reads a port.
- `dns.md` owns name resolution. This article starts from an address already in hand and never resolves a name.

## Glossary terms wanted (first use in this article; definitions for the integrator to write)

- `cidr` — first use: the opening paragraph ("CIDR notation writes a network as an address followed by `/`..." in the "prefix length" section). Suggested definition: a way of writing an IP network as an address plus a slash and a prefix length (e.g. `10.0.0.0/16`), where the prefix length says how many leading bits of the address are fixed for every host on that network; replaced the older fixed-size class A/B/C system. — Status: n/a (glossary term request for the integrator to write definitions elsewhere, not an article link)
- `private-ip-address` — first use: "Address space nobody has to hand out" section. Suggested definition: an address from one of the three blocks RFC 1918 reserves (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) for use inside a single organization's network; these are never assigned to a single global owner and are not routed on the public internet, which is why a device using one needs NAT to reach it. — Status: n/a (glossary term request for the integrator to write definitions elsewhere, not an article link)
