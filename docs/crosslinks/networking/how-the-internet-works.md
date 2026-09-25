# Wanted cross-links: /networking/how-the-internet-works/

One line each: anchor text | target route | where in the article.

- "stub resolver" / "recursive server" | /networking/dns/ | section "Band 1: the name becomes an address", second paragraph — Status: wired (linked "stub resolver"; "recursive server" left unlinked in the same sentence to avoid a second link to the same target one clause later, per no-duplicate-link rule)
- "time to live" (DNS record lifetime) | /networking/dns/ | section "Band 1", paragraph starting "After that, `example.com` took" — Status: dropped (duplicate target /networking/dns/, already linked earlier via "stub resolver" in Band 1, per no-duplicate-link-per-article rule)
- "TCP three-way handshake" | /networking/tcp-vs-udp/ | section "What `ConnectAsync` did" — Status: dropped (duplicate target /networking/tcp-vs-udp/, already linked earlier via "a single UDP packet" in Band 1)
- "a single UDP packet" | /networking/tcp-vs-udp/ | section "Band 1", second paragraph — Status: wired (/networking/tcp-vs-udp/)
- "Nagle's algorithm" | /networking/tcp-vs-udp/ | exercise "Take NoDelay away", solution — Status: dropped (duplicate target /networking/tcp-vs-udp/, already linked earlier via "a single UDP packet")
- "a complete HTTP/1.1 request" | /networking/http-explained/ | section "What the 56 bytes were" — Status: wired (/networking/http-explained/)
- "`Transfer-Encoding: chunked`" | /networking/http-explained/ | section "Where the response ends" — Status: dropped (duplicate target /networking/http-explained/, already linked earlier via "a complete HTTP/1.1 request")
- "An HTTP cache" | /networking/http-explained/ (caching section, if it has one) | section "After the last byte of HTML" — Status: dropped (duplicate target /networking/http-explained/, already linked earlier via "a complete HTTP/1.1 request")
- "The TLS 1.3 handshake is three flights" | /networking/tls-and-https/ | section "What the handshake exchanged" — Status: wired (/networking/tls-and-https/, exact phrase matched verbatim)
- "a certificate chain" / certificate check | /networking/tls-and-https/ | section "Where the time went", TLS row discussion and section "What the handshake exchanged" — Status: dropped (duplicate target /networking/tls-and-https/, already linked earlier via "The TLS 1.3 handshake is three flights"; also no literal "certificate chain" phrase exists at either named spot)
- "IP addresses" | /networking/ip-addresses-and-subnets/ | section "Underneath: every message above was cut into packets", paragraph "IP is where the network stops making promises." — Status: wired (exact phrase absent, so "address" in "the destination address" was changed to "IP address" and linked, per the smallest-natural-clause rule)
- "network address port translation" | /networking/ip-addresses-and-subnets/ | same section, paragraph "That is the model, and real paths bend it." — Status: dropped (duplicate target /networking/ip-addresses-and-subnets/, already linked earlier via "IP address" in the same section)

## Glossary terms wanted (first use in the article; definitions for the integrator to write)

DNS, TCP, TLS, round-trip time (RTT), port, packet. First uses: intro paragraph (DNS, TCP, TLS, RTT), "The URL already says..." (port), "Underneath..." (packet). — Status: n/a (glossary term request for the integrator to write definitions elsewhere, not an article link)

## Note for sibling writers (dns, tcp-vs-udp, http-explained, tls-and-https)

Already taken by this article, so pick different examples and link back instead of re-deriving: the first-vs-repeat DNS lookup timing with a `localhost` warm-up, the hand-typed `GET` over `TcpClient` with chunked framing, the one-address-three-certificates SNI experiment, the loopback capture of what `HttpClient` sends, the TTL hop counter, and the Nagle/`NoDelay` first-request measurement.
