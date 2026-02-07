const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = "AIzaSyCeM5ZB8lAPUUW4mj9uvyyvqKgnUHCku2Y";
const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-pro",
    "gemini-1.0-pro",
    "models/gemini-1.5-flash"
];

async function testModel(modelName) {
    console.log(`\n--- Testing ${modelName} ---`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello", { timeout: 5000 });
        const response = await result.response;
        console.log(`SUCCESS! Response: ${response.text()}`);
        return true;
    } catch (error) {
        console.error(`FAILED:`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`StatusText: ${error.response.statusText}`);
        }
        console.error(`Message: ${error.message}`);
        // Log generic error details if available
        if (error.statusDetails) {
            console.error('Details:', JSON.stringify(error.statusDetails, null, 2));
        }
        return false;
    }
}

async function runDiagnostics() {
    console.log(`Starting diagnostics for API Key: ${apiKey.substring(0, 8)}...`);

    let workingModel = null;

    for (const m of modelsToTest) {
        const success = await testModel(m);
        if (success) {
            workingModel = m;
            break;
        }
    }

    if (workingModel) {
        console.log(`\n✅ DIAGNOSIS COMPLETE: The working model is "${workingModel}".`);
        console.log(`PLEASE UPDATE YOUR CODE TO USE: "${workingModel}"`);
    } else {
        console.log(`\n❌ DIAGNOSIS FAILED: No models worked. Check API Key validity or billing/quota status.`);
    }
}

runDiagnostics();
