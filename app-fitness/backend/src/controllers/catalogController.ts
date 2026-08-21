import { Request, Response } from "express";
import { listExercises } from "../services/exerciseService";
import { listFoods } from "../services/foodService";

export async function listExercisesHandler(_req: Request, res: Response): Promise<void> {
  const exercises = await listExercises();
  res.status(200).json(exercises);
}

export async function listFoodsHandler(_req: Request, res: Response): Promise<void> {
  const foods = await listFoods();
  res.status(200).json(foods);
}
