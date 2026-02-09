
const { GoogleGenerativeAI } = require("@google/generative-ai");

// You must provide the API key as an environment variable or argument
const apiKey = process.argv[2];

if (!apiKey) {
    console.error("Please provide API key as argument");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        // For v1beta, we can use the genAI.getGenerativeModel method to list 
        // Actually the SDK might not expose listModels directly on the main class easily in all versions.
        // Let's use the fetch implementation to be raw and accurate to what the browser does.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        console.log("--- AVAILABLE GUIDS (v1beta) ---");
        const models = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', ''));

        console.log(JSON.stringify(models, null, 2));

    } catch (error) {
        console.error("Error creating model:", error);
    }
}

listModels();
