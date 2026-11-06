
import { describe, it, expect } from "vitest";
import request from "supertest";

const app = require("../server");

describe("Maintenance Request Management", () => {
  it("should reject maintenance request submission without authentication", async () => {
    const response = await request(app)
      .post("/api/requests")
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "Please log in to continue."
    );
  });

  it("should reject a maintenance request with missing required fields", async () => {
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({
      email: "student@example.com",
      password: "LocalTest#2026",
    });

    const response = await agent
      .post("/api/requests")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Please check the information you entered."
    );
  });

  it("should successfully submit a maintenance request and record its initial status history", async () => {
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/api/auth/login")
      .send({
        email: "student@example.com",
        password: "LocalTest#2026",
      });

    expect(loginResponse.status).toBe(200);

    const categoriesResponse = await agent.get(
      "/api/requests/categories"
    );

    expect(categoriesResponse.status).toBe(200);
    expect(categoriesResponse.body.categories.length).toBeGreaterThan(0);

    const categoryId =
      categoriesResponse.body.categories[0].id;

    const submissionResponse = await agent
      .post("/api/requests")
      .send({
        title: "Automated test maintenance request",
        description:
          "This request was created to test the maintenance submission process.",
        location: "Main Library, Ground Floor",
        priority: "MEDIUM",
        categoryId,
      });

    expect(submissionResponse.status).toBe(201);
    expect(submissionResponse.body.message).toBe(
      "Maintenance request submitted successfully."
    );

    expect(submissionResponse.body.request).toMatchObject({
      title: "Automated test maintenance request",
      description:
        "This request was created to test the maintenance submission process.",
      location: "Main Library, Ground Floor",
      priority: "MEDIUM",
      currentStatus: "SUBMITTED",
    });

    const requestId = submissionResponse.body.request.id;

    expect(requestId).toBeDefined();

    const historyResponse = await agent.get(
      `/api/requests/${requestId}/history`
    );

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.history).toHaveLength(1);

    expect(historyResponse.body.history[0]).toMatchObject({
      requestId,
      previousStatus: null,
      newStatus: "SUBMITTED",
      note: "Maintenance request submitted.",
    });
  });

  it("should restrict students to their own requests while administrators can view all requests", async () => {
    const staffAgent = request.agent(app);

    const staffLogin = await staffAgent
      .post("/api/auth/login")
      .send({
        email: "staff@example.com",
        password: "LocalTest#2026",
      });

    expect(staffLogin.status).toBe(200);

    const categoriesResponse = await staffAgent.get(
      "/api/requests/categories"
    );

    expect(categoriesResponse.status).toBe(200);

    const categoryId =
      categoriesResponse.body.categories[0].id;

    const staffSubmission = await staffAgent
      .post("/api/requests")
      .send({
        title: "Staff account visibility test",
        description:
          "This request checks whether role-based request visibility works correctly.",
        location: "Administrative Building",
        priority: "LOW",
        categoryId,
      });

    expect(staffSubmission.status).toBe(201);

    const staffRequestId = staffSubmission.body.request.id;

    const studentAgent = request.agent(app);

    const studentLogin = await studentAgent
      .post("/api/auth/login")
      .send({
        email: "student@example.com",
        password: "LocalTest#2026",
      });

    expect(studentLogin.status).toBe(200);

    const studentRequests = await studentAgent.get(
      "/api/requests"
    );

    expect(studentRequests.status).toBe(200);

    const studentRequestIds =
      studentRequests.body.requests.map((item) => item.id);

    expect(studentRequestIds).not.toContain(staffRequestId);

    const adminAgent = request.agent(app);

    const adminLogin = await adminAgent
      .post("/api/auth/login")
      .send({
        email: "admin@example.com",
        password: "LocalTest#2026",
      });

    expect(adminLogin.status).toBe(200);

    const adminRequests = await adminAgent.get(
      "/api/requests"
    );

    expect(adminRequests.status).toBe(200);

    const adminRequestIds =
      adminRequests.body.requests.map((item) => item.id);

    expect(adminRequestIds).toContain(staffRequestId);
  });

  it("should allow an administrator to assign a request and an officer to complete it with full status history", async () => {
    // 1. Log in as a student and submit a new request.
    const studentAgent = request.agent(app);

    const studentLogin = await studentAgent
      .post("/api/auth/login")
      .send({
        email: "student@example.com",
        password: "LocalTest#2026",
      });

    expect(studentLogin.status).toBe(200);

    const categoriesResponse = await studentAgent.get(
      "/api/requests/categories"
    );

    expect(categoriesResponse.status).toBe(200);

    const categoryId =
      categoriesResponse.body.categories[0].id;

    const submissionResponse = await studentAgent
      .post("/api/requests")
      .send({
        title: "Automated officer workflow test",
        description:
          "This request tests assignment and maintenance officer status updates.",
        location: "Main Library, First Floor",
        priority: "HIGH",
        categoryId,
      });

    expect(submissionResponse.status).toBe(201);

    const requestId = submissionResponse.body.request.id;

    // 2. Log in as administrator.
    const adminAgent = request.agent(app);

    const adminLogin = await adminAgent
      .post("/api/auth/login")
      .send({
        email: "admin@example.com",
        password: "LocalTest#2026",
      });

    expect(adminLogin.status).toBe(200);

    // 3. Retrieve the maintenance officer's ID.
    const officersResponse = await adminAgent.get(
      "/api/requests/officers"
    );

    expect(officersResponse.status).toBe(200);

    const officer = officersResponse.body.officers.find(
      (item) => item.email === "officer@example.com"
    );

    expect(officer).toBeDefined();

    // 4. Assign the request to the maintenance officer.
    const assignmentResponse = await adminAgent
      .post(`/api/requests/${requestId}/assign`)
      .send({
        assignedToId: officer.id,
        notes: "Assigned through automated workflow testing.",
      });

    expect(assignmentResponse.status).toBe(201);
    expect(assignmentResponse.body.message).toBe(
      "Maintenance request assigned successfully."
    );

    // 5. Log in as the maintenance officer.
    const officerAgent = request.agent(app);

    const officerLogin = await officerAgent
      .post("/api/auth/login")
      .send({
        email: "officer@example.com",
        password: "LocalTest#2026",
      });

    expect(officerLogin.status).toBe(200);

    // 6. Confirm that the officer can see the assigned request.
    const assignedResponse = await officerAgent.get(
      "/api/requests/assigned"
    );

    expect(assignedResponse.status).toBe(200);

    const assignedRequest = assignedResponse.body.requests.find(
      (item) => item.id === requestId
    );

    expect(assignedRequest).toBeDefined();
    expect(assignedRequest.currentStatus).toBe("ASSIGNED");

    // 7. Change the request status to IN_PROGRESS.
    const progressResponse = await officerAgent
      .patch(`/api/requests/${requestId}/status`)
      .send({
        status: "IN_PROGRESS",
        note: "Maintenance work has started.",
      });

    expect(progressResponse.status).toBe(200);
    expect(progressResponse.body.request.currentStatus).toBe(
      "IN_PROGRESS"
    );

    // 8. Mark the request as RESOLVED.
    const resolvedResponse = await officerAgent
      .patch(`/api/requests/${requestId}/status`)
      .send({
        status: "RESOLVED",
        note: "The maintenance issue has been resolved.",
      });

    expect(resolvedResponse.status).toBe(200);
    expect(resolvedResponse.body.request.currentStatus).toBe(
      "RESOLVED"
    );

    // 9. Verify the complete status history.
    const historyResponse = await studentAgent.get(
      `/api/requests/${requestId}/history`
    );

    expect(historyResponse.status).toBe(200);

    expect(
      historyResponse.body.history.map(
        (item) => item.newStatus
      )
    ).toEqual([
      "SUBMITTED",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
    ]);
  }, 30000);
});
