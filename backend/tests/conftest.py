"""Feature tests isolate feature behavior; test_auth exercises real authentication."""
import pytest
from app import auth


@pytest.fixture(autouse=True)
def isolate_feature_tests_from_login(request, monkeypatch):
    if request.node.path.name != "test_auth.py":
        monkeypatch.setattr(auth, "authorize", lambda request, store: None)
