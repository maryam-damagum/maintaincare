
const { z } = require("zod");
const express = require("express");
const prisma = require("./db");
const { requireAuth, requireRole } = require("./middleware");
const router = express.Router();


// GET status history for a maintenance request
router.get("/:requestId/history", requireAuth, async (req, res, next) => {
  try {
    const requestId = req.params.requestId;

    const currentUser = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, role: true },
    });

    if (!currentUser) {
      return res.status(401).json({
        message: "Your session is invalid. Please log in again.",
      });
    }

    const maintenanceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        submittedById: true,
        assignments: {
          where: {
            assignedToId: currentUser.id,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!maintenanceRequest) {
      return res.status(404).json({
        message: "Maintenance request not found.",
      });
    }

    // Administrators can view all request histories.
    const isAdmin = currentUser.role === "ADMIN";

    // Students and staff can only view requests they submitted.
    const isOwner =
      (currentUser.role === "STUDENT" ||
        currentUser.role === "STAFF") &&
      maintenanceRequest.submittedById === currentUser.id;

    // Maintenance officers can only view requests assigned to them.
    const isAssignedOfficer =
      currentUser.role === "MAINTENANCE_OFFICER" &&
      maintenanceRequest.assignments.length > 0;

    if (!isAdmin && !isOwner && !isAssignedOfficer) {
      return res.status(403).json({
        message: "You do not have permission to view this request history.",
      });
    }

    const history = await prisma.statusUpdate.findMany({
      where: { requestId },
      include: {
        changedBy: {
          select: {
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json({ history });
  } catch (error) {
    next(error);
  }
});


// GET maintenance categories
router.get("/categories", requireAuth, async (req, res, next) => {
  try {
    const categories = await prisma.requestCategory.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// GET all maintenance requests with summary
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, role: true },
    });

    if (!currentUser) {
      return res.status(401).json({
        message: "Your session is invalid. Please log in again.",
      });
    }
    const { search, status, priority, categoryId } = req.query;
    const where = {
  ...(currentUser.role === "STUDENT" || currentUser.role === "STAFF"
    ? { submittedById: currentUser.id }
    : currentUser.role === "MAINTENANCE_OFFICER"
      ? {
          assignments: {
            some: {
              assignedToId: currentUser.id,
            },
          },
        }
      : {}),

  ...(search
    ? {
        title: {
          contains: search,
          mode: "insensitive",
        },
      }
    : {}),

  ...(status ? { currentStatus: status } : {}),
  ...(priority ? { priority } : {}),
  ...(categoryId ? { categoryId } : {}),
};

    const [
      requests,
      totalRequests,
      awaitingReview,
      inProgress,
      resolved,
    ] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          category: true,
          submittedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          assignments: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
      }),

      prisma.serviceRequest.count({ where }),

      prisma.serviceRequest.count({
        where: { ...where, currentStatus: "UNDER_REVIEW" },
      }),

      prisma.serviceRequest.count({
        where: { ...where, currentStatus: "IN_PROGRESS" },
      }),

      prisma.serviceRequest.count({
        where: { ...where, currentStatus: "RESOLVED" },
      }),
    ]);

    res.json({
      requests,
      summary: {
        totalRequests,
        awaitingReview,
        inProgress,
        resolved,
      },
    });
  } catch (error) {
    next(error);
  }
});


router.post(
  "/:requestId/assign",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const schema = z.object({
        assignedToId: z.string().uuid(),
        notes: z.string().trim().max(500).optional(),
      });

      const result = schema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          message: "Please provide a valid maintenance officer ID.",
        });
      }

      const { assignedToId, notes } = result.data;
      const requestId = req.params.requestId;

      // Confirm that the request exists
      const maintenanceRequest =
        await prisma.serviceRequest.findUnique({
          where: { id: requestId },
        });

      if (!maintenanceRequest) {
        return res.status(404).json({
          message: "Maintenance request not found.",
        });
      }

      // Confirm that the selected user is a maintenance officer
      const officer = await prisma.user.findFirst({
        where: {
          id: assignedToId,
          role: "MAINTENANCE_OFFICER",
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      });

      if (!officer) {
        return res.status(400).json({
          message: "The selected user is not a maintenance officer.",
        });
      }

      const assignment = await prisma.$transaction(async (tx) => {
        const createdAssignment = await tx.assignment.create({
          data: {
            requestId,
            assignedToId,
            assignedById: req.currentUser.id,
            notes,
          },
          include: {
            assignedTo: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        });

        await tx.serviceRequest.update({
          where: { id: requestId },
          data: { currentStatus: "ASSIGNED" },
        });

        await tx.statusUpdate.create({
          data: {
            requestId,
            changedById: req.currentUser.id,
            previousStatus: maintenanceRequest.currentStatus,
            newStatus: "ASSIGNED",
            note: notes || `Assigned to ${officer.fullName}.`,
          },
        });

        return createdAssignment;
      });

      return res.status(201).json({
        message: "Maintenance request assigned successfully.",
        assignment,
      });
    } catch (error) {
      next(error);
    }
  }
);


router.get(
  "/officers",
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const officers = await prisma.user.findMany({
        where: {
          role: "MAINTENANCE_OFFICER",
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
        orderBy: {
          fullName: "asc",
        },
      });

      res.json({ officers });
    } catch (error) {
      next(error);
    }
  }
);


// POST a new maintenance request


router.post("/", requireAuth, async (req, res, next) => {
  try {
    const requestSchema = z.object({
      title: z.string().trim().min(3).max(150),
      description: z.string().trim().min(10).max(2000),
      location: z.string().trim().min(2).max(200),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      categoryId: z.string().uuid(),
    });

    const result = requestSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Please check the information you entered.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const {
      title,
      description,
      location,
      priority,
      categoryId,
    } = result.data;

    const category = await prisma.requestCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return res.status(400).json({
        message: "The selected category does not exist.",
      });
    }

    
    const newRequest = await prisma.$transaction(async (tx) => {
      const createdRequest = await tx.serviceRequest.create({
        data: {
          title,
          description,
          location,
          priority,
          categoryId,
          submittedById: req.session.userId,
        },
        include: {
          category: true,
        },
      });

      await tx.statusUpdate.create({
        data: {
          requestId: createdRequest.id,
          changedById: req.session.userId,
          previousStatus: null,
          newStatus: "SUBMITTED",
          note: "Maintenance request submitted.",
        },
      });

      return createdRequest;
    });

    return res.status(201).json({
      message: "Maintenance request submitted successfully.",
      request: newRequest,
    });
  } catch (error) {
    next(error);
  }
});


// GET requests assigned to the logged-in maintenance officer
router.get(
  "/assigned",
  requireRole("MAINTENANCE_OFFICER"),
  async (req, res, next) => {
    try {
      const requests = await prisma.serviceRequest.findMany({
        where: {
          assignments: {
            some: {
              assignedToId: req.currentUser.id,
            },
          },
        },
        include: {
          category: true,
          submittedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          assignments: {
            where: {
              assignedToId: req.currentUser.id,
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      res.json({
        total: requests.length,
        requests,
      });
    } catch (error) {
      next(error);
    }
  }
);


// UPDATE request status by assigned maintenance officer
router.patch(
  "/:requestId/status",
  requireRole("MAINTENANCE_OFFICER"),
  async (req, res, next) => {
    try {
      const schema = z.object({
        status: z.enum(["IN_PROGRESS", "RESOLVED"]),
        note: z.string().trim().min(3).max(1000),
      });

      const result = schema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          message: "Please provide a valid status and progress note.",
        });
      }

      const { status, note } = result.data;
      const requestId = req.params.requestId;

      const maintenanceRequest =
        await prisma.serviceRequest.findFirst({
          where: {
            id: requestId,
            assignments: {
              some: {
                assignedToId: req.currentUser.id,
              },
            },
          },
        });

      if (!maintenanceRequest) {
        return res.status(404).json({
          message: "Request not found or not assigned to you.",
        });
      }

      if (
        maintenanceRequest.currentStatus !== "ASSIGNED" &&
        maintenanceRequest.currentStatus !== "IN_PROGRESS"
      ) {
        return res.status(400).json({
          message: "This request cannot be updated in its current status.",
        });
      }

      if (
        maintenanceRequest.currentStatus === "IN_PROGRESS" &&
        status === "IN_PROGRESS"
      ) {
        return res.status(400).json({
          message: "This request is already in progress.",
        });
      }

      const updatedRequest = await prisma.$transaction(async (tx) => {
        const updated = await tx.serviceRequest.update({
          where: { id: requestId },
          data: { currentStatus: status },
        });

        await tx.statusUpdate.create({
          data: {
            requestId,
            changedById: req.currentUser.id,
            previousStatus: maintenanceRequest.currentStatus,
            newStatus: status,
            note,
          },
        });

        return updated;
      });

      res.json({
        message: "Request status updated successfully.",
        request: updatedRequest,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;