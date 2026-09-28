"""
Unit tests for email_service security functions.
Run: cd /app/backend && python -m pytest tests/test_email_security.py -v
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from email_service import _safe_header, _safe_html, _safe_email


class TestSafeHeader:
    def test_strips_crlf(self):
        # \r\n is 2 chars → 2 spaces. The important thing is no control chars remain.
        result = _safe_header("Subject\r\nBcc: attacker@evil.com")
        assert "\r" not in result
        assert "\n" not in result
        assert "Subject" in result
        assert "Bcc: attacker@evil.com" in result

    def test_strips_lf_only(self):
        assert _safe_header("Hello\nWorld") == "Hello World"

    def test_strips_null_byte(self):
        assert _safe_header("Hi\x00there") == "Hi there"

    def test_truncates_long_input(self):
        long = "a" * 500
        result = _safe_header(long, max_len=100)
        assert len(result) == 100

    def test_empty_input(self):
        assert _safe_header("") == ""
        assert _safe_header(None) == ""

    def test_normal_text_unchanged(self):
        assert _safe_header("Hello World") == "Hello World"

    def test_unicode_preserved(self):
        assert _safe_header("Здравейте 🌍") == "Здравейте 🌍"


class TestSafeHtml:
    def test_escapes_script_tag(self):
        result = _safe_html("<script>alert(1)</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_escapes_img_onerror(self):
        result = _safe_html('<img src=x onerror=alert(1)>')
        assert "onerror" in result  # escaped, not removed
        assert "<img" not in result
        assert "&lt;img" in result

    def test_escapes_quotes(self):
        result = _safe_html('"><script>')
        assert '"' not in result
        assert "&quot;" in result

    def test_empty_input(self):
        assert _safe_html("") == ""
        assert _safe_html(None) == ""

    def test_normal_text(self):
        assert _safe_html("Купи мляко") == "Купи мляко"


class TestSafeEmail:
    def test_valid_email(self):
        assert _safe_email("user@example.com") == "user@example.com"

    def test_invalid_no_at(self):
        assert _safe_email("not-an-email") == ""

    def test_invalid_no_domain(self):
        assert _safe_email("user@") == ""

    def test_strips_crlf(self):
        # If someone tries to inject headers via email field
        result = _safe_email("user@example.com\r\nBcc: attacker@evil.com")
        # Should fail validation because of resulting shape
        assert result == "" or "\r" not in result and "\n" not in result

    def test_empty(self):
        assert _safe_email("") == ""
        assert _safe_email(None) == ""

    def test_truncates_excessive_length(self):
        long = "a" * 300 + "@example.com"
        result = _safe_email(long)
        assert len(result) <= 254


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main([__file__, "-v"]))
