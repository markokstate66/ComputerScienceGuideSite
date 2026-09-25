# Wanted cross-links: /networking/dns/

One line each: anchor text | target route | where in the article.

- "messages carried by UDP are restricted to 512 bytes" / TCP retry on truncation | /networking/tcp-vs-udp/ | paragraph after the walk program's output, starting "Every query above went out as one UDP datagram" — Status: wired (linked the quoted RFC phrase to /networking/tcp-vs-udp/ in that paragraph)

## Boundary with /networking/how-the-internet-works/

That article already exists and is linked directly in this article's second paragraph (its target exists, so the link is live, not a request). The boundary: `how-the-internet-works.md` uses one DNS lookup as band 1 of a four-band walkthrough — a stub resolver asking a recursive resolver, timed, with the "first vs repeat lookup" `localhost`-warm-up measurement and the OS/browser IPv6-filtering caveat. It does not touch the root/TLD/authoritative hierarchy, does not distinguish recursive from iterative resolution beyond naming both, does not cover any record type but A, and does not cover TTL mechanics, negative caching or RCODEs beyond a one-line NXDOMAIN mention in its final exercise. This article (`dns.md`) owns all of that; it does not re-derive the `localhost` warm-up timing or the first-vs-repeat lookup measurement, which stay in `how-the-internet-works.md`.

`how-the-internet-works.md`'s own cross-link file already requests two links **into** this article ("stub resolver" / "recursive server", and "time to live") from its "Band 1" section — those can now be wired since this article's target exists.

## Glossary terms wanted (first use in this article; definitions for the integrator to write)

TTL (time to live, DNS sense — distinct from the IP-packet TTL glossary entry `how-the-internet-works.md` may request), NXDOMAIN, SERVFAIL, recursive resolver, authoritative server. First uses: "What is the hierarchy below the root?" (authoritative), "What's the difference between a recursive resolver and an iterative one?" (recursive resolver), "What does a TTL actually control?" (TTL), "What do DNS failure modes look like..." (NXDOMAIN, SERVFAIL). — Status: n/a (glossary term request for the integrator to write definitions elsewhere, not an article link)
