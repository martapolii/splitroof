import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";
import { AuthAPI } from "../api.js";

jest.mock("../api.js", () => ({
  AuthAPI: {
    login: jest.fn(),
  },
}));
jest.mock("aos", () => ({ init: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("Login page (HM1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("submits credentials and redirects to /dashboard on success", async () => {
    AuthAPI.login.mockResolvedValue({ user: { uid: "u1", email: "user@example.com" } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "user@example.com");
    // Fake test value, not a real password
    await userEvent.type(screen.getByPlaceholderText("Password"), "pass1234"); // ggignore
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(AuthAPI.login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "pass1234",
    });
    expect(await screen.findByText(/Login successful/i)).toBeInTheDocument();

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      },
      { timeout: 2000 }
    );
  });

  test("shows an error message when login fails", async () => {
    AuthAPI.login.mockRejectedValue(new Error("Email or password is incorrect."));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "wrong@example.com");
    // Fake test value, not a real password
    await userEvent.type(screen.getByPlaceholderText("Password"), "badpass1"); // ggignore
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});