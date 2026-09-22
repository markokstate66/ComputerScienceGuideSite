# Wanted cross-links: /networking/how-the-internet-works/

One line each: anchor text | target route | where in the article.

- "stub resolver" / "recursive server" | /networking/dns/ | section "Band 1: the name becomes an address", second paragraph
- "time to live" (DNS record lifetime) | /networking/dns/ | section "Band 1", paragraph starting "After that, `example.com` took"
- "TCP three-way handshake" | /networking/tcp-vs-udp/ | section "What `ConnectAsync` did"
- "a single UDP packet" | /networking/tcp-vs-udp/ | section "Band 1", second paragraph
- "Nagle's algorithm" | /networking/tcp-vs-udp/ | exercise "Take NoDelay away", solution
- "a complete HTTP/1.1 request" | /networking/http-explained/ | section "What the 56 bytes were"
- "`Transfer-Encoding: chunked`" | /networking/http-explained/ | section "Where the response ends"
- "An HTTP cache" | /networking/http-explained/ (caching section, if it has one) | section "After the last byte of HTML"
- "The TLS 1.3 handshake is three flights" | /networking/tls-and-https/ | section "What the handshake exchanged"
- "a certificate chain" / certificate check | /networking/tls-and-https/ | section "Where the time went", TLS row discussion and section "What the handshake exchanged"
- "IP addresses" | /networking/ip-addresses-and-subnets/ | section "Underneath: every message above was cut into packets", paragraph "IP is where the network stops making promises."
- "network address port translation" | /networking/ip-addresses-and-subnets/ | same section, paragraph "That is the model, and real paths bend it."

## Glossary terms wanted (first use in the article; definitions for the integrator to write)

DNS, TCP, TLS, round-trip time (RTT), port, packet. First uses: intro paragraph (DNS, TCP, TLS, RTT), "The URL already says..." (port), "Underneath..." (packet).

## Note for sibling writers (dns, tcp-vs-udp, http-explained, tls-and-https)

Already taken by this article, so pick different examples and link back instead of re-deriving: the first-vs-repeat DNS lookup timing with a `localhost` warm-up, the hand-typed `GET` over `TcpClient` with chunked framing, the one-address-three-certificates SNI experiment, the loopback capture of what `HttpClient` sends, the TTL hop counter, and the Nagle/`NoDelay` first-request measurement.
