# Cross-links wanted from `networking/tcp-vs-udp`

Targets are unpublished (not yet in the build) as of this writing, so the article states these plainly in prose instead of linking. Wire in once each target is published.

- Anchor text "HTTP/1.1" (in "Framing a stream yourself" section, sentence beginning "This is what every text protocol built on TCP does one way or another") → `/networking/http-explained/` — Status: wired (first occurrence of this target in the article)
- Anchor text "chunked encoding" (same sentence) → `/networking/http-explained/#chunked-transfer` or the relevant heading once that article exists — Status: dropped (duplicate target /networking/http-explained/, already linked earlier in the same sentence via "HTTP/1.1"; the article also has no distinct "chunked-transfer" heading to anchor a second link to)
- Anchor text "A single DNS query" (in "What the guarantees cost in bytes" section) → `/networking/dns/` — Status: wired (first occurrence of this target in the article)
- Anchor text "a resolver's first attempt at looking up a short domain name" (Exercise 4, "Pick a transport", item 4) → `/networking/dns/` — Status: dropped (duplicate target /networking/dns/, already linked earlier via "A single DNS query")
- Anchor text "TLS 1.3 folded in" (in "Choosing between TCP, UDP and building on top of UDP" section) → `/networking/tls-and-https/` — Status: wired
- Anchor text "HTTP/3" (same section, last sentence) → `/networking/http-explained/` (once that article covers HTTP/1.1 vs 2 vs 3, per its planned outline) — Status: dropped (duplicate target /networking/http-explained/, already linked earlier via "HTTP/1.1"; target article now covers HTTP/1.1 vs 2 vs 3 as expected, but a second link to the same page is skipped)
