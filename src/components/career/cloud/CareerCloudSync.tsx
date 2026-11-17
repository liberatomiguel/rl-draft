"use client";

import { useEffect } from "react";
import { useCareerCloudStore } from "@/store/careerCloudStore";

/** Starts the cloud save listeners once for the career routes. Renders nothing; never stops. */
export function CareerCloudSync() {
  useEffect(() => {
    useCareerCloudStore.getState().start();
  }, []);
  return null;
}
