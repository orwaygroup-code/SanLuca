// app/api/admin/jobs/auto-tag/route.ts
//
// Endpoint cron-target del sistema de auto-tagging. Se llama vía cron del
// VPS con header x-bot-key a las 02:00 hora México (08:00 UTC). Después del
// close-day (06:05 UTC) para que las reservas del día estén en estado final.
//
// Ver wiki [[Auto-tagging]] §Cron job y crontab en
// docs/runbook-auto-tagging-deploy.md.
//
// Idempotente — re-correr el mismo día no duplica ni revierte cambios.

import { NextRequest, NextResponse } from "next/server";
import { runAutoTagJob } from "@/lib/autoTagJob";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-bot-key");
  if (!key || key !== process.env.BOT_API_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutoTagJob();
    return NextResponse.json({
      success: true,
      data: {
        startedAt:    result.startedAt.toISOString(),
        finishedAt:   result.finishedAt.toISOString(),
        durationMs:   result.finishedAt.getTime() - result.startedAt.getTime(),
        rulesApplied: result.rules.appliedTotal,
        rulesRemoved: result.rules.removedTotal,
        rulesByName:  result.rules.perRule,
        llmApplied:   result.llm.appliedTotal,
        llmConsidered: result.llm.conversationsConsidered,
        llmSkipped:    result.llm.conversationsSkipped,
        // Errores ya vienen truncados a 50 desde el job.
        errors:        result.llm.errors,
      },
    });
  } catch (err) {
    console.error("[AUTO_TAG] job failed at top level:", err);
    return NextResponse.json(
      {
        success: false,
        error:   err instanceof Error ? err.message : "job_failed",
      },
      { status: 500 },
    );
  }
}
