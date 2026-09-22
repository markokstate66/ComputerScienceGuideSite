# Wanted cross-links: /networking/http-explained/

One line each: anchor text | target route | where in the article.

- "`TcpListener.Start` puts the socket into a listening state" / backlog | /networking/tcp-vs-udp/ | section "A message is a start line, headers, a blank line, an optional body", paragraph before the `wire` program
- "TCP does not preserve write boundaries" | /networking/tcp-vs-udp/ | note under the `wire` program's output block
- "a lost TCP segment stalls every stream, because TCP delivers ... strictly in order" | /networking/tcp-vs-udp/ | HTTP/1.1 vs 2 vs 3 table and surrounding prose
- "TLS 1.3" (HTTP/2 and HTTP/3 both assume an encrypted connection in practice) | /networking/tls-and-https/ | HTTP/1.1 vs 2 vs 3 section, if a sentence on ALPN/TLS is added later
- "example.com" / DNS resolution before any of these connections happen | /networking/dns/ | not currently referenced; only relevant if a future revision opens with a real-host example instead of loopback

## Glossary terms wanted (first use in the article; definitions for the integrator to write)

idempotent, safe (HTTP method), status code, ETag, conditional request, cookie, session. First uses: "Methods, and which ones are safe to repeat" (idempotent, safe), "Five families of status code..." (status code), "Telling a client its copy is still good" (ETag, conditional request), "Remembering a client between requests" (cookie, session).

## Note for sibling writers (tcp-vs-udp, tls-and-https, dns)

Already taken by this article, so pick different examples and link back instead of re-deriving: the request/response message-framing helper (`ReadHead`/`ReadBody` reading past a blank line found mid-buffer, not at the end), the `PUT`/`POST` idempotency demonstration against an in-memory item store, the `Expect: 100-continue` round trip for a real 1xx response, the SHA-256-based strong `ETag` and its `If-None-Match`/304 round trip, and the `Set-Cookie`/`Cookie` session demo with a teammate's-bug exercise about attribute stripping.
