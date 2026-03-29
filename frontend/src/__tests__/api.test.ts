/**
 * Tests for the API client (src/lib/api.ts).
 */

import { api } from "@/lib/api";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api.health", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok", data_loaded: true }),
    });
    const result = await api.health();
    expect(result).toEqual({ status: "ok", data_loaded: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    await expect(api.health()).rejects.toThrow("API 500");
  });

  it("throws on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.health()).rejects.toThrow("backend running");
  });
});

describe("api.getKpis", () => {
  it("returns KPI data", async () => {
    const kpis = {
      total_skus: 8,
      skus_below_rop: 2,
      avg_forecast_accuracy: 92.3,
      total_inventory_value: 45000,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(kpis),
    });
    const result = await api.getKpis();
    expect(result.total_skus).toBe(8);
    expect(result.avg_forecast_accuracy).toBe(92.3);
  });
});

describe("api.getInventory", () => {
  it("passes lead_time and service_level params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ inventory: [], alerts: [], total_skus: 0, skus_below_rop: 0 }),
    });
    await api.getInventory(14, 0.99);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("lead_time=14");
    expect(url).toContain("service_level=0.99");
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=0");
  });

  it("passes custom pagination params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ inventory: [], alerts: [], total_skus: 0, skus_below_rop: 0 }),
    });
    await api.getInventory(7, 0.95, 25, 50);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=25");
    expect(url).toContain("offset=50");
  });
});

describe("api.ask", () => {
  it("sends POST with question body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ answer: "Reorder SKU-A001", model: "llama", tokens_used: 100 }),
    });
    const result = await api.ask("What should I reorder?");
    expect(result.answer).toBe("Reorder SKU-A001");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ question: "What should I reorder?" });
  });
});

describe("api.uploadFile", () => {
  it("sends FormData with the file", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          message: "File uploaded",
          rows: 100,
          skus: ["SKU-1"],
          date_range: { start: "2024-01-01", end: "2024-03-31" },
        }),
    });
    const file = new File(["csv data"], "test.csv", { type: "text/csv" });
    const result = await api.uploadFile(file);
    expect(result.rows).toBe(100);
    expect(result.skus).toContain("SKU-1");
  });
});
