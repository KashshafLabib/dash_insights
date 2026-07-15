import insights from "@/data/insights.json";

/** Precomputed insights for the default TakaPay dataset (also the healthcheck). */
export async function GET() {
  return Response.json(insights);
}
