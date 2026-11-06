
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "./Login";

describe("MaintainCare Login Page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should display the login form correctly", () => {
    render(<Login onLogin={vi.fn()} />);

    expect(screen.getByText("MaintainCare")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("should allow users to enter their email and password", () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "LocalTest#2026" },
    });

    expect(screen.getByLabelText(/email address/i)).toHaveValue("student@example.com");
    expect(screen.getByLabelText(/password/i)).toHaveValue("LocalTest#2026");
  });

  it("should successfully log in and call onLogin with the user data", async () => {
    const mockUser = {
      id: "user-123",
      email: "student@example.com",
      role: "STUDENT",
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser }),
    });

    const onLogin = vi.fn();

    render(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "LocalTest#2026" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(mockUser);
    });
  });

  it("should display an error when login credentials are incorrect", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        message: "Invalid email or password.",
      }),
    });

    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "WrongPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password."
    );
  });

  it("should display a connection error when the server cannot be reached", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "student@example.com" },
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "LocalTest#2026" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect to the server. Please try again."
    );
  });
});
