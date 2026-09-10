"""Phase 2.1: social_accounts harvesting (mock-based, no network)."""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch
from app import enrichment


def _fake_client_factory(json_by_url):
    class FakeResponse:
        def __init__(self, payload):
            self.status_code = 200
            self._payload = payload
        def json(self):
            return self._payload
        def __enter__(self): return self
        def __exit__(self, *a): return False

    class FakeClient:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, url, **kwargs):
            return FakeResponse(json_by_url.get(url, []))

    return FakeClient


def test_social_accounts_linkedin_and_x_are_harvested():
    result = enrichment.EnrichmentResult()
    fake = {
        "https://api.github.com/users/alice/social_accounts": [
            {"url": "https://www.linkedin.com/in/alice-dev"},
            {"url": "https://x.com/alice"},
            {"url": "https://alice.dev"},
        ],
    }
    # Patch BOTH the SSRF validator (real DNS) and httpx.Client (real HTTP)
    with patch("app.enrichment.validate_public_http_url", lambda u: u), \
         patch("app.enrichment.httpx.Client", _fake_client_factory(fake)):
        enrichment._harvest_social_accounts("alice", result)

    types = [c.type for c in result.channels]
    assert "linkedin" in types
    assert "x" in types
    assert "website" in types


def test_social_accounts_dedupe_against_existing():
    result = enrichment.EnrichmentResult()
    result.channels.append(enrichment.DiscoveredChannel(
        type="linkedin", value="https://www.linkedin.com/in/alice-dev",
        url="https://www.linkedin.com/in/alice-dev",
        source_type="website-contact", confidence="high",
    ))
    fake = {
        "https://api.github.com/users/alice/social_accounts": [
            {"url": "https://www.linkedin.com/in/alice-dev/"},
        ],
    }
    with patch("app.enrichment.validate_public_http_url", lambda u: u), \
         patch("app.enrichment.httpx.Client", _fake_client_factory(fake)):
        enrichment._harvest_social_accounts("alice", result)

    linkedin = [c for c in result.channels if c.type == "linkedin"]
    assert len(linkedin) == 1
