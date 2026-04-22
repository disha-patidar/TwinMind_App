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

    const context = transcript.slice(-8).join("\n");

    if (!context || context.length < 20) {
      return res.json([
        "Waiting for more conversation context...",
        "Please continue speaking for better suggestions.",
        "More details needed to generate useful suggestions.",
      ]);
    }
    //     const prompt = `
    // You are a real-time AI meeting assistant.

    // Based ONLY on the transcript below, generate EXACTLY 3 suggestions.

    // Transcript:
    // ${context}

    // STRICT RULES:
    // - No hallucination
    // - No assumptions
    // - No numbers unless explicitly mentioned
    // - Stay strictly within discussion
    // - If unclear, ask clarification questions
    // - Keep under 15 words
    // - No repetition
    // - No labels

    // Return ONLY 3 lines.
    // `;
    const prompt = `
You are a real-time AI meeting assistant.

Based ONLY on the transcript below, generate EXACTLY 3 suggestions.

Transcript:
${context}

STRICT RULES:
- Output EXACTLY 3 lines
- Each line must be UNIQUE
- No repetition
- No labels (no SUGGESTION, QUESTION, etc.)
- Do NOT invent facts, numbers, or details
- Only use information explicitly present
- Stay strictly within the discussion topic
- If unclear, ask a clarification question
- Avoid generic statements
- Keep each line under 15 words

Return ONLY the 3 lines.
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

    // let lines = text
    //   .split("\n")
    //   .map((l) => l.trim())
    //   .filter(
    //     (l) =>
    //       !l.includes("$") &&
    //       !/\d{2,}/.test(l) &&
    //       l.length > 8 &&
    //       !l.toLowerCase().includes("question") &&
    //       !l.toLowerCase().includes("insight") &&
    //       !l.toLowerCase().includes("fact") &&
    //       !l.toLowerCase().includes("output") &&
    //       l.length > 10 &&
    //       !l.toLowerCase().includes("provide it") &&
    //       !l.toLowerCase().includes("review the transcript") &&
    //       !l.includes("$") &&
    //       !/\d{2,}/.test(l) && // removes numbers like 30-day, 2018
    //       !l.toLowerCase().includes("company has") &&
    //       !l.toLowerCase().includes("according to") &&
    //       !l.toLowerCase().includes("policy") &&
    //       !l.includes("$") &&
    //       !/\d{2,}/.test(l) &&
    //       !l.toLowerCase().includes("budget") &&
    //       !l.toLowerCase().includes("agile") &&
    //       !l.toLowerCase().includes("marketing") &&
    //       !l.toLowerCase().includes("marketing budget") &&
    //       !l.toLowerCase().includes("sales team") &&
    //       !l.toLowerCase().includes("manager") &&
    //       !l.includes("...") &&
    //       !l.toLowerCase().includes("provide the transcript") &&
    //       !l.toLowerCase().includes("need the transcript") &&
    //       !/\d{2,}/.test(l) && // remove years, numbers
    //       !l.toLowerCase().includes("q1") &&
    //       !l.toLowerCase().includes("202") &&
    //       !l.toLowerCase().includes("according to") &&
    //       !l.toLowerCase().includes("review the transcript"),
    //   );

    let lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        const lower = l.toLowerCase();

        return (
          l.length > 10 &&
          // remove formatting garbage
          !lower.includes("suggestion") &&
          !lower.includes("question") &&
          !lower.includes("insight") &&
          !lower.includes("fact") &&
          !lower.includes("output") &&
          // remove model confusion lines
          !lower.includes("provide the transcript") &&
          !lower.includes("review the transcript") &&
          !lower.includes("need the transcript") &&
          // remove junk
          !l.includes("...") &&
          // prevent hallucinated numbers
          !l.includes("$") &&
          !/\d{2,}/.test(l) &&
          // prevent fake authority phrases
          !lower.includes("according to") &&
          !lower.includes("policy") &&
          !lower.includes("research") &&
          !l.toLowerCase().includes("agile")
        );
      });

    //  remove duplicates
    lines = [...new Set(lines)];

    // remove near-duplicates (IMPORTANT)
    lines = lines.filter(
      (line, i, arr) =>
        arr.findIndex((l) => l.toLowerCase() === line.toLowerCase()) === i,
    );
    // ✅ GUARANTEE ARRAY
    if (!Array.isArray(lines) || lines.length === 0) {
      lines = ["No suggestions available"];
    }

    // ✅ FORCE EXACT 3
    if (lines.length < 3) {
      lines.push("Can we clarify missing details from the discussion?");
    }

    lines = lines.slice(0, 3);

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
