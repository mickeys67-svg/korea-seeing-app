const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = "AIzaSyCeM5ZB8lAPUUW4mj9uvyyvqKgnUHCku2Y";
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // The SDK might have changed. Let's try getting a simple model first.
        console.log("TESTING models/gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("SUCCESS:", result.response.text());
    } catch (e) {
        console.error("TEST FAILED:", e.message);
    }
}

listModels();
