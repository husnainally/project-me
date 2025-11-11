"use client";

import { useState, useRef } from "react";
import Image from "next/image";

// Type definitions
interface Nutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodMeasure {
  label?: string;
  portionDescription?: string;
  unit?: string;
  gramWeight?: number;
  gram_weight?: number;
}

interface AiSelectedPortion {
  gramWeight: number;
  portionDescription: string;
  reasoning?: string;
}

interface Ingredient {
  name: string;
  brand: string;
  serving_info: string;
  nutrients: Nutrients;
  originalNutrients?: Nutrients;
  foodMeasures: FoodMeasure[];
  selectedPortion?: {
    source?: string;
    reasoning?: string;
  };
  ai_selected_portion?: AiSelectedPortion;
}

interface Meal {
  meal_name: string;
  meal_size?: string;
  ingredients: Ingredient[];
  total_nutrients: Nutrients;
}

interface ApiResponse {
  dailyTotals: Nutrients;
  loggedMeals: Meal[];
}

export default function CalorieTracker() {
  const [foodInput, setFoodInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing your food...");
  const [loadingStage, setLoadingStage] = useState("Starting...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dailyTotals, setDailyTotals] = useState<Nutrients>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [loggedMeals, setLoggedMeals] = useState<Meal[]>([]);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const updateProgress = (message: string, stage: string, progressValue: number) => {
    setLoadingMessage(message);
    setLoadingStage(stage);
    setProgress(progressValue);
  };

  const simulateProgress = () => {
    let currentProgress = 5;
    const stages = [
      { max: 20, message: "Extracting food items...", stage: "AI is reading your input..." },
      { max: 40, message: "Searching database...", stage: "Finding matching foods..." },
      { max: 60, message: "Analyzing nutrition...", stage: "AI is selecting best matches..." },
      { max: 85, message: "Calculating totals...", stage: "Processing nutrition data..." },
    ];
    let stageIndex = 0;

    progressIntervalRef.current = setInterval(() => {
      if (currentProgress < stages[stageIndex].max) {
        currentProgress += 1;
        updateProgress(
          stages[stageIndex].message,
          stages[stageIndex].stage,
          currentProgress
        );
      } else if (stageIndex < stages.length - 1) {
        stageIndex++;
      }
    }, 100);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const recalculateDailyTotals = (meals: Meal[]) => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    meals.forEach((meal) => {
      totals.calories += meal.total_nutrients.calories;
      totals.protein += meal.total_nutrients.protein;
      totals.carbs += meal.total_nutrients.carbs;
      totals.fat += meal.total_nutrients.fat;
    });
    setDailyTotals(totals);
  };

  const logFood = async () => {
    const userText = foodInput.trim();
    if (!userText) {
      setError("Please enter what you ate");
      return;
    }

    setError("");
    setLoading(true);
    updateProgress("Analyzing your food...", "Extracting food items...", 5);
    simulateProgress();

    try {
      // Call our secure API route instead of directly calling OpenAI
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          foodDescription: userText
        })
      });

      stopProgressSimulation();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process food data");
      }

      updateProgress("Complete!", "Processing results...", 95);

      // API route already returns the parsed JSON data
      const data: ApiResponse = await response.json();

      if (!data.dailyTotals || !data.loggedMeals) {
        throw new Error("Invalid response format from AI. Please try again.");
      }

      const newMeals = [...loggedMeals, ...data.loggedMeals];
      setLoggedMeals(newMeals);
      recalculateDailyTotals(newMeals);
      setFoodInput("");

      updateProgress("Success!", "Done!", 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      stopProgressSimulation();
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const removeMeal = (index: number) => {
    const newMeals = loggedMeals.filter((_, i) => i !== index);
    setLoggedMeals(newMeals);
    recalculateDailyTotals(newMeals);
  };

  const recalculateMealTotals = (mealIndex: number, updatedMeals: Meal[]) => {
    const meal = updatedMeals[mealIndex];
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

    meal.ingredients.forEach((ingredient) => {
      totals.calories += ingredient.nutrients.calories;
      totals.protein += ingredient.nutrients.protein;
      totals.carbs += ingredient.nutrients.carbs;
      totals.fat += ingredient.nutrients.fat;
    });

    meal.total_nutrients = totals;
    return updatedMeals;
  };

  const selectMeasurement = (mealIndex: number, ingredientIndex: number, measureIndex: number, gramWeight: number) => {
    const newMeals = [...loggedMeals];
    recalculateIngredientNutrition(mealIndex, ingredientIndex, gramWeight, newMeals);
  };

  const handleCustomGramInput = (mealIndex: number, ingredientIndex: number, customGrams: number) => {
    if (customGrams > 0) {
      const newMeals = [...loggedMeals];
      recalculateIngredientNutrition(mealIndex, ingredientIndex, customGrams, newMeals);
    } else {
      resetToOriginalNutrition(mealIndex, ingredientIndex);
    }
  };

  const resetToOriginalNutrition = (mealIndex: number, ingredientIndex: number) => {
    const newMeals = [...loggedMeals];
    const ingredient = newMeals[mealIndex].ingredients[ingredientIndex];

    if (ingredient.originalNutrients) {
      ingredient.nutrients = { ...ingredient.originalNutrients };
      const updatedMeals = recalculateMealTotals(mealIndex, newMeals);
      setLoggedMeals(updatedMeals);
      recalculateDailyTotals(updatedMeals);
    }
  };

  const recalculateIngredientNutrition = (
    mealIndex: number,
    ingredientIndex: number,
    selectedGramWeight: number,
    meals: Meal[]
  ) => {
    const ingredient = meals[mealIndex].ingredients[ingredientIndex];
    let originalGramWeight = 0;

    if (ingredient.ai_selected_portion?.gramWeight) {
      originalGramWeight = ingredient.ai_selected_portion.gramWeight;
    } else {
      const servingInfo = ingredient.serving_info || "";
      const gramMatch = servingInfo.match(/(\d+)g/);
      if (gramMatch) {
        originalGramWeight = parseFloat(gramMatch[1]);
      }
    }

    if (originalGramWeight === 0 && ingredient.foodMeasures?.[0]) {
      originalGramWeight = ingredient.foodMeasures[0].gramWeight || ingredient.foodMeasures[0].gram_weight || 0;
    }

    if (originalGramWeight > 0 && selectedGramWeight > 0) {
      const multiplier = selectedGramWeight / originalGramWeight;

      if (!ingredient.originalNutrients) {
        ingredient.originalNutrients = { ...ingredient.nutrients };
      }

      const newNutrients = {
        calories: Math.round(ingredient.originalNutrients.calories * multiplier),
        protein: Math.round(ingredient.originalNutrients.protein * multiplier * 10) / 10,
        carbs: Math.round(ingredient.originalNutrients.carbs * multiplier * 10) / 10,
        fat: Math.round(ingredient.originalNutrients.fat * multiplier * 10) / 10,
      };

      ingredient.nutrients = newNutrients;
      const updatedMeals = recalculateMealTotals(mealIndex, meals);
      setLoggedMeals([...updatedMeals]);
      recalculateDailyTotals(updatedMeals);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Header */}
      <header className="border-b border-gray-200 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Calorie Tracker</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Input Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Log your food</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              value={foodInput}
              onChange={(e) => setFoodInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && logFood()}
              placeholder="e.g., I had a big mac and medium fries"
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <button
              onClick={logFood}
              disabled={loading}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm sm:text-base whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Log Food
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-black mb-3 sm:mb-4"></div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-black mb-1 sm:mb-2">{loadingMessage}</p>
                <p className="text-xs sm:text-sm text-gray-700">{loadingStage}</p>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-2 mt-3 sm:mt-4">
                <div
                  className="bg-black h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-700 mt-2">{Math.round(progress)}%</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-6 sm:mb-8">
            <p className="text-sm sm:text-base text-red-800">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {loggedMeals.length > 0 && (
          <div>
            {/* Daily Totals */}
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Daily Totals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-black">
                    {Math.round(dailyTotals.calories)}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-700">Calories</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-black">
                    {Math.round(dailyTotals.protein)}g
                  </div>
                  <div className="text-xs sm:text-sm text-gray-700">Protein</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-black">
                    {Math.round(dailyTotals.carbs)}g
                  </div>
                  <div className="text-xs sm:text-sm text-gray-700">Carbs</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-black">
                    {Math.round(dailyTotals.fat)}g
                  </div>
                  <div className="text-xs sm:text-sm text-gray-700">Fat</div>
                </div>
              </div>
            </div>

            {/* Logged Foods */}
            <div className="space-y-4">
              {loggedMeals.map((meal, mealIndex) => (
                <MealCard
                  key={mealIndex}
                  meal={meal}
                  mealIndex={mealIndex}
                  onRemove={removeMeal}
                  onSelectMeasurement={selectMeasurement}
                  onCustomGramInput={handleCustomGramInput}
                  onResetNutrition={resetToOriginalNutrition}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Meal Card Component
interface MealCardProps {
  meal: Meal;
  mealIndex: number;
  onRemove: (index: number) => void;
  onSelectMeasurement: (mealIndex: number, ingredientIndex: number, measureIndex: number, gramWeight: number) => void;
  onCustomGramInput: (mealIndex: number, ingredientIndex: number, customGrams: number) => void;
  onResetNutrition: (mealIndex: number, ingredientIndex: number) => void;
}

function MealCard({
  meal,
  mealIndex,
  onRemove,
  onSelectMeasurement,
  onCustomGramInput,
}: MealCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="mb-6">
      {/* Main Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header Section - Mobile Optimized */}
        <div className="bg-white p-4 sm:p-6">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              <Image 
                src="/icon.jpeg" 
                alt="Meal icon"
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Title and Subtitle */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-0.5">
                {meal.meal_name}
              </h3>
              <p className="text-sm sm:text-base text-gray-500">
                Medium Size
              </p>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => onRemove(mealIndex)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Remove meal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mb-3"></div>

        {/* Nutrition Grid - Mobile Optimized */}
        <div className="bg-white px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="grid grid-cols-4 gap-3 sm:gap-6">
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm mb-2">
                Calories
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.calories)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm  mb-2">
                Protein (g)
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.protein)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm  mb-2">
                Carbs (g)
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.carbs)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs sm:text-sm  mb-2">
                Fat (g)
              </div>
              <div className="text-sm lg:text-2xl font-bold text-gray-900">
                {Math.round(meal.total_nutrients.fat)}
              </div>
            </div>
          </div>
        </div>
      </div>
    

      {/* Ingredients Breakdown - Collapsible Accordion */}
      {showBreakdown && (
        <div className="bg-gray-50 px-6 sm:px-8 py-4 sm:py-6 rounded-b-2xl">
          <div className="space-y-6">
            {meal.ingredients.map((ingredient, ingredientIndex) => (
              <div key={ingredientIndex}>
                {/* Ingredient Header */}
                <h5 className="text-sm sm:text-base text-gray-500 mb-2">
                  {ingredient.name} ({ingredient.serving_info})
                </h5>

                {/* Ingredient Nutrition Grid */}
                <div className="grid grid-cols-4 gap-3 sm:gap-6">
                  <div className="text-center">
                    <div className="text-sm lg:text-2xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.calories)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm lg:text-2xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.protein)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm lg:text-2xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.carbs)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm lg:text-2xl font-bold text-gray-900">
                      {Math.round(ingredient.nutrients.fat)}
                    </div>
                  </div>
                </div>

                {/* Measurement Options */}
                <IngredientMeasurements
                  ingredient={ingredient}
                  mealIndex={mealIndex}
                  ingredientIndex={ingredientIndex}
                  onSelectMeasurement={onSelectMeasurement}
                  onCustomGramInput={onCustomGramInput}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown Toggle Button - Always at the End, Outside Card */}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          {showBreakdown ? "- Hide Breakdown" : "+ Show Breakdown"}
        </button>
      </div>
    </div>
  );
}


// Ingredient Measurements Component
interface IngredientMeasurementsProps {
  ingredient: Ingredient;
  mealIndex: number;
  ingredientIndex: number;
  onSelectMeasurement: (mealIndex: number, ingredientIndex: number, measureIndex: number, gramWeight: number) => void;
  onCustomGramInput: (mealIndex: number, ingredientIndex: number, customGrams: number) => void;
}

function IngredientMeasurements({
}: IngredientMeasurementsProps) {


  return (
    <div className="space-y-3">
      {/* Ingredients */}
    </div>
  );
}