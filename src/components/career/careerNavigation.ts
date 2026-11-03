"use client";
import { create } from "zustand";

/** Hide the departing route before a synchronous save mutation changes its view. */
export const useCareerNavigation = create<{ destination: string | null }>(() => ({ destination: null }));
export function beginCareerNavigation(destination: string) {
  useCareerNavigation.setState({ destination });
}
export function finishCareerNavigation() {
  useCareerNavigation.setState({ destination: null });
}
