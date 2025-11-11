import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { foodDescription } = await request.json();

    if (!foodDescription || !foodDescription.trim()) {
      return NextResponse.json(
        { error: 'Food description is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const prompt = `You are a nutrition expert. Analyze the following food description and return ONLY a valid JSON object (no markdown, no code blocks, no extra text) with this exact structure:

IMPORTANT RULES:
1. MEAL vs INGREDIENTS logic:
   - If items are part of a COMBO/DEAL/MEAL (like "Big Mac Meal", "Combo", "Deal", or items mentioned WITH each other using "with"): Create ONE meal with ALL items as ingredients
   - If items are SEPARATE/INDEPENDENT foods mentioned with "and" but NOT part of a combo: Create SEPARATE meals for each
   
2. Examples of ONE MEAL (items as ingredients):
   - "Big Mac deal" → 1 meal named "Big Mac Meal" with ingredients: Big Mac burger, fries, drink
   - "burger with fries and coke" → 1 meal with 3 ingredients
   - "chicken combo" → 1 meal with all combo items as ingredients
   - "pizza with wings" → 1 meal with 2 ingredients

3. Examples of SEPARATE MEALS:
   - "pizza and burger" → 2 separate meals (Pizza, Burger)
   - "I had chicken then later ate ice cream" → 2 separate meals
   - "breakfast was eggs, lunch was sandwich" → 2 separate meals

4. Calculate dailyTotals as the sum of all meals' nutrients.
5. YOU MUST PROVIDE REALISTIC NUTRITIONAL VALUES - DO NOT USE ZEROS! Use standard serving sizes and accurate calorie/macro estimates.

{
  "dailyTotals": {
    "calories": <sum of all meals>,
    "protein": <sum of all meals>,
    "carbs": <sum of all meals>,
    "fat": <sum of all meals>
  },
  "loggedMeals": [
    {
      "meal_name": "Meal Name",
      "meal_size": "Small/Medium/Large or specific size like '12 inch' or '6 pieces'",
      "total_nutrients": {
        "calories": <actual number>,
        "protein": <actual number in grams>,
        "carbs": <actual number in grams>,
        "fat": <actual number in grams>
      },
      "ingredients": [
        {
          "name": "Ingredient Name",
          "brand": "Brand Name or AI Generated",
          "serving_info": "1 serving (Xg)",
          "nutrients": {
            "calories": <actual number>,
            "protein": <actual number in grams>,
            "carbs": <actual number in grams>,
            "fat": <actual number in grams>
          },
          "foodMeasures": [],
          "selectedPortion": {
            "source": "ai_fallback"
          }
        }
      ]
    }
  ]
}

For a pizza slice: ~285 calories, 12g protein, 36g carbs, 10g fat
For a burger: ~540 calories, 25g protein, 40g carbs, 25g fat
For fries (medium): ~365 calories, 4g protein, 48g carbs, 17g fat
For a coke (medium): ~210 calories, 0g protein, 58g carbs, 0g fat

Food description: "${foodDescription}"

Return ONLY the JSON object with REAL nutritional values, nothing else.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a nutrition expert that returns ONLY valid JSON responses with no additional text or formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Failed to process food data");
    }

    const responseData = await response.json();
    const content = responseData.choices[0].message.content;
    
    // Log the exact GPT response to console
    console.log("=== GPT RESPONSE START ===");
    console.log(content);
    console.log("=== GPT RESPONSE END ===");
    
    // Parse and validate the JSON response
    const data = JSON.parse(content);

    if (!data.dailyTotals || !data.loggedMeals) {
      throw new Error("Invalid response format from AI. Please try again.");
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Error in analyze-food API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
