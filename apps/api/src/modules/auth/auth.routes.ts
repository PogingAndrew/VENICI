import { Router } from "express";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { loginSchema, registerSchema } from "./auth.schema";
import { login, logout, me, refresh, register } from "./auth.controller";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
