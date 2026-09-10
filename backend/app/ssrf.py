"""SSRF protection: reject any URL that resolves to a private/loopback/link-local
address or a cloud-metadata endpoint. Used before any outbound HTTP fetch."""

import ipaddress
import socket
from urllib.parse import urlparse
from typing import Optional


BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",
    "100.100.100.200",  # Alibaba metadata
}


class SSRFError(ValueError):
    pass


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_public_http_url(url: str) -> str:
    """Validate that `url` is a public http(s) URL that is safe to fetch.

    Raises SSRFError if the scheme is not http/https, the host is missing,
    the host resolves to a private/loopback/reserved IP, or the hostname is
    on the explicit deny list.
    """
    if not url or not isinstance(url, str):
        raise SSRFError("Missing URL")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise SSRFError("Only http(s) URLs are allowed")
    host = parsed.hostname
    if not host:
        raise SSRFError("URL has no host")
    host_lower = host.lower()
    if host_lower in BLOCKED_HOSTNAMES:
        raise SSRFError("Host is not allowed")

    # Resolve all A/AAAA records and reject if ANY are private.
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise SSRFError("Host did not resolve")

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            raise SSRFError("Resolved to an invalid address")
        if _is_blocked_ip(ip):
            raise SSRFError("Host resolves to a private or reserved address")

    return url
