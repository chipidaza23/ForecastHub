import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUsePathname = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import Sidebar from "@/components/Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders all 5 nav items", () => {
    render(<Sidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Inventory").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Alerts").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("AI Advisor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Upload Data").length).toBeGreaterThanOrEqual(1);
  });

  it("highlights active link based on pathname", () => {
    mockUsePathname.mockReturnValue("/inventory");
    const { container } = render(<Sidebar />);
    const activeLinks = container.querySelectorAll(".bg-indigo-50");
    expect(activeLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("shows ForecastHub branding", () => {
    render(<Sidebar />);
    expect(screen.getAllByText("ForecastHub").length).toBeGreaterThanOrEqual(1);
  });

  it("shows version in footer", () => {
    render(<Sidebar />);
    expect(screen.getAllByText(/v0\.1\.0/).length).toBeGreaterThanOrEqual(1);
  });
});
