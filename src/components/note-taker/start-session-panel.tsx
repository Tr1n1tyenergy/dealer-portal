"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "choose" | "schedule" | "instant";

export function StartSessionPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [limitMode, setLimitMode] = useState<"unlimited" | "custom">("unlimited");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [seconds, setSeconds] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const timeLimitSeconds = useMemo(() => {
    if (limitMode === "unlimited") return null;
    return (
      Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(seconds || 0)
    );
  }, [limitMode, hours, minutes, seconds]);

  async function createSession(selected: "schedule" | "instant") {
    setLoading(true);
    setError("");

    let scheduledAt: string | undefined;
    if (selected === "schedule") {
      if (!date || !time) {
        setError("Date and time are required for scheduled sessions.");
        setLoading(false);
        return;
      }
      scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    }

    const res = await fetch("/api/note-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || "Untitled Session",
        mode: selected,
        scheduledAt,
        timeLimitSeconds,
        participants: [],
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ? JSON.stringify(data.error) : "Unable to create session");
      return;
    }

    router.push(`/intelligence/note-taker/${data.session.id}`);
    router.refresh();
  }

  if (mode === "choose") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start Recording Session</CardTitle>
          <CardDescription>Schedule ahead or begin an instant capture session.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button variant="navy" className="h-14" onClick={() => setMode("schedule")}>
            Schedule Session
          </Button>
          <Button className="h-14" onClick={() => setMode("instant")}>
            Start Instant Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "schedule" ? "Schedule Session" : "Instant Session"}</CardTitle>
        <CardDescription>
          {mode === "schedule"
            ? "Plan a future note taking session."
            : "Recording begins after a short animated countdown."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="sessionName">Session Name</Label>
          <Input
            id="sessionName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Retail Leadership Sync"
          />
        </div>

        {mode === "schedule" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        ) : null}

        <div>
          <Label>Time Limit</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={limitMode === "unlimited" ? "default" : "outline"}
              onClick={() => setLimitMode("unlimited")}
            >
              Unlimited
            </Button>
            <Button
              type="button"
              size="sm"
              variant={limitMode === "custom" ? "default" : "outline"}
              onClick={() => setLimitMode("custom")}
            >
              Custom
            </Button>
          </div>
          {limitMode === "custom" ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <Label>Hours</Label>
                <Input value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </div>
              <div>
                <Label>Seconds</Label>
                <Input value={seconds} onChange={(e) => setSeconds(e.target.value)} />
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setMode("choose")} disabled={loading}>
            Back
          </Button>
          <Button onClick={() => createSession(mode)} disabled={loading}>
            {loading
              ? "Creating..."
              : mode === "schedule"
                ? "Schedule Session"
                : "Begin Countdown"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
