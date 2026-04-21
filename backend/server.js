import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
const upload = multer();

// 🎤 TRANSCRIBE
import FormData from "form-data";

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: "audio.webm",
      contentType: "audio/webm",
    });

    formData.append("model", "whisper-large-v3");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          ...formData.getHeaders(), // 🔥 VERY IMPORTANT
        },
      },
    );

    res.json({ text: response.data.text });
  } catch (err) {
    console.error("TRANSCRIBE ERROR:", err.response?.data || err.message);

    res.status(500).json({
      error: "Transcription failed",
      details: err.response?.data || err.message,
    });
  }
});

// 💡 SUGGESTIONS
app.post("/suggestions", async (req, res) => {
  try {
    let transcript = [];

    if (req.body && req.body.transcript) {
      transcript = req.body.transcript;
    } else {
      try {
        const raw = await new Promise((resolve) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => resolve(data));
        });

        const parsed = JSON.parse(raw || "{}");
        transcript = parsed.transcript || [];
      } catch (e) {
        console.log("RAW BODY FAIL");
      }
    }

    const context = transcript.slice(-10).join("\n");

    const prompt = `
You are a real-time AI meeting assistant.

Based ONLY on the transcript below, generate EXACTLY 3 useful suggestions.

Transcript:
${context}

Rules:
- Return EXACTLY 3 lines
- Each line must be UNIQUE (no repetition)
- Do NOT repeat phrases or ideas
- Do NOT include labels like "question", "insight", etc.
- Each line must be directly grounded in the transcript (no assumptions)
- Keep each line under 18 words
- Make suggestions practical and context-aware

Each line should be one of:
- A smart follow-up question
- A useful insight based on what was said
- A clarification or fact-check relevant to the discussion

Return only the 3 lines. No extra text.
`;
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Accept-Encoding": "gzip, deflate",
        },
      },
    );

    let text = response.data.choices[0].message.content;

    console.log("MODEL RAW:", text); // 🔥 DEBUG

    // 🔥 FORCE SAFE ARRAY
    let lines = text
      .split("\n")
      .map((l) => l.replace(/^[0-9.\-\)\s]+/, "").trim())
      .filter((l) => l.length > 0);
      // remove duplicate lines
lines = [...new Set(lines)];
    // ✅ GUARANTEE ARRAY
    if (!Array.isArray(lines) || lines.length === 0) {
      lines = ["No suggestions available"];
    }

    // ✅ FORCE EXACT 3
    while (lines.length < 3) {
      lines.push("...");
    }

    lines = lines.slice(0, 3);

    res.json(lines); // ✅ ALWAYS ARRAY
  } catch (err) {
    console.error("SUGGESTION ERROR:", err.response?.data || err.message);

    res.json(["Error", "Error", "Error"]); // ✅ NEVER OBJECT
  }
});
// 💬 CHAT
app.post("/chat", async (req, res) => {
  try {
    const { question, transcript } = req.body;

    // ✅ VALIDATION (IMPORTANT)
    if (!question || !transcript || transcript.length === 0) {
      return res.status(400).json({
        error: "Missing question or transcript",
      });
    }

    const context = transcript.join("\n");

    const prompt = `
You are an executive AI assistant.

Use this transcript:

${context}

Answer this question:

${question}

Rules:
- Max 120 words
- Clear and professional
- Use bullet points if helpful
- No unnecessary explanation
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Accept-Encoding": "gzip, deflate",
        },
      },
    );

    const answer = response.data.choices[0].message.content;

    res.send(answer);
  } catch (err) {
    console.error("CHAT ERROR:", err.response?.data || err.message);

    res.status(500).send("Error generating response");
  }
});

app.listen(5000, () => console.log("Server running"));
