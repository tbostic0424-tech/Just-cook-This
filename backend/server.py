from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'just_cook_this')]

# Get Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models for Just Cook This
class UserPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    allergies: List[str] = []
    dislikes: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserPreferencesCreate(BaseModel):
    allergies: List[str] = []
    dislikes: List[str] = []

class IngredientAdd(BaseModel):
    ingredient: str

class KitchenInventory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    ingredients: List[str] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MealStep(BaseModel):
    step_number: int
    duration_minutes: int
    instruction: str

class Meal(BaseModel):
    meal_name: str
    description: str
    total_time: int
    servings: int
    ingredients: List[str]
    steps: List[MealStep]

class DailyMealRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    date: str  # YYYY-MM-DD format
    regeneration_count: int = 0
    meals_generated: List[Meal] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Helper function to generate meal with AI
async def generate_meal_with_ai(user_id: str, inventory: Optional[List[str]] = None):
    # Get user preferences
    prefs = await db.user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    
    allergies = prefs.get("allergies", []) if prefs else []
    dislikes = prefs.get("dislikes", []) if prefs else []
    
    # Build the prompt
    system_message = """You are a helpful cooking assistant. Generate a single dinner recipe that:
- Is realistic and achievable for home cooks
- Has clear 10-minute step breakdowns
- Includes common, accessible ingredients
- Takes 20-45 minutes total cooking time
- Serves 2-4 people

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "meal_name": "Recipe Name",
  "description": "Brief appetizing description",
  "total_time": 30,
  "servings": 4,
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": [
    {"step_number": 1, "duration_minutes": 10, "instruction": "Detailed instruction for first 10 minutes"},
    {"step_number": 2, "duration_minutes": 10, "instruction": "Detailed instruction for next 10 minutes"}
  ]
}"""
    
    user_prompt = "Generate a delicious, easy-to-make dinner recipe."
    
    if allergies:
        user_prompt += f"\n\nIMPORTANT - User is allergic to: {', '.join(allergies)}. DO NOT include these ingredients."
    
    if dislikes:
        user_prompt += f"\n\nUser dislikes: {', '.join(dislikes)}. Avoid these if possible."
    
    # Only add inventory consideration if user has actually added ingredients
    if inventory and len(inventory) > 0:
        user_prompt += f"\n\nBONUS: User has these ingredients available: {', '.join(inventory)}. Try to incorporate some of these if it makes sense, but it's not required."
    
    user_prompt += "\n\nGenerate ONE creative, delicious dinner recipe now. Respond with valid JSON only."
    
    # Call AI
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"meal-gen-{user_id}-{datetime.now().isoformat()}",
        system_message=system_message
    ).with_model("openai", "gpt-5.2")
    
    user_message = UserMessage(text=user_prompt)
    response = await chat.send_message(user_message)
    
    # Parse response - handle potential markdown wrapping
    import json
    response_text = response.strip()
    
    # Remove markdown code blocks if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])
        if response_text.startswith("json"):
            response_text = response_text[4:].strip()
    
    meal_data = json.loads(response_text)
    return Meal(**meal_data)


# Routes for Just Cook This
@api_router.post("/cook/onboard")
async def onboard_user(prefs: UserPreferencesCreate):
    """Save user preferences (allergies, dislikes) on first use"""
    user_id = str(uuid.uuid4())  # Generate new user ID
    
    user_prefs = UserPreferences(
        user_id=user_id,
        allergies=prefs.allergies,
        dislikes=prefs.dislikes
    )
    
    doc = user_prefs.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.user_preferences.insert_one(doc)
    
    return {"user_id": user_id, "message": "Preferences saved!"}


@api_router.get("/cook/meal/{user_id}")
async def get_daily_meal(user_id: str):
    """Get today's meal for the user"""
    today = date.today().isoformat()
    
    # Check if user already has a meal for today
    daily_record = await db.daily_meals.find_one(
        {"user_id": user_id, "date": today}, 
        {"_id": 0}
    )
    
    if daily_record and daily_record.get("meals_generated"):
        # Return the last generated meal
        meals = daily_record["meals_generated"]
        return {
            "meal": meals[-1],
            "regenerations_left": 2 - daily_record.get("regeneration_count", 0),
            "can_regenerate": daily_record.get("regeneration_count", 0) < 2
        }
    
    # Generate first meal of the day
    inventory_doc = await db.kitchen_inventory.find_one({"user_id": user_id}, {"_id": 0})
    inventory = inventory_doc.get("ingredients", []) if inventory_doc else None
    
    meal = await generate_meal_with_ai(user_id, inventory)
    
    # Save to database
    daily_record = DailyMealRecord(
        user_id=user_id,
        date=today,
        regeneration_count=0,
        meals_generated=[meal]
    )
    
    doc = daily_record.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.daily_meals.insert_one(doc)
    
    return {
        "meal": meal.model_dump(),
        "regenerations_left": 2,
        "can_regenerate": True
    }


@api_router.post("/cook/regenerate/{user_id}")
async def regenerate_meal(user_id: str):
    """Regenerate a new meal (max 2 times per day for free users)"""
    today = date.today().isoformat()
    
    # Get today's record
    daily_record = await db.daily_meals.find_one({"user_id": user_id, "date": today})
    
    if not daily_record:
        raise HTTPException(status_code=404, detail="No meal record found for today")
    
    regen_count = daily_record.get("regeneration_count", 0)
    
    if regen_count >= 2:
        raise HTTPException(status_code=403, detail="Daily regeneration limit reached. Upgrade to Pro for unlimited!")
    
    # Generate new meal
    inventory_doc = await db.kitchen_inventory.find_one({"user_id": user_id}, {"_id": 0})
    inventory = inventory_doc.get("ingredients", []) if inventory_doc else None
    
    new_meal = await generate_meal_with_ai(user_id, inventory)
    
    # Update database
    meals = daily_record.get("meals_generated", [])
    meals.append(new_meal.model_dump())
    
    await db.daily_meals.update_one(
        {"user_id": user_id, "date": today},
        {
            "$set": {
                "meals_generated": meals,
                "regeneration_count": regen_count + 1
            }
        }
    )
    
    return {
        "meal": new_meal.model_dump(),
        "regenerations_left": 1 - regen_count,
        "can_regenerate": (regen_count + 1) < 2
    }


@api_router.get("/cook/inventory/{user_id}")
async def get_inventory(user_id: str):
    """Get user's kitchen inventory"""
    inventory = await db.kitchen_inventory.find_one({"user_id": user_id}, {"_id": 0})
    
    if not inventory:
        return {"user_id": user_id, "ingredients": []}
    
    return inventory


@api_router.post("/cook/inventory/{user_id}")
async def add_ingredient(user_id: str, item: IngredientAdd):
    """Add ingredient to kitchen inventory"""
    inventory = await db.kitchen_inventory.find_one({"user_id": user_id})
    
    if inventory:
        # Update existing
        ingredients = inventory.get("ingredients", [])
        if item.ingredient not in ingredients:
            ingredients.append(item.ingredient)
        
        await db.kitchen_inventory.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "ingredients": ingredients,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    else:
        # Create new
        new_inventory = KitchenInventory(
            user_id=user_id,
            ingredients=[item.ingredient]
        )
        doc = new_inventory.model_dump()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.kitchen_inventory.insert_one(doc)
    
    return {"message": "Ingredient added", "ingredient": item.ingredient}


@api_router.delete("/cook/inventory/{user_id}/{ingredient}")
async def remove_ingredient(user_id: str, ingredient: str):
    """Remove ingredient from kitchen inventory"""
    inventory = await db.kitchen_inventory.find_one({"user_id": user_id})
    
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    
    ingredients = inventory.get("ingredients", [])
    if ingredient in ingredients:
        ingredients.remove(ingredient)
    
    await db.kitchen_inventory.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "ingredients": ingredients,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Ingredient removed", "ingredient": ingredient}


# Include the router in the main app
app.include_router(api_router)
