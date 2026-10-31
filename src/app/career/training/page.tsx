import { TrainingScreen } from "@/components/career/screens/TrainingScreen";
import { Suspense } from "react";

export default function Page() {
  return <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}><TrainingScreen /></Suspense>;
}
