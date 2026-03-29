import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { api } from "@/lib/api";
import KPICards from "@/components/KPICards";

jest.mock("@/lib/api", () => ({
  api: {
    getKpis: jest.fn(),
  },
}));

const mockGetKpis = api.getKpis as jest.Mock;

describe("KPICards", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    mockGetKpis.mockReset();
  });

  it("shows 4 skeleton loaders while loading", () => {
    mockGetKpis.mockReturnValue(new Promise(() => {}));
    const { container } = render(<KPICards />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(4);
  });

  it("renders KPI values on success", async () => {
    mockGetKpis.mockResolvedValueOnce({
      total_skus: 8,
      skus_below_rop: 2,
      avg_forecast_accuracy: 92.3,
      total_inventory_value: 45000,
    });

    render(<KPICards />);

    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument();
    });
    expect(screen.getByText("Total SKUs")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Reorder Alerts")).toBeInTheDocument();
    expect(screen.getByText("92.3%")).toBeInTheDocument();
    expect(screen.getByText("Forecast Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Inventory Value")).toBeInTheDocument();
    expect(screen.getByText("$45,000")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    mockGetKpis.mockRejectedValueOnce(new Error("Network error"));

    render(<KPICards />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load KPIs/)).toBeInTheDocument();
    });
  });

  it("shows em-dash when forecast accuracy is null", async () => {
    mockGetKpis.mockResolvedValueOnce({
      total_skus: 5,
      skus_below_rop: 0,
      avg_forecast_accuracy: null,
      total_inventory_value: 10000,
    });

    render(<KPICards />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });
});
