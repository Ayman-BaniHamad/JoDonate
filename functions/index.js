const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// Your allowed categories (must match app categories)
const ALLOWED = ["Books", "Furniture", "Clothes", "Electronics", "Accessories", "Plants"];

function pickFallbackCategory() {
  // Safe default; you can change to "Accessories" or "Furniture"
  return "Accessories";
}

exports.categorizeItemFromImage = onCall(
  { cors: true, secrets: [OPENAI_API_KEY] },
  async (req) => {
    const { imageUrl } = req.data || {};
    if (!imageUrl) {
      throw new Error("Missing imageUrl");
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    try {
      const prompt =
        "Classify the item in the image into exactly ONE category from: " +
        ALLOWED.join(", ") +
        ". Return ONLY the category name. No extra words.";

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an image classifier for a donation app." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0,
      });

      const raw = (response.choices?.[0]?.message?.content || "").trim();

      const category = ALLOWED.includes(raw) ? raw : pickFallbackCategory();

      return {
        category,
        aiUsed: true,
        note: "OpenAI categorization succeeded",
      };
    } catch (err) {
      // Fallback mode (quota / network / any error)
      const fallback = pickFallbackCategory();

      return {
        category: fallback,
        aiUsed: false,
        note: "Fallback used (OpenAI unavailable / quota)",
      };
    }
  }
);
