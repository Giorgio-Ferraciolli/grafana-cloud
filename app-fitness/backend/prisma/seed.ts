import { PrismaClient, MuscleGroup, ExperienceLevel } from "@prisma/client";
import { generatePlan } from "../src/services/planService";

const prisma = new PrismaClient();

interface ExerciseSeed {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  difficulty: ExperienceLevel;
  description: string;
}

const exercises: ExerciseSeed[] = [
  // CHEST
  { name: "Supino Reto", muscleGroup: "CHEST", equipment: "Barra", difficulty: "INTERMEDIATE", description: "Deitado no banco reto, empurre a barra para cima." },
  { name: "Supino Inclinado", muscleGroup: "CHEST", equipment: "Halteres", difficulty: "INTERMEDIATE", description: "Banco inclinado a 30-45 graus, foco na porção superior do peitoral." },
  { name: "Crucifixo", muscleGroup: "CHEST", equipment: "Halteres", difficulty: "BEGINNER", description: "Movimento de abertura de braços deitado no banco." },
  { name: "Flexão de Braço", muscleGroup: "CHEST", equipment: "Peso do corpo", difficulty: "BEGINNER", description: "Flexão tradicional apoiado nas mãos e pés." },
  { name: "Crossover", muscleGroup: "CHEST", equipment: "Cabo", difficulty: "ADVANCED", description: "Cruzamento de cabos em pé, foco na contração final." },
  { name: "Supino Declinado", muscleGroup: "CHEST", equipment: "Barra", difficulty: "ADVANCED", description: "Banco declinado, foco na porção inferior do peitoral." },
  // BACK
  { name: "Puxada Frontal", muscleGroup: "BACK", equipment: "Polia", difficulty: "BEGINNER", description: "Puxada na polia alta até a altura do queixo." },
  { name: "Remada Curvada", muscleGroup: "BACK", equipment: "Barra", difficulty: "INTERMEDIATE", description: "Tronco inclinado à frente, puxe a barra até o abdômen." },
  { name: "Remada Unilateral", muscleGroup: "BACK", equipment: "Halter", difficulty: "BEGINNER", description: "Apoiado no banco com um joelho, puxe o halter." },
  { name: "Barra Fixa", muscleGroup: "BACK", equipment: "Peso do corpo", difficulty: "ADVANCED", description: "Puxe o corpo até o queixo passar da barra." },
  { name: "Remada Cavalinho", muscleGroup: "BACK", equipment: "Barra T", difficulty: "INTERMEDIATE", description: "Remada com barra apoiada entre as pernas." },
  { name: "Levantamento Terra", muscleGroup: "BACK", equipment: "Barra", difficulty: "ADVANCED", description: "Levante a barra do chão mantendo a coluna neutra." },
  // SHOULDERS
  { name: "Desenvolvimento Militar", muscleGroup: "SHOULDERS", equipment: "Barra", difficulty: "INTERMEDIATE", description: "Empurre a barra acima da cabeça em pé." },
  { name: "Elevação Lateral", muscleGroup: "SHOULDERS", equipment: "Halteres", difficulty: "BEGINNER", description: "Eleve os halteres lateralmente até a altura dos ombros." },
  { name: "Elevação Frontal", muscleGroup: "SHOULDERS", equipment: "Halteres", difficulty: "BEGINNER", description: "Eleve os halteres à frente até a altura dos ombros." },
  { name: "Remada Alta", muscleGroup: "SHOULDERS", equipment: "Barra", difficulty: "INTERMEDIATE", description: "Puxe a barra verticalmente até a altura do peito." },
  { name: "Face Pull", muscleGroup: "SHOULDERS", equipment: "Cabo", difficulty: "INTERMEDIATE", description: "Puxe a corda em direção ao rosto, cotovelos altos." },
  // BICEPS
  { name: "Rosca Direta", muscleGroup: "BICEPS", equipment: "Barra", difficulty: "BEGINNER", description: "Flexione os cotovelos elevando a barra." },
  { name: "Rosca Alternada", muscleGroup: "BICEPS", equipment: "Halteres", difficulty: "BEGINNER", description: "Alterne a flexão dos braços com halteres." },
  { name: "Rosca Scott", muscleGroup: "BICEPS", equipment: "Barra W", difficulty: "INTERMEDIATE", description: "Rosca apoiada no banco Scott, isola o bíceps." },
  { name: "Rosca Martelo", muscleGroup: "BICEPS", equipment: "Halteres", difficulty: "BEGINNER", description: "Rosca com pegada neutra, foco no braquial." },
  // TRICEPS
  { name: "Tríceps Corda", muscleGroup: "TRICEPS", equipment: "Cabo", difficulty: "BEGINNER", description: "Empurre a corda para baixo estendendo o cotovelo." },
  { name: "Tríceps Testa", muscleGroup: "TRICEPS", equipment: "Barra W", difficulty: "INTERMEDIATE", description: "Deitado, flexione os cotovelos levando a barra à testa." },
  { name: "Mergulho no Banco", muscleGroup: "TRICEPS", equipment: "Peso do corpo", difficulty: "BEGINNER", description: "Apoiado em dois bancos, flexione os cotovelos." },
  { name: "Tríceps Francês", muscleGroup: "TRICEPS", equipment: "Halter", difficulty: "INTERMEDIATE", description: "Halter atrás da cabeça, estenda o cotovelo." },
  // LEGS
  { name: "Agachamento Livre", muscleGroup: "LEGS", equipment: "Barra", difficulty: "INTERMEDIATE", description: "Agache mantendo o tronco ereto e os joelhos alinhados." },
  { name: "Leg Press", muscleGroup: "LEGS", equipment: "Máquina", difficulty: "BEGINNER", description: "Empurre a plataforma com os pés." },
  { name: "Cadeira Extensora", muscleGroup: "LEGS", equipment: "Máquina", difficulty: "BEGINNER", description: "Estenda os joelhos contra a resistência." },
  { name: "Cadeira Flexora", muscleGroup: "LEGS", equipment: "Máquina", difficulty: "BEGINNER", description: "Flexione os joelhos contra a resistência." },
  { name: "Afundo", muscleGroup: "LEGS", equipment: "Halteres", difficulty: "INTERMEDIATE", description: "Passo à frente flexionando ambos os joelhos." },
  { name: "Stiff", muscleGroup: "LEGS", equipment: "Barra", difficulty: "INTERMEDIATE", description: "Flexão do quadril mantendo as pernas semi-estendidas." },
  // GLUTES
  { name: "Elevação Pélvica", muscleGroup: "GLUTES", equipment: "Barra", difficulty: "BEGINNER", description: "Eleve o quadril apoiado com os ombros no banco." },
  { name: "Cadeira Abdutora", muscleGroup: "GLUTES", equipment: "Máquina", difficulty: "BEGINNER", description: "Afaste as pernas contra a resistência." },
  { name: "Agachamento Sumô", muscleGroup: "GLUTES", equipment: "Halter", difficulty: "INTERMEDIATE", description: "Agachamento com pernas afastadas e pés rotacionados." },
  // CORE
  { name: "Prancha", muscleGroup: "CORE", equipment: "Peso do corpo", difficulty: "BEGINNER", description: "Mantenha o corpo alinhado apoiado nos antebraços." },
  { name: "Abdominal Supra", muscleGroup: "CORE", equipment: "Peso do corpo", difficulty: "BEGINNER", description: "Flexione o tronco em direção aos joelhos." },
  { name: "Abdominal Infra", muscleGroup: "CORE", equipment: "Peso do corpo", difficulty: "INTERMEDIATE", description: "Eleve as pernas mantendo o tronco fixo." },
  { name: "Elevação de Pernas", muscleGroup: "CORE", equipment: "Barra Fixa", difficulty: "ADVANCED", description: "Suspenso na barra, eleve as pernas estendidas." },
  { name: "Russian Twist", muscleGroup: "CORE", equipment: "Peso do corpo", difficulty: "INTERMEDIATE", description: "Rotação de tronco sentado com pés suspensos." },
  // CARDIO
  { name: "Corrida na Esteira", muscleGroup: "CARDIO", equipment: "Esteira", difficulty: "BEGINNER", description: "Corrida em ritmo constante ou intervalado." },
  { name: "Bicicleta Ergométrica", muscleGroup: "CARDIO", equipment: "Bicicleta", difficulty: "BEGINNER", description: "Pedalada em ritmo constante ou intervalado." },
  { name: "Pular Corda", muscleGroup: "CARDIO", equipment: "Corda", difficulty: "INTERMEDIATE", description: "Saltos contínuos girando a corda." },
  { name: "Escada (StairMaster)", muscleGroup: "CARDIO", equipment: "Máquina", difficulty: "INTERMEDIATE", description: "Subida contínua em máquina de escada." },
  { name: "Remo Ergômetro", muscleGroup: "CARDIO", equipment: "Remo", difficulty: "INTERMEDIATE", description: "Remada em ritmo constante ou intervalado." },
  // FULL_BODY
  { name: "Burpee", muscleGroup: "FULL_BODY", equipment: "Peso do corpo", difficulty: "INTERMEDIATE", description: "Agachamento, prancha, flexão e salto em sequência." },
  { name: "Kettlebell Swing", muscleGroup: "FULL_BODY", equipment: "Kettlebell", difficulty: "INTERMEDIATE", description: "Balanço do kettlebell usando o quadril." },
  { name: "Clean and Press", muscleGroup: "FULL_BODY", equipment: "Halteres", difficulty: "ADVANCED", description: "Puxada e desenvolvimento em um movimento contínuo." },
  { name: "Mountain Climber", muscleGroup: "FULL_BODY", equipment: "Peso do corpo", difficulty: "BEGINNER", description: "Corrida estática em posição de prancha." },
  { name: "Thruster", muscleGroup: "FULL_BODY", equipment: "Halteres", difficulty: "ADVANCED", description: "Agachamento seguido de desenvolvimento acima da cabeça." },
];

interface FoodSeed {
  name: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  tags: string[];
}

const foods: FoodSeed[] = [
  // protein
  { name: "Peito de Frango Grelhado", category: "protein", caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, tags: ["meat"] },
  { name: "Ovo Cozido", category: "protein", caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, tags: ["egg", "vegetarian"] },
  { name: "Tilápia Grelhada", category: "protein", caloriesPer100g: 128, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 2.7, tags: ["fish"] },
  { name: "Carne Bovina Magra", category: "protein", caloriesPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 15, tags: ["meat"] },
  { name: "Tofu Grelhado", category: "protein", caloriesPer100g: 76, proteinPer100g: 8, carbsPer100g: 1.9, fatPer100g: 4.8, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Atum em Lata", category: "protein", caloriesPer100g: 132, proteinPer100g: 28, carbsPer100g: 0, fatPer100g: 1, tags: ["fish"] },
  { name: "Lentilha Cozida", category: "protein", caloriesPer100g: 116, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 0.4, tags: ["vegan", "vegetarian", "gluten_free"] },
  // carb
  { name: "Arroz Branco Cozido", category: "carb", caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Batata Doce Cozida", category: "carb", caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20, fatPer100g: 0.1, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Aveia em Flocos", category: "carb", caloriesPer100g: 389, proteinPer100g: 17, carbsPer100g: 66, fatPer100g: 7, tags: ["vegan", "vegetarian", "gluten"] },
  { name: "Pão Integral", category: "carb", caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 4.2, tags: ["vegetarian", "gluten"] },
  { name: "Macarrão Integral", category: "carb", caloriesPer100g: 124, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1, tags: ["vegetarian", "gluten"] },
  { name: "Quinoa Cozida", category: "carb", caloriesPer100g: 120, proteinPer100g: 4.4, carbsPer100g: 21, fatPer100g: 1.9, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Arroz Integral Cozido", category: "carb", caloriesPer100g: 111, proteinPer100g: 2.6, carbsPer100g: 23, fatPer100g: 0.9, tags: ["vegan", "vegetarian", "gluten_free"] },
  // vegetable
  { name: "Brócolis Cozido", category: "vegetable", caloriesPer100g: 35, proteinPer100g: 2.4, carbsPer100g: 7, fatPer100g: 0.4, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Salada de Folhas Verdes", category: "vegetable", caloriesPer100g: 15, proteinPer100g: 1.4, carbsPer100g: 2.9, fatPer100g: 0.2, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Cenoura", category: "vegetable", caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Abobrinha Refogada", category: "vegetable", caloriesPer100g: 17, proteinPer100g: 1.2, carbsPer100g: 3.1, fatPer100g: 0.3, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Tomate", category: "vegetable", caloriesPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2, tags: ["vegan", "vegetarian", "gluten_free"] },
  // fruit
  { name: "Banana", category: "fruit", caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Maçã", category: "fruit", caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Morango", category: "fruit", caloriesPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Abacate", category: "fruit", caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 15, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Laranja", category: "fruit", caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Mamão", category: "fruit", caloriesPer100g: 43, proteinPer100g: 0.5, carbsPer100g: 11, fatPer100g: 0.3, tags: ["vegan", "vegetarian", "gluten_free"] },
  // dairy
  { name: "Iogurte Natural Desnatado", category: "dairy", caloriesPer100g: 56, proteinPer100g: 4, carbsPer100g: 7, fatPer100g: 0.2, tags: ["dairy", "vegetarian", "gluten_free"] },
  { name: "Queijo Cottage", category: "dairy", caloriesPer100g: 98, proteinPer100g: 11, carbsPer100g: 3.4, fatPer100g: 4.3, tags: ["dairy", "vegetarian", "gluten_free"] },
  { name: "Leite Desnatado", category: "dairy", caloriesPer100g: 35, proteinPer100g: 3.4, carbsPer100g: 5, fatPer100g: 0.1, tags: ["dairy", "vegetarian", "gluten_free"] },
  { name: "Iogurte Grego", category: "dairy", caloriesPer100g: 97, proteinPer100g: 9, carbsPer100g: 3.6, fatPer100g: 5, tags: ["dairy", "vegetarian", "gluten_free"] },
  // fat
  { name: "Pasta de Amendoim", category: "fat", caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Azeite de Oliva", category: "fat", caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Castanha do Pará", category: "fat", caloriesPer100g: 656, proteinPer100g: 14, carbsPer100g: 12, fatPer100g: 66, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Amêndoas", category: "fat", caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, tags: ["vegan", "vegetarian", "gluten_free"] },
  // snack
  { name: "Barra de Proteína", category: "snack", caloriesPer100g: 350, proteinPer100g: 30, carbsPer100g: 35, fatPer100g: 10, tags: ["vegetarian"] },
  { name: "Mix de Castanhas", category: "snack", caloriesPer100g: 600, proteinPer100g: 20, carbsPer100g: 20, fatPer100g: 50, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Iogurte com Granola", category: "snack", caloriesPer100g: 150, proteinPer100g: 6, carbsPer100g: 22, fatPer100g: 4, tags: ["dairy", "vegetarian", "gluten"] },
  { name: "Chips de Batata Doce Assada", category: "snack", caloriesPer100g: 200, proteinPer100g: 3, carbsPer100g: 40, fatPer100g: 4, tags: ["vegan", "vegetarian", "gluten_free"] },
  // breakfast
  { name: "Pão Francês", category: "breakfast", caloriesPer100g: 300, proteinPer100g: 9, carbsPer100g: 58, fatPer100g: 3, tags: ["vegetarian", "gluten"] },
  { name: "Tapioca", category: "breakfast", caloriesPer100g: 240, proteinPer100g: 0.2, carbsPer100g: 58, fatPer100g: 0.1, tags: ["vegan", "vegetarian", "gluten_free"] },
  { name: "Aveia com Frutas", category: "breakfast", caloriesPer100g: 350, proteinPer100g: 12, carbsPer100g: 60, fatPer100g: 6, tags: ["vegan", "vegetarian", "gluten"] },
  { name: "Omelete", category: "breakfast", caloriesPer100g: 154, proteinPer100g: 11, carbsPer100g: 1.6, fatPer100g: 11, tags: ["egg", "vegetarian", "gluten_free"] },
];

interface UserSeed {
  name: string;
  email: string;
  age: number;
  preferences: {
    goal: "LOSE_WEIGHT" | "GAIN_MUSCLE" | "MAINTAIN" | "IMPROVE_CONDITIONING";
    experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    daysPerWeek: number;
    minutesPerSession: number;
    trainingPreference: "STRENGTH" | "CARDIO" | "HIIT" | "FUNCTIONAL" | "MIXED";
    dietaryRestrictions: string[];
    nutritionGoal: "LOSE_WEIGHT" | "GAIN_MUSCLE" | "MAINTAIN" | "HEALTHY_EATING";
    likedFoods: string[];
    dislikedFoods: string[];
  };
}

const users: UserSeed[] = [
  {
    name: "Ana Souza",
    email: "ana.souza@example.com",
    age: 28,
    preferences: {
      goal: "GAIN_MUSCLE",
      experienceLevel: "INTERMEDIATE",
      daysPerWeek: 4,
      minutesPerSession: 45,
      trainingPreference: "STRENGTH",
      dietaryRestrictions: [],
      nutritionGoal: "GAIN_MUSCLE",
      likedFoods: ["Frango", "Batata Doce"],
      dislikedFoods: ["Brócolis"],
    },
  },
  {
    name: "Carlos Lima",
    email: "carlos.lima@example.com",
    age: 35,
    preferences: {
      goal: "LOSE_WEIGHT",
      experienceLevel: "BEGINNER",
      daysPerWeek: 3,
      minutesPerSession: 30,
      trainingPreference: "CARDIO",
      dietaryRestrictions: ["lactose_free"],
      nutritionGoal: "LOSE_WEIGHT",
      likedFoods: ["Banana"],
      dislikedFoods: ["Tilápia"],
    },
  },
  {
    name: "Beatriz Alves",
    email: "beatriz.alves@example.com",
    age: 24,
    preferences: {
      goal: "IMPROVE_CONDITIONING",
      experienceLevel: "ADVANCED",
      daysPerWeek: 5,
      minutesPerSession: 60,
      trainingPreference: "HIIT",
      dietaryRestrictions: ["vegetarian"],
      nutritionGoal: "HEALTHY_EATING",
      likedFoods: ["Quinoa", "Abacate"],
      dislikedFoods: [],
    },
  },
];

async function main() {
  console.log("Seeding exercises...");
  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: exercise,
      create: exercise,
    });
  }

  console.log("Seeding foods...");
  for (const food of foods) {
    await prisma.food.upsert({
      where: { name: food.name },
      update: food,
      create: food,
    });
  }

  console.log("Seeding users and preferences...");
  const seededUserIds: string[] = [];
  for (const userSeed of users) {
    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      update: { name: userSeed.name, age: userSeed.age },
      create: { name: userSeed.name, email: userSeed.email, age: userSeed.age },
    });

    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: userSeed.preferences,
      create: { userId: user.id, ...userSeed.preferences },
    });

    seededUserIds.push(user.id);
  }

  console.log("Generating one example plan per user...");
  for (const userId of seededUserIds) {
    const hasPlan = await prisma.workoutPlan.findFirst({ where: { userId } });
    if (hasPlan) continue;
    await generatePlan(userId);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
