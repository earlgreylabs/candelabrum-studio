import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Run } from "@/core/run";

export function RunCompare() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRun = useCallback(() => {
    fetch(`/api/runs/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Run not found");
        return res.json();
      })
      .then((data) => {
        setRun(data.run);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const videos = document.querySelectorAll("video");
    videos.forEach((v) => {
      v.playbackRate = playbackRate;
    });
  }, [playbackRate]);

  if (loading) return <div className="p-8 text-primary">Loading...</div>;
  if (error || !run) return <div className="p-8 text-status-danger">{error || "Not found"}</div>;

  const orientationClass =
    run.profile.orientation === "portrait" ? "aspect-[9/16]" : "aspect-video";
  const objectFitClass = run.profile.orientation === "portrait" ? "object-contain" : "object-cover";

  const columns = [
    {
      title: "1. Base Image",
      artifact: run.artifacts.image,
      type: "image",
      asset: "image",
      description: "Stage 2: Base still image generated from the director's prompt.",
    },
    {
      title: "2. Raw Clip",
      artifact: run.artifacts.rawClip,
      type: "video",
      asset: "rawClip",
      description: "Stage 3: Video animation model animates the base image (24-30fps).",
    },
    {
      title: "3. Master Clip",
      artifact: run.artifacts.masterProxyClip || run.artifacts.masterClip,
      type: "video",
      asset: run.artifacts.masterProxyClip ? "masterProxyClip" : "masterClip",
      description: "Stage 4: Local RIFE interpolation upscales the framerate to a silky 120fps.",
    },
    {
      title: "4. Final Export",
      artifact: run.artifacts.exportVideo,
      type: "video",
      asset: "exportVideo",
      description: "Stage 6: Final H.264 encode with cinematic LUT color grading burned in.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background p-8 text-primary font-sans">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/runs/${run.id}`}
            className="text-secondary hover:text-primary transition-colors"
          >
            &larr; Back to Run
          </Link>
          <h1 className="text-2xl font-bold font-mono">
            {run.id}{" "}
            <span className="text-secondary font-sans text-lg font-medium ml-2">
              Pipeline Evolution
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="rounded bg-surfaceRaised border border-border px-3 py-2 text-sm text-primary focus:border-accent outline-none"
          >
            <option value={1}>1.0x Speed</option>
            <option value={0.5}>0.5x Slow-Mo</option>
            <option value={0.25}>0.25x Slow-Mo</option>
            <option value={0.1}>0.1x Frame-by-Frame</option>
          </select>
          <button
            onClick={() => {
              const videos = document.querySelectorAll("video");
              if (isPlaying) {
                videos.forEach((v) => v.pause());
                setIsPlaying(false);
              } else {
                videos.forEach((v) => {
                  v.currentTime = 0;
                  v.play().catch(() => {});
                });
                setIsPlaying(true);
              }
            }}
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm w-40"
          >
            {isPlaying ? "⏸ Pause All" : "▶ Sync & Play All"}
          </button>
        </div>
      </header>

      <main className="flex-1">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 h-full">
          {columns.map((col, idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-lg border border-border bg-surface overflow-hidden shadow-sm"
            >
              <div className="p-4 border-b border-border bg-surfaceRaised">
                <h3 className="text-lg font-semibold text-accent">{col.title}</h3>
                <p className="text-xs text-secondary mt-1">{col.description}</p>
              </div>
              <div className="flex-1 p-4 flex flex-col justify-center items-center bg-background/50">
                {!col.artifact ? (
                  <div className="text-faint italic text-sm text-center">Pending...</div>
                ) : col.type === "video" ? (
                  <video
                    controls
                    loop
                    className={`w-full rounded border border-border ${orientationClass} ${objectFitClass}`}
                    src={`/api/runs/${run.id}/asset/${col.asset}`}
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <img
                    src={`/api/runs/${run.id}/asset/${col.asset}`}
                    alt={col.title}
                    className={`w-full rounded border border-border ${orientationClass} ${objectFitClass}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
