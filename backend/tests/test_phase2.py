"""Phase 2 tests: SSRF guard + enrichment logic (no real network calls)."""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.ssrf import validate_public_http_url, SSRFError
from app import enrichment


def test_ssrf_blocks_localhost():
    with pytest.raises(SSRFError):
        validate_public_http_url("http://localhost/admin")


def test_ssrf_blocks_private_ip():
    with pytest.raises(SSRFError):
        validate_public_http_url("http://192.168.1.1/")


def test_ssrf_blocks_metadata_endpoint():
    with pytest.raises(SSRFError):
        validate_public_http_url("http://169.254.169.254/latest/meta-data/")


def test_ssrf_blocks_non_http_scheme():
    with pytest.raises(SSRFError):
        validate_public_http_url("file:///etc/passwd")
    with pytest.raises(SSRFError):
        validate_public_http_url("gopher://evil")


def test_ssrf_blocks_loopback_via_dns_name():
    with pytest.raises(SSRFError):
        validate_public_http_url("http://127.0.0.1:8080/")


def test_email_extraction_only_from_mailto():
    """Only `mailto:` hrefs on the page should produce email channels."""
    html = '''
      <a href="mailto:alex@example.com">Email</a>
      <p>Contact me at guessed@example.com (plain text, not a mailto link)</p>
    '''
    result = enrichment.EnrichmentResult()
    enrichment._extract(html, "https://alex.dev/", result)
    emails = [c for c in result.channels if c.type == "email"]
    assert len(emails) == 1
    assert emails[0].value == "alex@example.com"
    assert emails[0].source_url == "https://alex.dev/"


def test_linkedin_extraction():
    html = '<a href="https://www.linkedin.com/in/alex-dev">LinkedIn</a>'
    result = enrichment.EnrichmentResult()
    enrichment._extract(html, "https://alex.dev/", result)
    li = [c for c in result.channels if c.type == "linkedin"]
    assert len(li) == 1
    assert "linkedin.com/in/alex-dev" in li[0].value


def test_no_guessing_when_no_mailto():
    """If no mailto: link is present, no email channel is created."""
    html = '<p>alex [at] example [dot] com</p>'
    result = enrichment.EnrichmentResult()
    enrichment._extract(html, "https://alex.dev/", result)
    emails = [c for c in result.channels if c.type == "email"]
    assert len(emails) == 0


def test_safe_fetch_blocks_localhost():
    """_safe_fetch must refuse to fetch localhost URLs even if called directly."""
    import httpx
    with httpx.Client() as client:
        assert enrichment._safe_fetch(client, "http://localhost/") is None
        assert enrichment._safe_fetch(client, "http://169.254.169.254/") is None
