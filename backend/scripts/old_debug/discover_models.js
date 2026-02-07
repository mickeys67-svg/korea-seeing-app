const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = "AIzaSyCeM5ZB8lAPUUW4mj9uvyyvqKgnUHCku2Y";
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const list = await genAI.listModels();
        console.log("AVAILABLE MODELS:");
        list.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
    } catch (e) {
        console.error("FATAL ERROR:", e.message);
    }
}

listModels();
