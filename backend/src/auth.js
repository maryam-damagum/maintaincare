
const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("./db");

const router = express.Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// Register new student accounts only.
router.post("/register", async (req, res, next) => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Please provide a valid name, email, and password of at least 8 characters.",
      });
    }

    const fullName = result.data.fullName;
    const email = result.data.email.toLowerCase();
    const password = result.data.password;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "STUDENT",
      },
    });

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    return res.status(201).json({
      message: "Registration successful.",
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
});

// Log in an existing account.
router.post("/login", async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Please provide a valid email and password.",
      });
    }

    const email = result.data.email.toLowerCase();
    const password = result.data.password;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    return res.json({
      message: "Login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// Get the currently authenticated user.
router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "You are not logged in.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      return req.session.destroy(() => {
        res.status(401).json({
          message: "Your session is no longer valid. Please log in again.",
        });
      });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// Log out.
router.post("/logout", (req, res, next) => {
  if (!req.session) {
    return res.json({ message: "You are logged out." });
  }

  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res.json({ message: "Logout successful." });
  });
});

module.exports = router;
