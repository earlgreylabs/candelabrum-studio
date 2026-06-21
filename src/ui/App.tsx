import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RunList } from "./RunList";
import { RunDetail } from "./RunDetail";
import type { Run } from "@/core/run";

export function App() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState<string>("connecting...");

  useEffect(() => {
    const eventSource = new EventSource("/api/runs/events");

    eventSource.onopen = () => {
      setStatus("connected");
    };

    eventSource.addEventListener("runs-update", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.runs) {
          setRuns(data.runs);
        }
      } catch (err) {
        console.error("Failed to parse runs update", err);
      }
    });

    eventSource.onerror = (err) => {
      console.error("EventSource error", err);
      setStatus("disconnected");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RunList runs={runs} status={status} />} />
        <Route path="/runs/:id" element={<RunDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
