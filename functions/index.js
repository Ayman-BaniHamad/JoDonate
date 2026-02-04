// Import Firebase Functions v2 callable HTTPS function helper
const { onCall, HttpsError } = require("firebase-functions/v2/https");

// Import "defineSecret" so we can safely read secrets (API keys) from Firebase
const { defineSecret } = require("firebase-functions/params");

// Import OpenAI SDK
const OpenAI = require("openai");

// Define a secret called OPENAI_API_KEY (must be set in Firebase)
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Allowed categories (MUST match your app categories exactly)
const ALLOWED = ["Books", "Furniture", "Clothes", "Electronics", "Accessories", "Plants"];

// If AI fails or returns something unexpected, we return a safe default
function pickFallbackCategory() {
  return "Accessories";
}

// Export a callable function named "categorizeItemFromImage"
// Your app calls it using httpsCallable(functions, "categorizeItemFromImage")
exports.categorizeItemFromImage = onCall(
  {
    cors: true, // allow requests from your app
    secrets: [OPENAI_API_KEY], // give the function access to the secret at runtime
  },
  async (request) => {
    // Extract imageUrl from request data
    const { imageUrl } = request.data || {};

    // Validate input (if missing, throw a proper Firebase callable error)
    if (!imageUrl || typeof imageUrl !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid imageUrl");
    }

    // Create OpenAI client using the secret value
    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    try {
      // Build a strict prompt: only return one category
      const prompt =
        "Classify the item in the image into exactly ONE category from: " +
        ALLOWED.join(", ") +
        ". Return ONLY the category name. No extra words.";

      // Call OpenAI Chat Completions (vision + text)
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini", // vision-capable model
        messages: [
          { role: "system", content: "You are an image classifier for a donation app." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt }, // prompt text
              { type: "image_url", image_url: { url: imageUrl } }, // image URL
            ],
          },
        ],
        temperature: 0, // deterministic
      });

      // Read model output safely
      const raw = (response.choices?.[0]?.message?.content || "").trim();

      // Clean output (sometimes models add quotes or punctuation)
      const cleaned = raw.replace(/["'.]/g, "").trim();

      // Accept only allowed categories
      const category = ALLOWED.includes(cleaned) ? cleaned : pickFallbackCategory();

      // Return to the app
      return {
        category,
        aiUsed: true,
        note: "OpenAI categorization succeeded",
      };
    } catch (err) {
      // If anything fails (quota/network/model), fall back safely
      const fallback = pickFallbackCategory();

      return {
        category: fallback,
        aiUsed: false,
        note: "Fallback used (OpenAI unavailable / quota)",
      };
    }
  }
);
/* The function of this file is to provide a Firebase Cloud Function that categorizes
an item based on its image URL using OpenAI's vision-capable model. 
It defines a callable function that the app can invoke, which processes the image, 
interacts with the OpenAI API to classify the item into predefined categories, 
and returns the category along with a note indicating whether AI was used or if a fallback category was applied. */