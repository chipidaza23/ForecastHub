import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { api } from "@/lib/api";
import InventoryTable from "@/components/InventoryTable";

jest.mock("@/lib/api", () => ({
  api: {
    getInventory: jest.fn(),
  },
}));

const mockGetInventory = api.getInventory as jest.Mock;

const mockInventoryResponse = {
  inventory: [
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
      sku: "SKU-B002",
      avg_daily_demand: 62,
      std_daily_demand: 8,
      safety_stock: 34.9,
      reorder_point: 468.9,
      eoq: 980.5,
      inventory_on_hand: 2000,
      below_reorder_point: false,
      days_of_stock: 32.3,
      unit_price: 64.99,
    },
  ],
  alerts: [],
  total_skus: 2,
  skus_below_rop: 1,
};

describe("InventoryTable", () => {
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

  it("shows skeleton rows while loading", () => {
    mockGetInventory.mockReturnValue(new Promise(() => {}));
    const { container } = render(<InventoryTable />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });

  it("renders inventory rows with SKU names", async () => {
    mockGetInventory.mockResolvedValueOnce(mockInventoryResponse);

    render(<InventoryTable />);

    await waitFor(() => {
      expect(screen.getByText("SKU-A001")).toBeInTheDocument();
    });
    expect(screen.getByText("SKU-B002")).toBeInTheDocument();
    expect(screen.getByText("Reorder")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("filters by search term", async () => {
    mockGetInventory.mockResolvedValueOnce(mockInventoryResponse);

    render(<InventoryTable />);

    await waitFor(() => {
      expect(screen.getByText("SKU-A001")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter SKUs/);
    fireEvent.change(searchInput, { target: { value: "B002" } });

    expect(screen.queryByText("SKU-A001")).not.toBeInTheDocument();
    expect(screen.getByText("SKU-B002")).toBeInTheDocument();
  });

  it("sorts by column when header clicked", async () => {
    mockGetInventory.mockResolvedValueOnce(mockInventoryResponse);

    render(<InventoryTable />);

    await waitFor(() => {
      expect(screen.getByText("SKU-A001")).toBeInTheDocument();
    });

    const onHandHeader = screen.getByText("On Hand");
    fireEvent.click(onHandHeader);

    // After sort, rows should still be visible (just reordered)
    expect(screen.getByText("SKU-A001")).toBeInTheDocument();
    expect(screen.getByText("SKU-B002")).toBeInTheDocument();
  });

  it("shows empty state when no inventory data", async () => {
    mockGetInventory.mockResolvedValueOnce({
      inventory: [],
      alerts: [],
      total_skus: 0,
      skus_below_rop: 0,
    });

    render(<InventoryTable />);

    await waitFor(() => {
      expect(screen.getByText("No inventory data")).toBeInTheDocument();
    });
  });

  it("shows filter empty state when no SKUs match", async () => {
    mockGetInventory.mockResolvedValueOnce(mockInventoryResponse);

    render(<InventoryTable />);

    await waitFor(() => {
      expect(screen.getByText("SKU-A001")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Filter SKUs/);
    fireEvent.change(searchInput, { target: { value: "NONEXISTENT" } });

    expect(screen.getByText("No SKUs match your filter")).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    mockGetInventory.mockRejectedValueOnce(new Error("Server error"));

    render(<InventoryTable />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });
});
