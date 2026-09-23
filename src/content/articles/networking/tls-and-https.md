---
title: "TLS and HTTPS: What the Padlock Guarantees"
description: "What TLS 1.3 promises, why the handshake mixes symmetric and asymmetric cryptography, how a certificate chain earns trust, and what a padlock never claims."
pillar: networking
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [tls, https, digital-signatures, x509-certificates, public-key-cryptography]
prerequisites: ["networking/how-the-internet-works"]
sources:
  - title: "RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3"
    url: "https://www.rfc-editor.org/rfc/rfc8446.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "RFC 5280: Internet X.509 Public Key Infrastructure Certificate and CRL Profile"
    url: "https://www.rfc-editor.org/rfc/rfc5280.html"
    publisher: "IETF"
    accessed: 2026-09-22
  - title: "Frequently Asked Questions"
    url: "https://letsencrypt.org/docs/faq/"
    publisher: "Let's Encrypt"
    accessed: 2026-09-22
  - title: "SslStream.RemoteCertificate Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.security.sslstream.remotecertificate"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "RemoteCertificateValidationCallback Delegate"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.net.security.remotecertificatevalidationcallback"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "X509Chain Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.x509chain"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "AesGcm Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "AesGcm.Decrypt Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm.decrypt"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "AuthenticationTagMismatchException Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.authenticationtagmismatchexception"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ECDiffieHellman.DeriveKeyFromHash Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.ecdiffiehellman.derivekeyfromhash"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "HMACSHA256.HashData Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.hmacsha256.hashdata"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ECDsa.SignHash Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.ecdsa.signhash"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

A padlock icon is a report on three specific properties, not a verdict on the site behind it. RFC 8446 defines TLS 1.3 as providing exactly these: the server side of the channel is always authenticated, data sent after the connection is set up is visible only to the two endpoints, and it cannot be modified in transit without detection ([RFC 8446, section 1](https://www.rfc-editor.org/rfc/rfc8446.html#section-1)). The [previous article on this pillar](/networking/how-the-internet-works/#band-3-the-same-request-inside-tls) measured a real TLS 1.3 handshake and named its three flights. This one goes one level lower: which cryptographic primitive buys which property, what each handshake message actually contains, how a certificate earns trust, and, as importantly, what none of this claims to do.

Getting that precise matters — the previous article flagged it in one sentence — because plenty of still-circulating explanations describe TLS 1.2, where the client encrypted a secret directly with the server's public key using RSA. TLS 1.3 removed that mechanism entirely, along with every cipher suite that did not guarantee forward secrecy ([RFC 8446, section 1.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-1.2)): "Static RSA and Diffie-Hellman cipher suites have been removed; all public-key based key exchange mechanisms now provide forward secrecy." This article follows RFC 8446 throughout, not the older story.

## What does "secure" actually mean here?

RFC 8446 names three properties of the channel it builds, and only the channel — not the operator at the other end, not the content they choose to serve:

- **Authentication.** "The server side of the channel is always authenticated; the client side is optionally authenticated." A client almost never presents its own certificate on the open web; server authentication is the one that matters for a browser talking to a site.
- **Confidentiality.** "Data sent over the channel after establishment is only visible to the endpoints." Not to routers, not to your ISP, not to anyone else on the path.
- **Integrity.** "Data sent over the channel after establishment cannot be modified by attackers without detection."

Every section below traces one of these back to a primitive you can run and inspect. The last section comes back to the boundary of "the channel", because that boundary is exactly where the guarantees stop.

## Why TLS needs two different kinds of cryptography

**Symmetric cryptography** encrypts and decrypts with the same secret key on both sides. It is fast and, done right, gives you confidentiality and integrity together: TLS 1.3 restricts its record-layer ciphers to algorithms that provide both at once, stating plainly that "those that remain are all Authenticated Encryption with Associated Data (AEAD) algorithms" ([RFC 8446, section 1.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-1.2)). An AEAD cipher produces, alongside the ciphertext, a short authentication tag; decryption recomputes that tag and refuses to reveal anything if it does not match. `AesGcm` is .NET's implementation of one such cipher — it "represents an Advanced Encryption Standard (AES) key to be used with the Galois/Counter Mode (GCM) mode of operation" ([Microsoft Learn, AesGcm Class](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm)) — and it makes both properties visible at once. Code on this page was run with the .NET 10 SDK (10.0.401) on Windows 11, x64:

```csharp run id=aead
using System.Security.Cryptography;
using System.Text;

byte[] key = RandomNumberGenerator
    .GetBytes(32);
byte[] nonce = RandomNumberGenerator
    .GetBytes(12);
byte[] plain = Encoding.UTF8.GetBytes(
    "meet at the north gate, 10am");
byte[] cipher = new byte[plain.Length];
byte[] tag = new byte[16];

using var aes = new AesGcm(
    key, tagSizeInBytes: 16);
aes.Encrypt(nonce, plain, cipher, tag);
Console.WriteLine(
    $"ciphertext {cipher.Length}B, " +
    $"tag {tag.Length}B");

byte[] opened = new byte[plain.Length];
aes.Decrypt(nonce, cipher, tag, opened);
Console.WriteLine(
    "decrypted: " +
    Encoding.UTF8.GetString(opened));

byte[] tampered =
    (byte[])cipher.Clone();
tampered[0] ^= 0x01;
try
{
    aes.Decrypt(
        nonce, tampered, tag, opened);
    Console.WriteLine("decrypted anyway");
}
catch (AuthenticationTagMismatchException)
{
    Console.WriteLine(
        "tampering detected: " +
        "tag no longer matches");
}
```

```text output
ciphertext 28B, tag 16B
decrypted: meet at the north gate, 10am
tampering detected: tag no longer matches
```

One bit flipped in the ciphertext, nothing touched in the tag, and `Decrypt` still refuses the whole message: with an AEAD cipher, "if `tag` cannot be validated ... then `plaintext` is cleared" ([Microsoft Learn, AesGcm.Decrypt, Remarks](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.aesgcm.decrypt#remarks)), and starting in .NET 8 the failure specifically throws `AuthenticationTagMismatchException` ([Microsoft Learn, AuthenticationTagMismatchException](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.authenticationtagmismatchexception)). That single check is where TLS 1.3's confidentiality and integrity promises are actually kept, message by message, for the lifetime of the connection.

None of that works without `key` already being a secret only the two of you hold. Your browser has never met `example.com` before, and both machines are exchanging bytes over a network anyone can read. That is the problem symmetric cryptography cannot solve by itself: how do two strangers agree on a secret in full view of an adversary, without ever putting the secret itself on the wire?

**Asymmetric cryptography** answers that. Each side has a key pair — a private key it never reveals and a public key it can hand to anyone — and the mathematics of the pair let two strangers compute the *same* shared value from each other's public keys without either one ever transmitting it. `ECDiffieHellman` performs exactly this exchange:

```csharp run id=ecdh
using System.Security.Cryptography;

using var clientKeys =
    ECDiffieHellman.Create(
        ECCurve.NamedCurves.nistP256);
using var serverKeys =
    ECDiffieHellman.Create(
        ECCurve.NamedCurves.nistP256);

byte[] clientSecret =
    clientKeys.DeriveKeyFromHash(
        serverKeys.PublicKey,
        HashAlgorithmName.SHA256);
byte[] serverSecret =
    serverKeys.DeriveKeyFromHash(
        clientKeys.PublicKey,
        HashAlgorithmName.SHA256);

Console.WriteLine(
    $"client derived {clientSecret.Length}B");
Console.WriteLine(
    $"server derived {serverSecret.Length}B");
Console.WriteLine(
    "both sides agree: " +
    clientSecret.SequenceEqual(
        serverSecret));
```

```text output
client derived 32B
server derived 32B
both sides agree: True
```

Neither side ever sent `clientSecret` or `serverSecret`; each computed it locally from its own private key and the other side's public key. `DeriveKeyFromHash` performs the Diffie-Hellman agreement internally, then returns "the hash of the shared secret" ([Microsoft Learn, ECDiffieHellman.DeriveKeyFromHash](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.ecdiffiehellman.derivekeyfromhash)) — SHA-256 here, which is why 32 bytes come out on each side. This is what a ClientHello's and a ServerHello's `key_share` extensions carry: "either a set of Diffie-Hellman key shares (in the `key_share` extension) ... or both" ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)). A fresh key pair for every single connection is also what "forward secrecy" means in the quote from the introduction: recording today's traffic and stealing the server's long-term private key next year still will not recover today's shared secret, because that secret was never derived from the long-term key in the first place — it was derived from a key pair generated once and then thrown away.

::::exercise[Match each property to what actually provides it]
Four things TLS 1.3 guarantees, four mechanisms discussed so far: an AEAD cipher's ciphertext, an AEAD cipher's tag, an ephemeral `key_share` exchange, and a digital signature (covered next). Match each property to the mechanism that provides it: confidentiality of application data, integrity of application data, a fresh secret neither side had to transmit, and forward secrecy across connections.

:::solution
Confidentiality: the AEAD ciphertext. Integrity: the AEAD tag, checked on every decrypt. A fresh secret neither side transmitted: the `key_share` exchange (Diffie-Hellman). Forward secrecy: the same exchange, specifically because it uses a new, disposable key pair per connection rather than a long-term one. Nothing on this list is a digital signature — key exchange alone establishes a shared secret with *whoever is on the other end of the exchange*, but says nothing about who that is. That gap is next.
:::
::::

A shared secret by itself does not prove identity. An attacker sitting on the path can run the exact same key-exchange math with you, and a separate one with the real server, relaying and reading everything in between — a shared secret exists at every hop, just not the one you think. Fixing that needs a statement the attacker cannot forge: a **digital signature**, made with a private key only the real server holds, over something specific to this handshake.

```csharp run id=sign
using System.Security.Cryptography;
using System.Text;

using var serverKeys = ECDsa.Create(
    ECCurve.NamedCurves.nistP256);

byte[] transcriptHash = SHA256.HashData(
    Encoding.UTF8.GetBytes(
        "ClientHello || ServerHello || " +
        "EncryptedExtensions"));

byte[] signature =
    serverKeys.SignHash(transcriptHash);
Console.WriteLine(
    $"signature: {signature.Length} bytes");
Console.WriteLine(
    "verifies with the real key pair: " +
    serverKeys.VerifyHash(
        transcriptHash, signature));

transcriptHash[0] ^= 0x01; // one message altered
Console.WriteLine(
    "verifies after the transcript changed: " +
    serverKeys.VerifyHash(
        transcriptHash, signature));

using var attacker = ECDsa.Create(
    ECCurve.NamedCurves.nistP256);
Console.WriteLine(
    "verifies against an attacker's key: " +
    attacker.VerifyHash(
        SHA256.HashData(
            Encoding.UTF8.GetBytes(
                "ClientHello || ServerHello || " +
                "EncryptedExtensions")),
        signature));
```

```text output
signature: 64 bytes
verifies with the real key pair: True
verifies after the transcript changed: False
verifies against an attacker's key: False
```

`SignHash` defaults to encoding the signature as `IeeeP1363FixedFieldConcatenation` — the two 32-byte values (`r` and `s`) that make up an ECDSA signature on the P-256 curve, concatenated ([Microsoft Learn, ECDsa.SignHash](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.ecdsa.signhash#system-security-cryptography-ecdsa-signhash%28system-readonlyspan%28%28system-byte%29%29%29)), which is the 64 bytes printed above. Changing one byte of what was signed, or checking against any key pair other than the one that signed it, both fail verification. This is a small stand-in for TLS 1.3's actual **CertificateVerify** message, which is defined the same way: "a signature over the entire handshake using the private key corresponding to the public key in the Certificate message" ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)). Only someone holding the certificate's private key can produce a signature that verifies against the certificate's public key over this exact handshake, which is what turns "we agreed on a secret" into "I agreed on this secret with the party this certificate names."

The handshake has one more signature-shaped step that is not a public-key signature at all. RFC 8446 defines the **Finished** message's contents as `verify_data = HMAC(finished_key, Transcript-Hash(...))` ([RFC 8446, section 4.4.4](https://www.rfc-editor.org/rfc/rfc8446.html#section-4.4.4)) — an HMAC, the symmetric-key cousin of a digital signature: a MAC computed with a shared secret instead of a private key, cheap enough to compute for every handshake without touching public-key math again. `HMACSHA256.HashData` is .NET's one-call implementation of that step; it "computes the HMAC of data using the SHA-256 algorithm" ([Microsoft Learn, HMACSHA256.HashData](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.hmacsha256.hashdata)). Both sides derive `finished_key` from the same handshake secret established earlier and can each compute the same `verify_data` only if they agree on every message exchanged so far:

```csharp run id=finished
using System.Security.Cryptography;
using System.Text;

// stands in for the real derivation, which is
// HKDF-Expand-Label(handshake secret, "finished", ...)
byte[] finishedKey =
    RandomNumberGenerator.GetBytes(32);

byte[] Transcript(string flight) =>
    SHA256.HashData(
        Encoding.UTF8.GetBytes(flight));

string flightSoFar =
    "ClientHello+ServerHello+" +
    "EncryptedExtensions+Certificate+" +
    "CertificateVerify";

byte[] clientVerifyData = HMACSHA256.HashData(
    finishedKey, Transcript(flightSoFar));
byte[] serverVerifyData = HMACSHA256.HashData(
    finishedKey, Transcript(flightSoFar));
Console.WriteLine(
    "same transcript, verify_data matches: " +
    clientVerifyData.SequenceEqual(
        serverVerifyData));

byte[] afterAnInsertedMessage =
    HMACSHA256.HashData(
        finishedKey,
        Transcript(flightSoFar + "+EXTRA"));
Console.WriteLine(
    "altered transcript, verify_data matches: " +
    clientVerifyData.SequenceEqual(
        afterAnInsertedMessage));
```

```text output
same transcript, verify_data matches: True
altered transcript, verify_data matches: False
```

That second line is the whole point of Finished: it is the reason an attacker cannot quietly insert, drop or edit a handshake message — even one sent before any encryption started, like ClientHello — without both sides' `verify_data` disagreeing and the handshake failing. RFC 8446 states the same thing generally: Finished "provides key confirmation, binds the endpoint's identity to the exchanged keys, and in PSK mode also authenticates the handshake" ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)).

## The TLS 1.3 handshake, message by message

<figure class="diagram">
<svg viewBox="0 0 360 510" role="img" aria-labelledby="msgflow-title msgflow-desc">
<title id="msgflow-title">The TLS 1.3 handshake, message by message</title>
<desc id="msgflow-desc">A sequence diagram with the client on the left and the server on the right. The client sends an unencrypted ClientHello carrying a key share. The server answers with an unencrypted ServerHello carrying its own key share, after which both sides derive handshake traffic keys. In the same flight, now encrypted, the server sends EncryptedExtensions, its Certificate, a CertificateVerify signature over the transcript so far, and a Finished MAC. The client sends its own encrypted Finished, then application data can leave immediately without waiting for a reply. Everything from EncryptedExtensions onward is drawn in the accent color to mark it as encrypted with handshake or application traffic keys.</desc>
<defs>
<marker id="msgflow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="msgflow-arrow-acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="50" y="18" text-anchor="middle" class="d-bold d-small">client</text>
<text x="310" y="18" text-anchor="middle" class="d-bold d-small">server</text>
<path d="M50 26 V466" class="d-line d-dashed"/>
<path d="M310 26 V466" class="d-line d-dashed"/>
<rect x="10" y="32" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="46" class="d-small d-bold">1 ClientHello — unencrypted</text>
<text x="180" y="68" text-anchor="middle" class="d-small d-mono">key_share, sig_algorithms</text>
<path d="M54 76 H306" class="d-line" marker-end="url(#msgflow-arrow)"/>
<rect x="10" y="90" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="104" class="d-small d-bold">2 ServerHello — unencrypted</text>
<text x="180" y="126" text-anchor="middle" class="d-small">key_share — handshake keys derived now</text>
<path d="M306 134 H54" class="d-line" marker-end="url(#msgflow-arrow)"/>
<rect x="10" y="148" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="162" class="d-small d-bold">3 server's next flight — encrypted</text>
<rect x="10" y="172" width="340" height="140" rx="6" class="d-box-accent"/>
<text x="180" y="192" text-anchor="middle" class="d-mono d-small">EncryptedExtensions</text>
<text x="180" y="210" text-anchor="middle" class="d-mono d-small">Certificate</text>
<text x="180" y="226" text-anchor="middle" class="d-small">the server's cert and its issuers</text>
<text x="180" y="248" text-anchor="middle" class="d-mono d-small">CertificateVerify</text>
<text x="180" y="264" text-anchor="middle" class="d-small">signature over the transcript so far</text>
<text x="180" y="286" text-anchor="middle" class="d-mono d-small">Finished</text>
<text x="180" y="302" text-anchor="middle" class="d-small">MAC proving both sides hold the keys</text>
<path d="M306 320 H54" class="d-accent" marker-end="url(#msgflow-arrow-acc)"/>
<text x="180" y="336" text-anchor="middle" class="d-small d-muted">sent together, one TCP flight</text>
<rect x="10" y="350" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="364" class="d-small d-bold">4 client's Finished — encrypted</text>
<text x="180" y="386" text-anchor="middle" class="d-mono d-small d-text-accent">Finished</text>
<path d="M54 394 H306" class="d-accent" marker-end="url(#msgflow-arrow-acc)"/>
<rect x="10" y="408" width="340" height="20" rx="4" class="d-box-2"/>
<text x="18" y="422" class="d-small d-bold">5 application data — same channel</text>
<text x="180" y="444" text-anchor="middle" class="d-mono d-small d-text-accent">[GET / HTTP/1.1 ...]</text>
<path d="M54 452 H306" class="d-accent" marker-end="url(#msgflow-arrow-acc)"/>
<text x="10" y="480" class="d-small d-muted">Client certificates (CertificateRequest, the</text>
<text x="10" y="496" class="d-small d-muted">client's own Certificate/CertificateVerify) are</text>
<text x="10" y="510" class="d-small d-muted">omitted: almost no browser connection uses them.</text>
</svg>
<figcaption>Figure 1. Every handshake message RFC 8446 names for a full 1-RTT connection, in order. Accent color marks everything encrypted with handshake traffic keys; the last row switches to application traffic keys, and the client's first request can leave without waiting for the server to answer.</figcaption>
</figure>

Two unencrypted messages, then a hard boundary. RFC 8446's own message-flow figure marks every message from EncryptedExtensions onward with braces to show it is "protected using keys derived from a `[sender]_handshake_traffic_secret`", and application data with brackets for keys derived from an `..._application_traffic_secret` ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)). That boundary is also stated in prose: "all handshake messages after the ServerHello are now encrypted" ([RFC 8446, section 1.2](https://www.rfc-editor.org/rfc/rfc8446.html#section-1.2)). One consequence worth naming: **Certificate**, the message carrying the server's certificate chain, is itself encrypted. An eavesdropper watching the handshake never sees which certificate was presented — only that some certificate was, and how large it was.

The Certificate message's own definition is short: "the certificate of the endpoint and any per-certificate extensions" ([RFC 8446, section 2](https://www.rfc-editor.org/rfc/rfc8446.html#section-2)). What makes that certificate trustworthy is not part of the handshake at all — it is a separate question the next section answers.

If you followed the four-band walkthrough in the [previous article](/networking/how-the-internet-works/#band-3-the-same-request-inside-tls), this is the same one round trip, drawn at the level of individual messages instead of one arrow per flight. The [HTTP request that leaves right after the client's Finished](/networking/http-explained/) is unchanged by any of this: TLS wraps an existing byte stream, it does not alter what travels inside it.

::::exercise[Predict a tampered tag, not a tampered message]
The AEAD demo above flipped a byte of the *ciphertext* and caught it. Predict what `aes.Decrypt(nonce, cipher, tamperedTag, opened)` does if, instead, the ciphertext is left alone and one byte of the **tag** is flipped before decrypting.
:::solution
The same failure. `Decrypt` recomputes the tag from the key, nonce, and ciphertext it is given, and compares that computed value against whatever tag it was handed — it does not matter which one changed, only that they no longer match.

```csharp run
using System.Security.Cryptography;
using System.Text;

byte[] key = RandomNumberGenerator.GetBytes(32);
byte[] nonce = RandomNumberGenerator.GetBytes(12);
byte[] plain = Encoding.UTF8.GetBytes("ok");
byte[] cipher = new byte[plain.Length];
byte[] tag = new byte[16];

using var aes = new AesGcm(key, tagSizeInBytes: 16);
aes.Encrypt(nonce, plain, cipher, tag);

byte[] tamperedTag = (byte[])tag.Clone();
tamperedTag[0] ^= 0x01;
byte[] opened = new byte[plain.Length];
try
{
    aes.Decrypt(nonce, cipher, tamperedTag, opened);
    Console.WriteLine("decrypted anyway");
}
catch (AuthenticationTagMismatchException)
{
    Console.WriteLine("rejected: tag mismatch");
}
```

```text output
rejected: tag mismatch
```
:::
::::

## What makes a certificate trustworthy?

A certificate binds a name to a public key and is itself signed by someone else's private key. RFC 5280 explains why that signature chains rather than standing alone: "if the public key user does not already hold an assured copy of the public key of the CA that signed the certificate ... then it might need an additional certificate to obtain that public key. In general, a chain of multiple certificates may be needed, comprising a certificate of the public key owner (the end entity) signed by one CA, and zero or more additional certificates of CAs signed by other CAs" ([RFC 5280, section 3.2](https://www.rfc-editor.org/rfc/rfc5280.html#section-3.2)). Such chains exist, the same section continues, "because a public key user is only initialized with a limited number of assured CA public keys" — the small set of root certificates your operating system or browser ships with and already trusts, with no certificate needed to trust them.

<figure class="diagram">
<svg viewBox="0 0 360 360" role="img" aria-labelledby="chain-title chain-desc">
<title id="chain-title">A minimal certificate chain, root to leaf</title>
<desc id="chain-desc">Three stacked boxes. At the top, a root CA certificate, self-signed and already trusted by the operating system. An arrow labelled signs the intermediate's public key leads down to an intermediate CA certificate, whose subject is the intermediate and whose issuer is the root. A second arrow labelled signs the leaf's public key leads down to the leaf certificate for example.com, whose subject is example.com and whose issuer is the intermediate. A note below explains that verification actually walks upward from the leaf, checking each signature against the issuer named one box up, stopping at a certificate already trusted.</desc>
<defs>
<marker id="chain-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="40" y="24" width="280" height="56" rx="6" class="d-box-good"/>
<text x="180" y="46" text-anchor="middle" class="d-bold">Root CA certificate</text>
<text x="180" y="64" text-anchor="middle" class="d-small">self-signed; already trusted by the OS</text>
<text x="180" y="96" text-anchor="middle" class="d-small d-text-accent">signs the intermediate's public key</text>
<path d="M180 102 V126" class="d-accent" marker-end="url(#chain-arrow)"/>
<rect x="40" y="130" width="280" height="56" rx="6" class="d-box-2"/>
<text x="180" y="152" text-anchor="middle" class="d-bold">Intermediate CA certificate</text>
<text x="180" y="170" text-anchor="middle" class="d-small">subject: intermediate. issuer: the root</text>
<text x="180" y="202" text-anchor="middle" class="d-small d-text-accent">signs the leaf's public key</text>
<path d="M180 208 V232" class="d-accent" marker-end="url(#chain-arrow)"/>
<rect x="40" y="236" width="280" height="56" rx="6" class="d-box-accent"/>
<text x="180" y="258" text-anchor="middle" class="d-bold">Leaf certificate — example.com</text>
<text x="180" y="276" text-anchor="middle" class="d-small">subject: example.com. issuer: intermediate</text>
<text x="20" y="316" class="d-small d-muted">A client verifies the other way: start at the leaf,</text>
<text x="20" y="332" class="d-small d-muted">check each signature against the issuer named one</text>
<text x="20" y="348" class="d-small d-muted">box up, and stop at a certificate already trusted.</text>
</svg>
<figcaption>Figure 2. The shortest possible chain: one intermediate. Signing runs from the root downward; a client validates a chain the other way, starting at the certificate the server sent and climbing until it reaches one already in its trust store. A real chain often has more than one intermediate, as the program below finds for a live server.</figcaption>
</figure>

`SslStream` does that walk for you and hands you the result. `SslStream.RemoteCertificate` exposes "the certificate used to authenticate the remote endpoint" ([Microsoft Learn, SslStream.RemoteCertificate](https://learn.microsoft.com/en-us/dotnet/api/system.net.security.sslstream.remotecertificate)) — the leaf only. To see the whole chain, supply a `RemoteCertificateValidationCallback`, whose `chain` parameter is documented as "the chain of certificate authorities associated with the remote certificate" ([Microsoft Learn, RemoteCertificateValidationCallback](https://learn.microsoft.com/en-us/dotnet/api/system.net.security.remotecertificatevalidationcallback)) and whose elements are exposed through `X509Chain.ChainElements`, a `X509ChainElement` collection with each element's `Certificate` and validation status ([Microsoft Learn, X509Chain](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.x509chain)). This program connects to the real `example.com`, captures the chain the runtime already built, and checks the structural link Figure 2 describes directly: each certificate's issuer name should equal the subject name of the certificate one link up.

```csharp run id=chain
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography.X509Certificates;

const string host = "example.com";
var subjects = new List<string>();
var issuers = new List<string>();
SslPolicyErrors seen = SslPolicyErrors.None;

var options = new SslClientAuthenticationOptions
{
    TargetHost = host,
    RemoteCertificateValidationCallback =
        (_, _, chain, errors) =>
    {
        seen = errors;
        if (chain is not null)
            foreach (X509ChainElement e in
                chain.ChainElements)
            {
                subjects.Add(
                    e.Certificate.Subject);
                issuers.Add(
                    e.Certificate.Issuer);
            }
        return errors == SslPolicyErrors.None;
    },
};

using var tcp = new TcpClient();
await tcp.ConnectAsync(host, 443);
using var tls = new SslStream(tcp.GetStream());
await tls.AuthenticateAsClientAsync(options);

bool linked = true;
for (int i = 0; i < subjects.Count - 1; i++)
    if (issuers[i] != subjects[i + 1])
        linked = false;

Console.WriteLine($"policy errors: {seen}");
Console.WriteLine($"chain links: {subjects.Count}");
Console.WriteLine(
    "each issuer matches the next " +
    $"subject up the chain: {linked}");
Console.WriteLine($"leaf subject: {subjects[0]}");
```

```text output
policy errors: None
chain links: [...]
each issuer matches the next subject up the chain: True
leaf subject: [...]
```

The run used for this page, on 2026-09-22, found five links — this server's chain runs through two intermediates and a cross-signed legacy root before reaching one already in the trust store — and a leaf certificate for `CN=example.com`; the chain length and the intermediate's and root's names can change whenever a certificate authority rotates a certificate, so they are wildcarded above. `linked` staying `True` is the mechanical core of "trust": it means every signature in the chain actually verifies against the next certificate's public key, all the way up. Whether the *top* of that chain is one your machine already trusts is a separate check `AuthenticateAsClientAsync` also performs — `seen` reports `None` here because it is.

::::exercise[See the policy error instead of just a thrown exception]
Every network failure so far has surfaced as a thrown exception. Build a minimal local TLS server around a self-signed certificate you generate yourself with `CertificateRequest`, then connect to it as a client whose `RemoteCertificateValidationCallback` returns `true` regardless of `errors`, so the handshake completes instead of throwing. Before running it, predict which single `SslPolicyErrors` flag you get back, and why a chain that is internally consistent (the leaf really is signed by the key that made it) still is not enough.

:::warning
Never write a callback that returns `true` unconditionally outside an experiment like this one. It disables the one check `https://` promises a browser performs.
:::

:::solution
`RemoteCertificateChainErrors`: the certificate's own signature is fine (it signed itself with the private key `CertificateRequest` generated), but chain building cannot walk any further, because the signer is not a root your machine already trusts. `X509Chain`'s remarks say exactly this kind of thing should be read from its global status, not assumed from one element: "the rules governing certificate validation are complex, and it is easy to oversimplify the validation logic by ignoring the error status of one or more of the elements involved" ([Microsoft Learn, X509Chain, Remarks](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.x509chain#remarks)).

```csharp run
using System.Net;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

using var key = ECDsa.Create(
    ECCurve.NamedCurves.nistP256);
var req = new CertificateRequest(
    "CN=localhost", key, HashAlgorithmName.SHA256);
var san = new SubjectAlternativeNameBuilder();
san.AddDnsName("localhost");
req.CertificateExtensions.Add(san.Build());
using X509Certificate2 ephemeral =
    req.CreateSelfSigned(
        DateTimeOffset.UtcNow.AddDays(-1),
        DateTimeOffset.UtcNow.AddDays(1));
byte[] pfx = ephemeral.Export(
    X509ContentType.Pfx);
using X509Certificate2 selfSigned =
    X509CertificateLoader.LoadPkcs12(
        pfx, password: null);

var listener = new TcpListener(
    IPAddress.Loopback, 0);
listener.Start();
int port = ((IPEndPoint)
    listener.LocalEndpoint).Port;

Task server = Task.Run(async () =>
{
    using TcpClient peer = await listener
        .AcceptTcpClientAsync();
    using var tlsServer =
        new SslStream(peer.GetStream());
    await tlsServer.AuthenticateAsServerAsync(
        selfSigned);
});

SslPolicyErrors seen = SslPolicyErrors.None;
using var tcp = new TcpClient();
await tcp.ConnectAsync(
    IPAddress.Loopback, port);
using var tlsClient =
    new SslStream(tcp.GetStream());
var options = new SslClientAuthenticationOptions
{
    TargetHost = "localhost",
    RemoteCertificateValidationCallback =
        (_, _, _, errors) =>
    {
        seen = errors;
        return true; // never do this
    },
};
await tlsClient.AuthenticateAsClientAsync(
    options);
await server;
listener.Stop();

Console.WriteLine($"policy errors: {seen}");
```

```text output
policy errors: RemoteCertificateChainErrors
```
:::
::::

## What doesn't the padlock protect against?

Go back to the scope RFC 8446 states: authentication, confidentiality and integrity of "the channel", after it is established. Read literally, that boundary rules out several things people routinely expect a padlock to cover.

**Traffic analysis.** TLS does not hide how much you sent, or when. RFC 8446 says so directly: "TLS does not hide the length of the data it transmits, though endpoints are able to pad TLS records in order to obscure lengths and improve protection against traffic analysis techniques" ([RFC 8446, section 1](https://www.rfc-editor.org/rfc/rfc8446.html#section-1)). Padding is optional, and RFC 8446 does not say how many servers turn it on. Without it, an observer who cannot read a single byte of your traffic can still see the size and timing of every encrypted record — enough, in principle, to distinguish one page on a site from another when their sizes differ.

**Endpoint compromise.** The guarantee covers data "sent over the channel"; it says nothing about either end. Confidentiality means nothing if malware on your machine reads the plaintext before it is encrypted, or if the server itself is compromised and logs request bodies after decrypting them. TLS protects the wire between two points — it has no opinion on what either point does with the plaintext before or after.

**A certificate proves control of a name, not good intent behind it.** Certificate issuance can validate only what it checks, and that is typically the applicant's control of the domain name, nothing about who operates it or why. Let's Encrypt, a certificate authority, addresses this directly in its own FAQ, under the heading "A website using Let's Encrypt is engaged in Phishing/Malware/Scam/…, what should I do?": "We recommend reporting such sites to Google Safe Browsing and the Microsoft Smart Screen program, which are able to more effectively protect users" ([Let's Encrypt, Frequently Asked Questions](https://letsencrypt.org/docs/faq/)). A phishing page served over a validly issued certificate passes every check this article has covered — the chain verifies, the name matches, the channel is encrypted — and the padlock still shows. It was never a claim about the page's honesty.

What is visible before any of this even starts is covered where it belongs: the ClientHello's Server Name Indication, sent unencrypted, is [already shown on the wire in the previous article](/networking/how-the-internet-works/#band-3-the-same-request-inside-tls). Nothing in TLS 1.3 changes that; it changes what happens to every message after it.
