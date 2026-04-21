
import React, { useState, useEffect } from "react";
import Recorder from "./Recorder";
import {
  LayoutGrid,
  FileText,
  Folder,
  Settings,
  RefreshCw,
  Send,
} from "lucide-react";

export default function App() {
  const API_URL = import.meta.env.VITE_API_URL;
  const [transcript, setTranscript] = useState([]);
 const [suggestionBatches, setSuggestionBatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [sessionStart] = useState(new Date().toISOString());
const newSession = () => {
  setTranscript([]);
  setSuggestionBatches([]);
  setMessages([]);
  setQuestion("");
};
  // 🔥 FETCH SUGGESTIONS
  const fetchSuggestions = async () => {
    if (transcript.length === 0) return;

    const res = await fetch(`${API_URL}/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript: transcript.map((t) => t.text),
      }),
    });

    const data = await res.json();

    if (!Array.isArray(data)) return;

    const formatted = data.map((text, i) => ({
    tag: "SUGGESTION",
      title: text,
      desc: "",
    }));

    setSuggestionBatches((prev) => [
  {
    timestamp: new Date().toISOString(),
    items: formatted,
  },
  ...prev.slice(0, 9), // keep last 10 batches
]);
  };

  useEffect(() => {
    const interval = setInterval(fetchSuggestions, 15000);
    return () => clearInterval(interval);
  }, [transcript]);

  // 💬 CHAT
  const sendQuestion = async (custom = null) => {
    const finalQuestion = custom || question;
    if (!finalQuestion || transcript.length === 0) return;

    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: finalQuestion,
        transcript: transcript.map((t) => t.text),
      }),
    });

    const answer = await res.text();

   const now = new Date().toISOString();

setMessages((prev) => [
  ...prev,
  { role: "user", content: finalQuestion, timestamp: now },
  { role: "ai", content: answer, timestamp: now },
]);
    setQuestion("");
  };
const exportSession = () => {
  const session = {
    sessionId: crypto.randomUUID(),
startedAt: sessionStart,
    endedAt: new Date().toISOString(),

    transcript: transcript.map((t) => ({
      timestamp: t.time,
      text: t.text,
    })),

    suggestions: suggestionBatches,

    
    chat: messages.map((m) => ({
  timestamp: m.timestamp, // ✅ use stored value
  role: m.role,
  content: m.content,
})),
  };

  const blob = new Blob(
    [JSON.stringify(session, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `twinmind-session-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

  return (
    <div className="h-screen bg-[#eef1f7] flex text-slate-800">

      {/* SIDEBAR */}
      <div className="w-[260px] bg-[#edf0f6] border-r px-6 py-7 flex flex-col">

        <h1 className="text-[30px] font-bold text-[#2f3192] leading-tight">
          Precision Workspace
        </h1>

        <div className="mt-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#2f3192] text-white flex items-center justify-center font-bold">
            A
          </div>

          <div>
            <p className="font-semibold text-lg">The Architect</p>
            <p className="text-xs text-slate-500 uppercase">
              Precision Mode
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-3">


          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white">
            <FileText size={18} />
            Transcripts
          </button>

        </div>

       <button
  onClick={newSession}
  className="mt-10 bg-[#2f3192] text-white rounded-xl py-4 font-semibold shadow hover:opacity-95 transition"
>
  NEW SESSION
</button>
<button
  onClick={exportSession}
  className="mt-10 bg-[#2f3192] text-white rounded-xl py-4 font-semibold shadow hover:opacity-95 transition"
>
  EXPORT SESSION
</button>
        <div className="mt-auto">
          <button className="flex items-center gap-3 text-slate-600">
            <Settings size={18} />
            Settings
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 grid grid-cols-3">

        {/* TRANSCRIPT */}
        <div className="px-8 py-8 border-r flex flex-col">

          <h2 className="text-4xl font-bold text-[#2f3192]">
            Live Transcript
          </h2>

          <p className="mt-3 text-sm tracking-widest text-green-600 font-semibold">
            ● LIVE PROCESSING
          </p>

          <div className="mt-10 flex-1 overflow-auto space-y-8">
            {transcript.map((t, i) => (
              <div key={i}>
                <p className="text-sm text-slate-400">{t.time}</p>

                <p className="mt-2 text-[22px] leading-10 font-medium text-slate-700">
                  {t.text}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-8 flex justify-center">
            <Recorder setTranscript={setTranscript} />
          </div>
        </div>

        {/* SUGGESTIONS */}
        <div className="px-8 py-8 border-r flex flex-col">

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-4xl font-bold text-[#2f3192]">
                Live Suggestions
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                Real-time context-aware insights
              </p>
            </div>

           <RefreshCw
  size={22}
  className="text-slate-400 cursor-pointer"
  onClick={fetchSuggestions}
/>
          </div>

          <div className="mt-8 space-y-6 overflow-auto flex-1">
          
          {suggestionBatches.map((batch, i) => (
  <div key={i}>
    <p className="text-xs text-slate-400 mb-2">
      {new Date(batch.timestamp).toLocaleTimeString()}
    </p>

    {batch.items.map((s, j) => (
      <div
        key={j}
        onClick={() => sendQuestion(s.title)}
        className="bg-white rounded-2xl p-6 shadow-sm border cursor-pointer hover:shadow-md transition mb-4"
      >
        <span className="text-[11px] font-bold px-3 py-1 rounded bg-[#eef0ff] text-[#2f3192]">
          {s.tag}
        </span>

        <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>

        <p className="mt-3 text-slate-500 leading-7">{s.desc}</p>
      </div>
    ))}
  </div>
))}
        </div>
        </div>

        {/* CHAT */}
        <div className="px-8 py-8 flex flex-col">

          <h2 className="text-4xl font-bold text-[#2f3192]">
            Contextual Chat
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Augmented AI intelligence
          </p>

          <div className="flex-1 overflow-auto mt-8 space-y-6">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[90%] p-5 rounded-2xl leading-8 text-lg shadow-sm ${
                  m.role === "user"
                    ? "ml-auto bg-[#2f3192] text-white"
                    : "bg-white"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>

          {/* INPUT */}
          <div className="mt-6 bg-white rounded-2xl border flex items-center px-5 py-4">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this session..."
              className="flex-1 outline-none text-lg"
            />

            <button
              onClick={() => sendQuestion()}
              className="text-[#2f3192]"
            >
              <Send size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}