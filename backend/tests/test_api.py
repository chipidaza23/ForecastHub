"""Tests for main.py — FastAPI endpoint integration tests."""

import io
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend modules are importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Mock Supabase before importing main (so lifespan doesn't try to connect)
_mock_supabase = MagicMock()
with patch("db.get_admin_client", return_value=_mock_supabase):
    with patch("data_loader.load_from_supabase", return_value=None):
        with patch("data_loader.save_to_supabase", return_value={"rows_inserted": 0, "rows_failed": 0}):
            from fastapi.testclient import TestClient  # noqa: E402

            from data_loader import generate_sample_data  # noqa: E402
            from main import _store, app  # noqa: E402

# Pre-load sample data so endpoints that call _require_data() work
_store["df"] = generate_sample_data(n_skus=3, days=60, seed=42)

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200(self):
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["data_loaded"] is True


class TestKPIsEndpoint:
    def test_kpis_returns_expected_shape(self):
        res = client.get("/api/kpis")
        assert res.status_code == 200
        data = res.json()
        assert "total_skus" in data
        assert "skus_below_rop" in data
        assert "avg_forecast_accuracy" in data
        assert "total_inventory_value" in data
        assert data["total_skus"] == 3


class TestInventoryEndpoint:
    def test_inventory_returns_expected_shape(self):
        res = client.get("/api/inventory")
        assert res.status_code == 200
        data = res.json()
        assert "inventory" in data
        assert "alerts" in data
        assert isinstance(data["inventory"], list)
        assert len(data["inventory"]) == 3

    def test_inventory_with_custom_params(self):
        res = client.get("/api/inventory?lead_time=14&service_level=0.99")
        assert res.status_code == 200

    def test_inventory_pagination(self):
        res = client.get("/api/inventory?limit=2&offset=0")
        assert res.status_code == 200
        data = res.json()
        assert len(data["inventory"]) == 2
        assert data["total_skus"] == 3

    def test_inventory_pagination_offset(self):
        res = client.get("/api/inventory?limit=2&offset=2")
        assert res.status_code == 200
        data = res.json()
        assert len(data["inventory"]) == 1
        assert data["total_skus"] == 3


class TestForecastEndpoints:
    def test_forecast_single_sku(self):
        inv = client.get("/api/inventory").json()
        sku = inv["inventory"][0]["sku"]
        res = client.get(f"/api/forecast/{sku}")
        assert res.status_code == 200
        data = res.json()
        assert data["sku"] == sku
        assert "forecast" in data
        assert len(data["forecast"]) == 14  # default horizon

    def test_forecast_unknown_sku_returns_404(self):
        res = client.get("/api/forecast/NONEXISTENT-SKU-999")
        assert res.status_code == 404

    def test_forecast_all_returns_forecasts(self):
        res = client.get("/api/forecast/all")
        assert res.status_code == 200
        data = res.json()
        assert "forecasts" in data
        assert "total" in data
        assert isinstance(data["forecasts"], list)
        assert len(data["forecasts"]) == 3
        assert data["total"] == 3

    def test_forecast_all_pagination(self):
        res = client.get("/api/forecast/all?limit=1&offset=0")
        assert res.status_code == 200
        data = res.json()
        assert len(data["forecasts"]) == 1
        assert data["total"] == 3


class TestHistoryEndpoint:
    def test_history_returns_data(self):
        inv = client.get("/api/inventory").json()
        sku = inv["inventory"][0]["sku"]
        res = client.get(f"/api/history/{sku}?days=7")
        assert res.status_code == 200
        data = res.json()
        assert data["sku"] == sku
        assert "history" in data
        assert len(data["history"]) <= 7

    def test_history_unknown_sku_returns_404(self):
        res = client.get("/api/history/NONEXISTENT-SKU-999")
        assert res.status_code == 404


class TestUploadEndpoint:
    def test_upload_csv(self):
        csv = (
            b"date,sku,quantity_sold,price,inventory_on_hand\n"
            b"2024-01-01,TEST-1,10,25.0,100\n"
            b"2024-01-02,TEST-1,15,25.0,85"
        )
        with patch("db.record_upload"):
            with patch("data_loader.save_to_supabase", return_value={"rows_inserted": 2, "rows_failed": 0}):
                res = client.post(
                    "/api/upload",
                    files={"file": ("test.csv", io.BytesIO(csv), "text/csv")},
                )
        assert res.status_code == 200
        data = res.json()
        assert data["rows"] == 2
        assert "TEST-1" in data["skus"]

    def test_upload_invalid_format(self):
        res = client.post(
            "/api/upload",
            files={"file": ("test.txt", io.BytesIO(b"bad data"), "text/plain")},
        )
        assert res.status_code == 422


class TestAskEndpoint:
    def test_ask_without_groq_key_returns_503(self):
        with patch("ai_advisor.ask", side_effect=EnvironmentError("GROQ_API_KEY not set")):
            res = client.post("/api/ask", json={"question": "What should I reorder?"})
        assert res.status_code == 503

    def test_ask_with_mocked_groq(self):
        mock_response = {
            "answer": "You should reorder SKU-A001.",
            "model": "llama-3.3-70b-versatile",
            "tokens_used": 150,
        }
        with patch("ai_advisor.ask", return_value=mock_response):
            res = client.post("/api/ask", json={"question": "What should I reorder?"})
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert data["answer"] == "You should reorder SKU-A001."
