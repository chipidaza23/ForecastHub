import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { api } from "@/lib/api";
import AlertPanel from "@/components/AlertPanel";

jest.mock("@/lib/api", () => ({
  api: {
    getInventory: jest.fn(),
  },
}));

const mockGetInventory = api.getInventory as jest.Mock;

const mockAlerts = [
  {
    sku: "SKU-A001",
    avg_daily_demand: 85,
    std_daily_demand: 12,
    safety_stock: 52.4,
    reorder_point: 647.4,
    eoq: 1250.3,
    inventory_on_hand: 500,
    below_reorder_point: true,
    days_of_stock: 5.9,
    unit_price: 89.99,
  },
  {
    sku: "SKU-C005",
    avg_daily_demand: 55,
    std_daily_demand: 9,
    safety_stock: 39.3,
    reorder_point: 424.3,
    eoq: 870.1,
    inventory_on_hand: 300,
    below_reorder_point: true,
    days_of_stock: 5.5,
    unit_price: 59.99,
  },
];

describe("AlertPanel", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    mockGetInventory.mockReset();
  });

  it("shows skeleton loading", () => {
    mockGetInventory.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AlertPanel />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(2);
  });

  it("renders alert items with details", async () => {
    mockGetInventory.mockResolvedValueOnce({
      inventory: [],
      alerts: mockAlerts,
      total_skus: 8,
      skus_below_rop: 2,
    });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText("SKU-A001")).toBeInTheDocument();
    });
    expect(screen.getByText("SKU-C005")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // count badge
  });

  it("shows empty state when no alerts", async () => {
    mockGetInventory.mockResolvedValueOnce({
      inventory: [],
      alerts: [],
      total_skus: 5,
      skus_below_rop: 0,
    });

    render(<AlertPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("All SKUs are above their reorder points.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("0")).toBeInTheDocument(); // count badge
  });

  it("shows error state on API failure", async () => {
    mockGetInventory.mockRejectedValueOnce(new Error("Network error"));

    render(<AlertPanel />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows helpful error for fetch failures", async () => {
    mockGetInventory.mockRejectedValueOnce(
      new Error("Failed to fetch — is the backend running?")
    );

    render(<AlertPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch — is the backend running?")
      ).toBeInTheDocument();
    });
  });
});
