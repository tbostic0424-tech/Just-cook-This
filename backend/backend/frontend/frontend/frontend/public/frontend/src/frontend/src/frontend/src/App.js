📝 File 6: frontend/src/App.js
This is the complete React app! Copy all of this:

import { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
const API = `${BACKEND_URL}/api`;

// Onboarding Screen
const Onboarding = ({ onComplete }) => {
  const [allergies, setAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/cook/onboard`, {
        allergies: allergies.split(",").map(a => a.trim()).filter(a => a),
        dislikes: dislikes.split(",").map(d => d.trim()).filter(d => d)
      });
      
      localStorage.setItem("jct_user_id", response.data.user_id);
      onComplete();
    } catch (error) {
      console.error("Onboarding failed:", error);
      alert("Something went wrong. Please try again!");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-400 to-yellow-500 rounded-3xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform">
            <span className="text-5xl">🍳</span>
          </div>
          <h1 className="text-4xl font-black text-gray-800 mt-4 tracking-tight">
            Just Cook This
          </h1>
          <p className="text-gray-600 mt-2 font-medium">Dinner decisions made easy!</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🚨 Any food allergies?
            </label>
            <input
              type="text"
              placeholder="e.g., peanuts, shellfish (comma separated)"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none transition"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              😒 What do you hate eating?
            </label>
            <input
              type="text"
              placeholder="e.g., mushrooms, olives (comma separated)"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none transition"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-400 to-yellow-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transform hover:scale-105 transition disabled:opacity-50 disabled:scale-100 text-lg"
          >
            {loading ? "Setting up..." : "Let's Cook! 🚀"}
          </button>

          <p className="text-center text-xs text-gray-500">
            You can skip by leaving fields empty
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Meal Screen
const MealScreen = ({ userId }) => {
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerationsLeft, setRegenerationsLeft] = useState(2);
  const [canRegenerate, setCanRegenerate] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [cookingMode, setCookingMode] = useState(false);

  useEffect(() => {
    loadMeal();
  }, []);

  const loadMeal = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/cook/meal/${userId}`);
      setMeal(response.data.meal);
      setRegenerationsLeft(response.data.regenerations_left);
      setCanRegenerate(response.data.can_regenerate);
    } catch (error) {
      console.error("Failed to load meal:", error);
    }
    setLoading(false);
  };

  const handleRegenerate = async () => {
    if (!canRegenerate) {
      alert("You've used all your free regenerations today!");
      return;
    }

    setLoading(true);
    setCookingMode(false);
    setCurrentStep(0);
    
    try {
      const response = await axios.post(`${API}/cook/regenerate/${userId}`);
      setMeal(response.data.meal);
      setRegenerationsLeft(response.data.regenerations_left);
      setCanRegenerate(response.data.can_regenerate);
    } catch (error) {
      console.error("Failed to regenerate:", error);
      if (error.response?.status === 403) {
        alert("Daily limit reached!");
      }
    }
    setLoading(false);
  };

  const startCooking = () => {
    setCookingMode(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < meal.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍳</div>
          <p className="text-xl font-bold text-gray-700">Cooking up something delicious...</p>
        </div>
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-700">No meal found. Please refresh!</p>
        </div>
      </div>
    );
  }

  if (cookingMode) {
    const step = meal.steps[currentStep];
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-gray-800">{meal.meal_name}</h2>
                <p className="text-sm text-gray-600">Step {currentStep + 1} of {meal.steps.length}</p>
              </div>
              <button
                onClick={() => setCookingMode(false)}
                className="text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕ Exit
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-orange-100 px-4 py-2 rounded-full">
                <span className="font-bold text-orange-600">⏱️ {step.duration_minutes} minutes</span>
              </div>
              <div className="text-3xl">Step {step.step_number}</div>
            </div>

            <p className="text-xl leading-relaxed text-gray-700 mb-8">
              {step.instruction}
            </p>

            <div className="flex gap-4">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex-1 bg-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-300 disabled:opacity-30 transition"
              >
                ← Previous
              </button>
              
              {currentStep === meal.steps.length - 1 ? (
                <button
                  onClick={() => setCookingMode(false)}
                  className="flex-1 bg-gradient-to-r from-green-400 to-green-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transform hover:scale-105 transition"
                >
                  🎉 Done!
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  className="flex-1 bg-gradient-to-r from-orange-400 to-yellow-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transform hover:scale-105 transition"
                >
                  Next →
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-orange-400 to-yellow-500 h-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / meal.steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="inline-block bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <h1 className="text-2xl font-black text-gray-800">
              🍽️ Tonight's Dinner
            </h1>
          </div>
          <p className="text-gray-600">Your perfect meal is ready!</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-br from-orange-400 to-yellow-500 p-8 text-white">
            <h2 className="text-4xl font-black mb-3">{meal.meal_name}</h2>
            <p className="text-lg opacity-90 mb-4">{meal.description}</p>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="bg-white/20 px-4 py-2 rounded-full">⏱️ {meal.total_time} min</span>
              <span className="bg-white/20 px-4 py-2 rounded-full">👥 Serves {meal.servings}</span>
              <span className="bg-white/20 px-4 py-2 rounded-full">📝 {meal.steps.length} steps</span>
            </div>
          </div>

          <div className="p-8 border-b">
            <h3 className="text-xl font-bold text-gray-800 mb-4">🛒 Ingredients</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {meal.ingredients.map((ingredient, idx) => (
                <li key={idx} className="flex items-center gap-2 text-gray-700">
                  <span className="text-orange-400">•</span>
                  {ingredient}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">👨‍🍳 Cooking Steps</h3>
            <div className="space-y-3">
              {meal.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="bg-orange-100 text-orange-600 font-bold w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    {step.step_number}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700">
                      {step.duration_minutes} min - {step.instruction.substring(0, 80)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={startCooking}
            className="w-full bg-gradient-to-r from-orange-400 to-yellow-500 text-white font-black py-5 rounded-2xl hover:shadow-2xl transform hover:scale-105 transition text-xl"
          >
            🔥 Start Cooking!
          </button>

          <button
            onClick={handleRegenerate}
            disabled={!canRegenerate || loading}
            className="w-full bg-white text-gray-700 font-bold py-4 rounded-2xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canRegenerate 
              ? `🔄 Get Different Meal (${regenerationsLeft} left today)` 
              : "🔒 Daily limit reached"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Kitchen Inventory Screen
const InventoryScreen = ({ userId }) => {
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const response = await axios.get(`${API}/cook/inventory/${userId}`);
      setIngredients(response.data.ingredients || []);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    }
    setLoading(false);
  };

  const addIngredient = async () => {
    if (!newIngredient.trim()) return;

    try {
      await axios.post(`${API}/cook/inventory/${userId}`, {
        ingredient: newIngredient.trim()
      });
      setIngredients([...ingredients, newIngredient.trim()]);
      setNewIngredient("");
    } catch (error) {
      console.error("Failed to add ingredient:", error);
    }
  };

  const removeIngredient = async (ingredient) => {
    try {
      await axios.delete(`${API}/cook/inventory/${userId}/${encodeURIComponent(ingredient)}`);
      setIngredients(ingredients.filter(i => i !== ingredient));
    } catch (error) {
      console.error("Failed to remove ingredient:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="inline-block bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <h1 className="text-2xl font-black text-gray-800">
              🥬 My Kitchen
            </h1>
          </div>
          <p className="text-gray-600">Track what you have for better meal suggestions</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Add an ingredient..."
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addIngredient()}
            />
            <button
              onClick={addIngredient}
              className="bg-gradient-to-r from-orange-400 to-yellow-500 text-white font-bold px-6 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          {loading ? (
            <p className="text-center text-gray-500">Loading...</p>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">🍽️</div>
              <p className="text-gray-600 font-medium">Your kitchen is empty!</p>
              <p className="text-sm text-gray-400 mt-2">Add ingredients to get personalized meal suggestions</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ingredients.map((ingredient, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-orange-50 px-4 py-3 rounded-xl border border-orange-100"
                >
                  <span className="text-gray-700 font-medium">{ingredient}</span>
                  <button
                    onClick={() => removeIngredient(ingredient)}
                    className="text-red-400 hover:text-red-600 font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
          <p className="text-sm text-yellow-800">
            💡 <strong>Tip:</strong> Keep your inventory updated! The more we know about your kitchen, the better meal suggestions you'll get.
          </p>
        </div>
      </div>
    </div>
  );
};

// Bottom Navigation
const BottomNav = ({ activeTab, setActiveTab }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl">
      <div className="max-w-2xl mx-auto flex">
        <button
          onClick={() => setActiveTab("meal")}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition ${
            activeTab === "meal" 
              ? "text-orange-500 bg-orange-50" 
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-2xl">🍽️</span>
          <span className="text-xs font-bold">Today's Meal</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex-1 py-4 flex flex-col items-center gap-1 transition ${
            activeTab === "inventory" 
              ? "text-orange-500 bg-orange-50" 
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <span className="text-2xl">🥬</span>
          <span className="text-xs font-bold">My Kitchen</span>
        </button>
      </div>
    </div>
  );
};

// Main App
function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("meal");

  useEffect(() => {
    const storedUserId = localStorage.getItem("jct_user_id");
    if (storedUserId) {
      setUserId(storedUserId);
      setIsOnboarded(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    const storedUserId = localStorage.getItem("jct_user_id");
    setUserId(storedUserId);
    setIsOnboarded(true);
  };

  if (!isOnboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="App">
      {activeTab === "meal" ? (
        <MealScreen userId={userId} />
      ) : (
        <InventoryScreen userId={userId} />
      )}
      
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
