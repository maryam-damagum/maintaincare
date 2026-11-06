
import { describe, it, expect } from "vitest";
import request from "supertest";

const app = require("../server");

describe("Authentication and Access Control", () => {
  it("should prevent unauthenticated users from accessing maintenance requests", async () => {
    const response = await request(app).get("/api/requests");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Please log in to continue.");
  });

  it("should reject login with incorrect credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "student@example.com",
        password: "WrongPassword123!",
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password.");
  });

  it("should successfully log in with correct credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "student@example.com",
        password: "LocalTest#2026",
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login successful.");
    expect(response.body.user.email).toBe("student@example.com");
    expect(response.body.user.role).toBe("STUDENT");
  });

  it("should maintain an authenticated session after login", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: "student@example.com",
      password: "LocalTest#2026",
    });

    const response = await agent.get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("student@example.com");
  });

  it("should log out the user and destroy the authenticated session", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: "student@example.com",
      password: "LocalTest#2026",
    });

    const logoutResponse = await agent.post("/api/auth/logout");

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe("Logout successful.");

    const protectedResponse = await agent.get("/api/requests");

    expect(protectedResponse.status).toBe(401);
  });

  it("should prevent students from accessing administrator-only endpoints", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: "student@example.com",
      password: "LocalTest#2026",
    });

    const response = await agent.get("/api/requests/officers");

    expect(response.status).toBe(403);
  });

  it("should prevent students from accessing maintenance officer tasks", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: "student@example.com",
      password: "LocalTest#2026",
    });

    const response = await agent.get("/api/requests/assigned");

    expect(response.status).toBe(403);
  });

  it("should allow administrators to access officer management", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: "admin@example.com",
      password: "LocalTest#2026",
    });

    const response = await agent.get("/api/requests/officers");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.officers)).toBe(true);
  });

  it("should reject registration with an invalid email address", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test User",
        email: "invalid-email",
        password: "StrongPassword123!",
      });

    expect(response.status).toBe(400);
  });

  it("should reject registration when required fields are missing", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: "newuser@example.com",
        password: "StrongPassword123!",
      });

    expect(response.status).toBe(400);
  });
});
