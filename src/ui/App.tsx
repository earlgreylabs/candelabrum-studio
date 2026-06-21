import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Run } from "@/core/run";
import { RunDetail } from "./RunDetail";
import { RunList } from "./RunList";
import { RunCompare } from "./RunCompare";

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
        <Route path="/runs/:id/compare" element={<RunCompare />} />
      </Routes>
    </BrowserRouter>
  );
}
