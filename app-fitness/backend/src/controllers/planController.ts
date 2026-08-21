import { Request, Response } from "express";
import {
  generatePlan,
  getLatestDietPlanForUser,
  getLatestPlanForUser,
  getLatestWorkoutPlanForUser,
} from "../services/planService";
import { generateAiCoachNote } from "../services/aiCoachService";

export async function generatePlanHandler(req: Request, res: Response): Promise<void> {
  const { userId } = req.body as { userId: string };
  const { simulateDelay } = req.query as { simulateDelay?: number };

  const plan = await generatePlan(userId, { simulateDelayMs: simulateDelay });
  res.status(201).json(plan);
}

export async function getPlanHandler(req: Request, res: Response): Promise<void> {
  const plan = await getLatestPlanForUser(req.params.userId);
  res.status(200).json(plan);
}

export async function getWorkoutPlanHandler(req: Request, res: Response): Promise<void> {
  const plan = await getLatestWorkoutPlanForUser(req.params.userId);
  res.status(200).json(plan);
}

export async function getDietPlanHandler(req: Request, res: Response): Promise<void> {
  const plan = await getLatestDietPlanForUser(req.params.userId);
  res.status(200).json(plan);
}

export async function getAiCoachNoteHandler(req: Request, res: Response): Promise<void> {
  const note = await generateAiCoachNote(req.params.userId);
  res.status(200).json(note);
}
