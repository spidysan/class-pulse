import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load environment variables from server/.env (force override system env)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env'), override: true });

// Force-read key from .env file to override any system env var
let GEMINI_API_KEY_FROM_FILE = null;
try {
  const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
  const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
  if (match) GEMINI_API_KEY_FROM_FILE = match[1].trim();
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ─── Configuration ───────────────────────────────────────────────
const GEMINI_API_KEY = GEMINI_API_KEY_FROM_FILE || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma2:2b';

console.log(`[Server] GEMINI_API_KEY is ${GEMINI_API_KEY ? 'SET (' + GEMINI_API_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
console.log(`[Server] Ollama fallback: ${OLLAMA_BASE_URL} with model "${OLLAMA_MODEL}"`);
console.log(`[Server] AI Priority: Gemini → Ollama → Mock`);

// ─── Robust JSON Extraction ─────────────────────────────────────
function extractJsonArray(text) {
  // Direct parse
  try { return JSON.parse(text.trim()); } catch (e) {}
  // Extract from ```json ``` blocks
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch (e) {}
  }
  // Find first [ and last ]
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.substring(start, end + 1).trim()); } catch (e) {}
  }
  throw new Error('Failed to extract valid JSON array from AI response');
}

// ─── AI Provider Functions ───────────────────────────────────────

// 1. Gemini API call
async function callGemini(prompt, jsonMode = false) {
  if (!GEMINI_API_KEY) throw new Error('No Gemini API key configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  if (jsonMode) {
    body.generationConfig = { responseMimeType: 'application/json' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

// 2. Ollama local API call
async function callOllama(prompt) {
  console.log(`[Ollama] Calling ${OLLAMA_MODEL} at ${OLLAMA_BASE_URL}...`);
  
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 4096
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  if (!data.response) throw new Error('Ollama returned empty response');
  
  console.log(`[Ollama] Response received (${data.response.length} chars, ${((data.total_duration || 0) / 1e9).toFixed(1)}s)`);
  return data.response;
}

// 3. Unified AI call with fallback chain: Gemini → Ollama → throw
async function callAI(prompt, jsonMode = false) {
  // Try Gemini first
  try {
    const result = await callGemini(prompt, jsonMode);
    console.log('[AI] ✅ Gemini succeeded');
    return { text: result, provider: 'gemini' };
  } catch (geminiErr) {
    console.warn(`[AI] ⚠️ Gemini failed: ${geminiErr.message}`);
  }

  // Fallback to Ollama
  try {
    const result = await callOllama(prompt);
    console.log('[AI] ✅ Ollama fallback succeeded');
    return { text: result, provider: 'ollama' };
  } catch (ollamaErr) {
    console.warn(`[AI] ⚠️ Ollama failed: ${ollamaErr.message}`);
  }

  // Both failed
  throw new Error('All AI providers failed (Gemini + Ollama)');
}

// ─── Health Check Endpoint ───────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const checks = {
    server: true,
    ai_priority: 'Gemini → Ollama → Mock',
    gemini: { key_set: !!GEMINI_API_KEY, model: GEMINI_MODEL, reachable: false },
    ollama: { url: OLLAMA_BASE_URL, model: OLLAMA_MODEL, reachable: false }
  };

  // Test Gemini
  if (GEMINI_API_KEY) {
    try {
      const text = await callGemini('Say "hello" in one word. Reply with just the word.');
      checks.gemini.reachable = true;
      checks.gemini.test = text.substring(0, 30);
    } catch (e) {
      checks.gemini.error = e.message.substring(0, 150);
    }
  }

  // Test Ollama
  try {
    const text = await callOllama('Say "hello" in one word. Reply with just the word.');
    checks.ollama.reachable = true;
    checks.ollama.test = text.substring(0, 30);
  } catch (e) {
    checks.ollama.error = e.message.substring(0, 150);
  }

  res.json(checks);
});

// ─── Generate Questions Endpoint ─────────────────────────────────
app.post('/api/generate-questions', async (req, res) => {
  const { transcript, numQuestions } = req.body;
  const count = numQuestions || 5;

  console.log(`\n[API] Generate ${count} questions from ${transcript?.length || 0} chars`);

  if (!transcript || transcript.trim().length === 0) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const prompt = `You are an exam question generator for college students. Based on the following lecture transcript, generate exactly ${count} multiple choice questions.

RULES:
- Each question must have exactly 4 options labeled A, B, C, D
- Only ONE correct answer per question
- Questions must test conceptual understanding, NOT memorization
- Return ONLY a valid JSON array, no other text

FORMAT (return exactly this structure):
[
  {
    "question_text": "What is the primary purpose of...",
    "options": ["A) option one", "B) option two", "C) option three", "D) option four"],
    "correct_answer": "A"
  }
]

TRANSCRIPT:
${transcript}`;

  try {
    const { text, provider } = await callAI(prompt, true);
    const questions = extractJsonArray(text);
    
    // Validate structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('AI returned invalid question array');
    }
    
    console.log(`[API] ✅ ${questions.length} questions generated via ${provider}`);
    res.json({ questions, mocked: false, provider });
  } catch (error) {
    console.error(`[API] ❌ All AI failed, serving mock questions: ${error.message}`);
    const mockQuestions = generateMockQuestions(transcript, count);
    res.json({ questions: mockQuestions, mocked: true, error: error.message });
  }
});

// ─── Summarize Lecture Endpoint ──────────────────────────────────
app.post('/api/summarize-lecture', async (req, res) => {
  const { transcript, className, subject } = req.body;
  const cleanTranscript = transcript ? transcript.trim() : '';

  console.log(`\n[API] Summarize transcript of ${cleanTranscript.length} chars (Class: ${className}, Subject: ${subject})`);

  let prompt;
  if (cleanTranscript.length < 10) {
    prompt = `Generate a beautiful, comprehensive, and realistic college lecture summary for the class "${className || 'Computer Science'}" (Subject: "${subject || 'CS101'}"). 
    Cover the key concepts, definitions, and topics usually taught in this class in clear bullet points. Keep it concise, structured, and exam-focused. Do not output intro/outro. Use markdown formatting with bullet points.`;
  } else {
    prompt = `Summarize the following college lecture transcript into clear bullet points covering all key concepts, definitions, and important points a student must remember. Keep it concise, structured, and exam-focused. Do not output intro/outro. Use markdown formatting with bullet points.

TRANSCRIPT:
${cleanTranscript}`;
  }

  try {
    const { text, provider } = await callAI(prompt);
    console.log(`[API] ✅ Summary generated via ${provider}`);
    res.json({ summary: text, mocked: false, provider });
  } catch (error) {
    console.error(`[API] ❌ All AI failed, serving mock summary: ${error.message}`);
    const mockSummary = generateMockSummary(cleanTranscript, className, subject);
    res.json({ summary: mockSummary, mocked: true, error: error.message });
  }
});

// ─── Mock Fallback Helpers ───────────────────────────────────────
function generateMockQuestions(transcript, count) {
  const lowercase = transcript.toLowerCase();
  
  let topic = "General Computer Science";
  if (lowercase.includes("database") || lowercase.includes("supabase") || lowercase.includes("sql")) {
    topic = "Database Management Systems (SQL & Supabase)";
  } else if (lowercase.includes("react") || lowercase.includes("component") || lowercase.includes("hooks")) {
    topic = "React & Frontend Web Development";
  } else if (lowercase.includes("security") || lowercase.includes("cheat") || lowercase.includes("prevent")) {
    topic = "Web Security & Anti-Cheat Architectures";
  } else if (lowercase.includes("network") || lowercase.includes("http") || lowercase.includes("dns")) {
    topic = "Computer Networks & Web Protocols";
  }

  const pool = [
    {
      question_text: `Based on the lecture topics of ${topic}, what is the main purpose of partitioning or modular components?`,
      options: [
        "A) To improve execution performance through concurrent thread allocations.",
        "B) To decouple application logic, making code reusable and easier to maintain.",
        "C) To secure client-side API requests from cross-site scripting bypasses.",
        "D) To reduce the number of queries executing on the server."
      ],
      correct_answer: "B"
    },
    {
      question_text: `In the context of ${topic}, which of the following best describes Row Level Security (RLS)?`,
      options: [
        "A) A database-level access control mechanism that limits table records returned based on the executing user context.",
        "B) A browser-side firewall that blocks third-party scripts from reading DOM elements.",
        "C) An encryption key protocol utilized to transmit variables in HTTPS handshakes.",
        "D) A CSS property restricting text highlights and cursor select commands."
      ],
      correct_answer: "A"
    },
    {
      question_text: `Why might we choose an asynchronous state loop over synchronous execution in ${topic}?`,
      options: [
        "A) To block the event loop and ensure operations run sequentially without CPU interruptions.",
        "B) To support responsive user interfaces by processing non-blocking background tasks.",
        "C) To increase database indexing efficiency.",
        "D) To enforce anti-copy selection filters."
      ],
      correct_answer: "B"
    },
    {
      question_text: `In modern architectures related to ${topic}, which method is preferred to distribute live state broadcasts to client nodes?`,
      options: [
        "A) Periodic browser polling every 500 milliseconds via standard fetch requests.",
        "B) Storing state updates in local cookies and reading them periodically.",
        "C) Real-time subscriptions over WebSockets (e.g. Supabase Realtime).",
        "D) Triggering document refreshes through the window.location API."
      ],
      correct_answer: "C"
    },
    {
      question_text: `What is the significance of the "noise texture" in Canvas-rendered anti-cheat systems?`,
      options: [
        "A) It speeds up the rendering cycles of the HTML5 canvas.",
        "B) It adds visual complexity that disrupts OCR (Optical Character Recognition) crawlers.",
        "C) It encrypts the canvas pixels using symmetric key tokens.",
        "D) It allows users to copy-paste the text using native cursor drag events."
      ],
      correct_answer: "B"
    },
    {
      question_text: `Which event can be captured by the DOM API to detect when a student navigates away from an active assessment tab?`,
      options: [
        "A) onsubmit event on the form component.",
        "B) visibilitychange event on the document, and blur event on the window.",
        "C) contextmenu event on the canvas wrapper.",
        "D) keydown event for keyboard copy shortcuts."
      ],
      correct_answer: "B"
    },
    {
      question_text: `Why are LLM API requests typically run via a backend proxy rather than directly from a client browser?`,
      options: [
        "A) To bypass browser CORS security policies and keep API private keys concealed.",
        "B) Because the browser sandbox restricts JSON string parsing.",
        "C) To compress text lengths before transmission to reduce bandwidth costs.",
        "D) To translate transcripts into multiple languages before processing."
      ],
      correct_answer: "A"
    },
    {
      question_text: `When generating MCQ questions from a live transcript, what type of questions test conceptual knowledge rather than recall?`,
      options: [
        "A) Direct definition match questions.",
        "B) Application-based scenarios requiring analysis of concepts.",
        "C) Chronological ordering of transcript sentences.",
        "D) Word-for-word fill-in-the-blanks."
      ],
      correct_answer: "B"
    },
    {
      question_text: `In a client-server setup, what role does a Supabase database trigger play upon new auth registrations?`,
      options: [
        "A) It verifies the student's college enrollment files.",
        "B) It automatically synchronizes the new auth record into the public profiles/users table.",
        "C) It blocks unauthorized IP addresses from visiting the dashboard.",
        "D) It generates custom quiz tokens."
      ],
      correct_answer: "B"
    },
    {
      question_text: `What is the default duration for questions in ClassPulse live sessions?`,
      options: [
        "A) 5 seconds.",
        "B) 15 seconds.",
        "C) 30 seconds.",
        "D) 60 seconds."
      ],
      correct_answer: "B"
    }
  ];

  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateMockSummary(transcript, className, subject) {
  const cleanTranscript = transcript || '';
  const cName = (className || '').toLowerCase();
  const cSubject = (subject || '').toLowerCase();

  let details = '';
  if (cName.includes('data structure') || cName.includes('algorithm') || cSubject.includes('cs201') || cSubject.includes('ds')) {
    details = `### 📚 Lecture Summary (Data Structures & Algorithms)\n\nCovered the core concepts of tree structures, self-balancing mechanics, and search efficiencies.\n\n* **Binary Search Trees (BST)**:\n  - Properties: Nodes in the left subtree have values less than the parent; nodes in the right subtree have values greater.\n  - Search Efficiency: O(log n) in balanced scenarios, decaying to O(n) in worst-case skewed structures.\n* **Self-Balancing Solutions (AVL & Red-Black Trees)**:\n  - AVL Trees enforce strict balance factor limits of at most 1, triggering rotations (Single/Double) to maintain depth.\n  - Red-Black Trees utilize node coloring (Red/Black) and rule structures to guarantee O(log n) worst-case lookups.\n* **Heap Sort & Priority Queues**:\n  - Max-Heap structures maintain parent keys larger than children.\n  - Building a heap takes O(n) complexity. Extracting max elements consecutively builds a sorted list in O(n log n).\n  - In-place sorting mechanism, but is not stable.`;
  } else if (cName.includes('machine learning') || cName.includes('ml') || cSubject.includes('cs401')) {
    details = `### 📚 Lecture Summary (Machine Learning Fundamentals)\n\nExplored the mathematical foundations, loss minimization, and architectures of classification systems.\n\n* **Supervised vs. Unsupervised Learning**:\n  - Supervised learning maps input-output pairs from labeled training datasets.\n  - Unsupervised algorithms seek hidden structures and distributions in unlabeled contexts (e.g. K-Means clustering).\n* **Loss Functions & Gradient Descent**:\n  - Mean Squared Error (MSE) used for regression tasks to measure variance.\n  - Gradient Descent iteratively shifts parameters in the negative direction of the loss gradient to locate global minima.\n* **Neural Network Foundations**:\n  - Input layer feeds activation values to hidden layers via weight vectors and bias additions.\n  - Non-linear activation functions (ReLU, Sigmoid, tanh) enable networks to fit complex boundaries and functions.`;
  } else {
    details = `### 📚 Lecture Summary (${className || 'General Science'})\n\nCovered the core topics, terminology, and methodologies of the subject.\n\n* **Main Concepts Covered**:\n  - Explored structural elements, components, and interactions.\n  - Addressed efficiency parameters and potential failure modes.\n* **Key Takeaways**:\n  - Modular architectures reduce runtime dependencies and simplify updates.\n  - Verified inputs prevent validation errors and logic escapes.`;
  }

  if (cleanTranscript.length > 10) {
    details += `\n\n*Note: Fallback summary active. Original transcript size: ${cleanTranscript.length} characters.*`;
  }
  return details;
}

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] 🚀 ClassPulse proxy running on http://localhost:${PORT}`);
  console.log(`[Server] AI chain: Gemini (${GEMINI_MODEL}) → Ollama (${OLLAMA_MODEL}) → Mock`);
});
