
import { useRef, useState } from "react";

export default function Recorder({ setTranscript }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const mediaRecorderRef = useRef(null);
  const [recording, setRecording] = useState(false);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.start(10000); // every 10 sec chunk

      recorder.ondataavailable = async (event) => {
        if (event.data.size === 0) return;

        const formData = new FormData();
        formData.append("file", event.data, "audio.webm");

        const res = await fetch(`${API_URL}/transcribe`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!data.text) return;

        setTranscript((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            text: data.text,
          },
        ]);
      };

      setRecording(true);
    } catch (err) {
      console.error(err);
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  return (
    <button
      onClick={recording ? stop : start}
      className="w-14 h-14 rounded-full bg-indigo-600 text-white text-xl shadow-lg"
    >
      {recording ? "■" : "🎤"}
    </button>
  );
}