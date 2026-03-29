import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { api } from "@/lib/api";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <>{children}</>,
}));

jest.mock("@/lib/api", () => ({
  api: {
    ask: jest.fn(),
  },
}));

import AskAI from "@/components/AskAI";

const mockAsk = api.ask as jest.Mock;

describe("AskAI", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    mockAsk.mockReset();
    // jsdom doesn't implement scrollTo
    Element.prototype.scrollTo = jest.fn();
  });

  it("shows 3 suggestion chips initially", () => {
    render(<AskAI />);
    expect(screen.getByText(/Which SKUs are most at risk/)).toBeInTheDocument();
    expect(screen.getByText(/What should I reorder today/)).toBeInTheDocument();
    expect(screen.getByText(/How can I reduce/)).toBeInTheDocument();
  });

  it("clicking a suggestion chip sends the question and shows response", async () => {
    mockAsk.mockResolvedValueOnce({
      answer: "You should reorder SKU-A001.",
      model: "llama-3.3-70b",
      tokens_used: 150,
    });

    render(<AskAI />);

    const chip = screen.getByText(/What should I reorder today/);
    fireEvent.click(chip);

    expect(mockAsk).toHaveBeenCalledWith("What should I reorder today and how much?");

    await waitFor(() => {
      expect(screen.getByText("You should reorder SKU-A001.")).toBeInTheDocument();
    });
  });

  it("hides suggestion chips after first message", async () => {
    mockAsk.mockResolvedValueOnce({
      answer: "Here are some suggestions.",
      model: "llama-3.3-70b",
      tokens_used: 100,
    });

    render(<AskAI />);

    const chip = screen.getByText(/Which SKUs are most at risk/);
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText("Here are some suggestions.")).toBeInTheDocument();
    });

    expect(screen.queryByText(/What should I reorder today/)).not.toBeInTheDocument();
  });

  it("submits question via input and Enter key", async () => {
    mockAsk.mockResolvedValueOnce({
      answer: "The answer is 42.",
      model: "llama-3.3-70b",
      tokens_used: 50,
    });

    render(<AskAI />);

    const input = screen.getByPlaceholderText(/Ask anything about your inventory/);
    fireEvent.change(input, { target: { value: "Test question" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockAsk).toHaveBeenCalledWith("Test question");

    await waitFor(() => {
      expect(screen.getByText("The answer is 42.")).toBeInTheDocument();
    });
  });

  it("shows error message on API failure", async () => {
    mockAsk.mockRejectedValueOnce(new Error("Service unavailable"));

    render(<AskAI />);

    const input = screen.getByPlaceholderText(/Ask anything about your inventory/);
    fireEvent.change(input, { target: { value: "Will this fail?" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Service unavailable")).toBeInTheDocument();
    });
  });

  it("clear button appears after messages and resets conversation", async () => {
    mockAsk.mockResolvedValueOnce({
      answer: "Response text here.",
      model: "llama-3.3-70b",
      tokens_used: 80,
    });

    render(<AskAI />);

    // Initially no clear button
    expect(screen.queryByTitle("Clear conversation")).not.toBeInTheDocument();

    const chip = screen.getByText(/How can I reduce/);
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getByText("Response text here.")).toBeInTheDocument();
    });

    // Clear button should now appear
    const clearBtn = screen.getByTitle("Clear conversation");
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    // Suggestion chips should reappear
    await waitFor(() => {
      expect(screen.getByText(/Which SKUs are most at risk/)).toBeInTheDocument();
    });
  });

  it("send button is disabled when input is empty", () => {
    render(<AskAI />);
    const buttons = screen.getAllByRole("button");
    const sendBtn = buttons.find(
      (b) => !b.textContent?.includes("SKU") && !b.textContent?.includes("reorder") && !b.textContent?.includes("reduce")
    );
    expect(sendBtn).toBeDisabled();
  });
});
