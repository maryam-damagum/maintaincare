import { describe, it, expect } from "vitest";
import request from "supertest";

const app = require("../server");

describe("API Health Check", () => {
  it("should return a healthy response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "Backend is healthy.",
    });
  });
});

describe("Database Health Check", () => {
  it("should confirm a successful database connection", async () => {
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "Database connection successful.",
    });
  });
});