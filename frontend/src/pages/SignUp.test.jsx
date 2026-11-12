import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SignUp from "./SignUp";
import { AuthAPI } from "../api.js";

// No real Firebase in tests
jest.mock("../api.js", () => ({ AuthAPI: { signUp: jest.fn() } }));
jest.mock("aos", () => ({ init: jest.fn() }));

// HM2 test 3: passwords that do not match show an error and no account is created
test("shows an error when the passwords do not match", async () => {
  render(
    <MemoryRouter>
      <SignUp />
    </MemoryRouter>,
  );

  await userEvent.type(screen.getByPlaceholderText("Username"), "testuser");
  await userEvent.type(screen.getByPlaceholderText("Email"), "test@example.com");
  // Fake test values, not real passwords
  await userEvent.type(screen.getByPlaceholderText("Password"), "abc12345"); // ggignore
  await userEvent.type(screen.getByPlaceholderText("Retype Password"), "abc99999"); // ggignore
  await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  expect(AuthAPI.signUp).not.toHaveBeenCalled();
});
