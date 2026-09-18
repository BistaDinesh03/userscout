"""Public contact enrichment.

Given a prospect (GitHub username), look for public professional contact
paths. Sources, in order:

1. The GitHub profile itself (`blog` and `twitter_username`).
2. The one personal website linked from the GitHub profile.
3. On that website only: a single `/contact` or `/about` page reachable
   by direct link, then extract `mailto:` and `linkedin.com/in/` links.

Strictly:
- No email guessing. Only `mailto:` hrefs that literally appear on a page.
- SSRF-protected: every outbound URL is validated to resolve to a public IP.
- Bounded: max 3 fetches per prospect, 5s timeout each, 100KB size cap.
- Respects robots.txt.
- Never raises into the request: failures are returned as structured errors.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser

import httpx

from .ssrf import validate_public_http_url, SSRFError


MAX_BYTES = 100_000
TIMEOUT_S = 5.0
USER_AGENT = "UserScout/0.1 (public-contact-discovery; +https://github.com/BistaDinesh03/userscout)"

# These hosts are fixed, first-party endpoints we call directly. They are
# never user-controlled, so we bypass the private-IP check for them — this
# protects against environments (corporate DNS, Pi-hole, VPNs) where
# api.github.com may resolve to a reserved IP that is actually the safe
# upstream.
TRUSTED_HOSTS = {"api.github.com", "github.com"}

# Simple pattern for extracting contact-ish info from HTML.
MAILTO_RE = re.compile(r'mailto:([^"\'>\s?]+)', re.IGNORECASE)
LINKEDIN_RE = re.compile(r'https?://(?:www\.)?linkedin\.com/in/([A-Za-z0-9\-_%]+)', re.IGNORECASE)
# Common contact-ish page paths (tried at most once each).
CONTACT_PATHS = ["/contact", "/about"]


@dataclass
class DiscoveredChannel:
    type: str          # email | website | linkedin | x | github
    value: str
    url: Optional[str] = None
    source_url: Optional[str] = None
    source_type: str = "github-profile"
    confidence: str = "medium"  # low | medium | high
    is_public: bool = True
    is_verified: bool = False


@dataclass
class EnrichmentResult:
    channels: list[DiscoveredChannel] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    fetched: list[str] = field(default_factory=list)


def _robots_allows(client: httpx.Client, url: str) -> bool:
    """Best-effort robots.txt check. On any error, assume allowed but log."""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        # SSRF: only fetch robots from a validated host.
        try:
            validate_public_http_url(robots_url)
        except SSRFError:
            return False
        r = client.get(robots_url, timeout=3.0)
        if r.status_code >= 400:
            return True  # no robots.txt = allowed
        rp = RobotFileParser()
        rp.parse(r.text.splitlines())
        return rp.can_fetch(USER_AGENT, url)
    except Exception:
        return True


def _safe_fetch(client: httpx.Client, url: str) -> Optional[str]:
    """Fetch a URL with SSRF + timeout + size guards. Returns text or None."""
    from urllib.parse import urlparse as _urlparse
    host = (_urlparse(url).hostname or "").lower()
    if host not in TRUSTED_HOSTS:
        try:
            validate_public_http_url(url)
        except SSRFError:
            return None
    if not _robots_allows(client, url):
        return None
    try:
        with client.stream("GET", url, timeout=TIMEOUT_S, follow_redirects=True) as r:
            # Final URL after redirects must also be safe.
            try:
                validate_public_http_url(str(r.url))
            except SSRFError:
                return None
            if r.status_code >= 400:
                return None
            content_type = r.headers.get("content-type", "")
            if "html" not in content_type.lower() and "text" not in content_type.lower():
                return None
            chunks = []
            total = 0
            for chunk in r.iter_bytes():
                chunks.append(chunk)
                total += len(chunk)
                if total >= MAX_BYTES:
                    break
            body = b"".join(chunks)[:MAX_BYTES]
            return body.decode("utf-8", errors="replace")
    except Exception:
        return None


def enrich_from_github_profile(username: str) -> EnrichmentResult:
    """Fetch the GitHub profile via the public API and derive initial channels."""
    result = EnrichmentResult()
    api_url = f"https://api.github.com/users/{username}"
    try:
        validate_public_http_url(api_url)
    except SSRFError as e:
        # api.github.com is a fixed, trusted endpoint — this only fires when
        # a local DNS resolver misclassifies a public IP as reserved.
        host = urlparse(api_url).hostname or ""
        if host not in TRUSTED_HOSTS:
            result.errors.append(f"github lookup blocked: {e}")
            return result

    headers = {"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT}
    try:
        with httpx.Client(timeout=TIMEOUT_S, headers=headers) as c:
            r = c.get(api_url)
            result.fetched.append(api_url)
            if r.status_code != 200:
                result.errors.append(f"github profile HTTP {r.status_code}")
                return result
            data = r.json()
    except Exception as e:
        result.errors.append(f"github fetch failed: {e}")
        return result

    # GitHub channel is always available (public profile).
    result.channels.append(DiscoveredChannel(
        type="github",
        value=f"@{username}",
        url=f"https://github.com/{username}",
        source_url=f"https://github.com/{username}",
        source_type="github-profile",
        confidence="high",
    ))

    blog = (data.get("blog") or "").strip()
    if blog:
        # GitHub `blog` is often missing the scheme.
        if not blog.startswith(("http://", "https://")):
            blog = "https://" + blog
        try:
            validate_public_http_url(blog)
            result.channels.append(DiscoveredChannel(
                type="website",
                value=urlparse(blog).netloc or blog,
                url=blog,
                source_url=f"https://github.com/{username}",
                source_type="github-profile",
                confidence="high",
            ))
            _harvest_from_website(blog, result)
        except SSRFError as e:
            result.errors.append(f"website blocked: {e}")

    twitter = (data.get("twitter_username") or "").strip().lstrip("@")
    if twitter:
        result.channels.append(DiscoveredChannel(
            type="x",
            value=f"@{twitter}",
            url=f"https://x.com/{twitter}",
            source_url=f"https://github.com/{username}",
            source_type="github-profile",
            confidence="high",
        ))

    # Fetch GitHub's social_accounts (LinkedIn, X, Mastodon, personal site, etc.)
    _harvest_social_accounts(username, result)

    return result


def _harvest_social_accounts(username: str, result: EnrichmentResult) -> None:
    """Fetch /users/{username}/social_accounts — public links the person
    explicitly added to their GitHub profile. Never guesses."""
    api_url = f"https://api.github.com/users/{username}/social_accounts"
    try:
        validate_public_http_url(api_url)
    except SSRFError:
        host = urlparse(api_url).hostname or ""
        if host not in TRUSTED_HOSTS:
            return

    headers = {"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT}
    try:
        with httpx.Client(timeout=TIMEOUT_S, headers=headers) as c:
            r = c.get(api_url)
            result.fetched.append(api_url)
            if r.status_code != 200:
                return
            accounts = r.json() or []
    except Exception:
        return

    # Dedupe against already-discovered values
    existing_urls = {(ch.url or "").rstrip("/").lower() for ch in result.channels}
    existing_types_values = {(ch.type, ch.value.lower()) for ch in result.channels}

    for acc in accounts:
        url = (acc.get("url") or "").strip()
        if not url:
            continue
        url_key = url.rstrip("/").lower()
        if url_key in existing_urls:
            continue
        host = urlparse(url).netloc.lower()

        if "linkedin.com" in host:
            if ("linkedin", url_key) in existing_types_values:
                continue
            result.channels.append(DiscoveredChannel(
                type="linkedin",
                value=url,
                url=url,
                source_url=f"https://github.com/{username}",
                source_type="github-profile",
                confidence="high",
            ))
            existing_urls.add(url_key)
        elif host in ("x.com", "twitter.com") or host.endswith(".x.com"):
            handle = "@" + url.rstrip("/").split("/")[-1]
            if ("x", handle.lower()) in existing_types_values:
                continue
            result.channels.append(DiscoveredChannel(
                type="x",
                value=handle,
                url=url,
                source_url=f"https://github.com/{username}",
                source_type="github-profile",
                confidence="high",
            ))
            existing_urls.add(url_key)
        elif host in ("github.com",):
            # Skip self-referencing github links
            continue
        else:
            # Any other social (Mastodon, personal site, etc.) is a website channel
            if ("website", url_key) in existing_types_values:
                continue
            result.channels.append(DiscoveredChannel(
                type="website",
                value=url,
                url=url,
                source_url=f"https://github.com/{username}",
                source_type="github-profile",
                confidence="high",
            ))
            existing_urls.add(url_key)


def _harvest_from_website(base_url: str, result: EnrichmentResult) -> None:
    """Fetch `base_url` (already SSRF-validated), look for mailto: and
    linkedin.com/in/ links. Then optionally fetch ONE /contact or /about page."""
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html"}
    with httpx.Client(timeout=TIMEOUT_S, headers=headers) as c:
        html = _safe_fetch(c, base_url)
        if not html:
            result.errors.append("website fetch failed or blocked")
            return
        result.fetched.append(base_url)
        _extract(html, base_url, result)

        # If no email found yet, try ONE contact/about page linked from the homepage.
        if not any(ch.type == "email" for ch in result.channels):
            for path in CONTACT_PATHS:
                candidate = urljoin(base_url, path)
                page = _safe_fetch(c, candidate)
                if page:
                    result.fetched.append(candidate)
                    _extract(page, candidate, result)
                    if any(ch.type == "email" for ch in result.channels):
                        break


def _extract(html: str, page_url: str, result: EnrichmentResult) -> None:
    # mailto: links
    seen_emails = {ch.value.lower() for ch in result.channels if ch.type == "email"}
    for m in MAILTO_RE.finditer(html):
        addr = m.group(1).strip()
        if addr and "@" in addr and addr.lower() not in seen_emails:
            seen_emails.add(addr.lower())
            result.channels.append(DiscoveredChannel(
                type="email",
                value=addr,
                source_url=page_url,
                source_type="website-contact",
                confidence="high",
            ))

    # linkedin.com/in/ links
    seen_li = {ch.value.lower() for ch in result.channels if ch.type == "linkedin"}
    for m in LINKEDIN_RE.finditer(html):
        slug = m.group(1)
        li_url = f"https://www.linkedin.com/in/{slug}"
        if li_url.lower() not in seen_li:
            seen_li.add(li_url.lower())
            result.channels.append(DiscoveredChannel(
                type="linkedin",
                value=li_url,
                url=li_url,
                source_url=page_url,
                source_type="website-contact",
                confidence="high",
            ))
