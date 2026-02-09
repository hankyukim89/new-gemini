
const { GoogleGenerativeAI } = require("@google/generative-ai");

// You must provide the API key as argument
const apiKey = process.argv[2];

if (!apiKey) {
    console.error("Please provide API key as argument");
    process.exit(1);
}

// Although we import the lib, for raw listing let's just use fetch if available, or https
// Node 18+ has fetch.
async function listModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        console.log(`Fetching from: ${url.replace(apiKey, 'API_KEY')}`);

        const response = await fetch(url);
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${txt}`);
        }
        const data = await response.json();

        console.log("--- AVAILABLE GUIDS (v1beta) ---");
        if (!data.models) {
            console.log("No models found in response:", data);
            return;
        }

        const models = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => ({
                id: m.name.replace('models/', ''),
                displayName: m.displayName
            }));

        console.log(JSON.stringify(models, null, 2));

    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
