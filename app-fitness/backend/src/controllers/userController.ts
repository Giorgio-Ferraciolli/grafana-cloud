import { Request, Response } from "express";
import { createUser, getUserById, upsertPreferences } from "../services/userService";

export async function createUserHandler(req: Request, res: Response): Promise<void> {
  const user = await createUser(req.body);
  res.status(201).json(user);
}

export async function getUserHandler(req: Request, res: Response): Promise<void> {
  const user = await getUserById(req.params.id);
  res.status(200).json(user);
}

export async function updatePreferencesHandler(req: Request, res: Response): Promise<void> {
  const preferences = await upsertPreferences(req.params.id, req.body);
  res.status(200).json(preferences);
}
