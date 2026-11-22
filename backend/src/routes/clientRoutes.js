
import { Router } from "express";

import {
  createClient,
  getClients,
  getClientStats,
  getClientById,
  updateClient,
  deleteClient,
} from "../controllers/clientController.js";

import {
  protect,
  authorize,
} from "../middlewares/authMiddleware.js";

import { validateRequest } from "../middlewares/validateRequest.js";

import {
  createClientSchema,
  updateClientSchema,
  clientQuerySchema,
  clientIdSchema,
} from "../validators/clientValidator.js";

const router = Router();

// All client routes require authentication.
router.use(protect);

// GET /api/clients/stats
router.get(
  "/stats",
  authorize("admin", "manager"),
  getClientStats
);

// GET /api/clients
router.get(
  "/",
  authorize("admin", "manager"),
  validateRequest(clientQuerySchema, "query"),
  getClients
);

// GET /api/clients/:id
router.get(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(clientIdSchema, "params"),
  getClientById
);

// POST /api/clients
router.post(
  "/",
  authorize("admin", "manager"),
  validateRequest(createClientSchema, "body"),
  createClient
);

// PATCH /api/clients/:id
router.patch(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(clientIdSchema, "params"),
  validateRequest(updateClientSchema, "body"),
  updateClient
);

// DELETE /api/clients/:id
router.delete(
  "/:id",
  authorize("admin"),
  validateRequest(clientIdSchema, "params"),
  deleteClient
);

export default router;
