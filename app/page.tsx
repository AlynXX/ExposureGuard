import type { Metadata } from "next";
import ExposureGuardApp from "./ExposureGuardApp";

export const metadata: Metadata = {
  title: "ExposureGuard AI — Privacy exposure audit",
  description:
    "A privacy-first demo that explains breach exposure, detects personal data and turns findings into practical actions.",
};

export default function Home() {
  return <ExposureGuardApp />;
}
