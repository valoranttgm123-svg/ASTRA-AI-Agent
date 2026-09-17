import HumanoidLabV9 from "@/components/lab/HumanoidLabV9";
import { AstraRuntimeProvider } from "@/components/AstraRuntime";

export const metadata = {
  title: "ASTRA Humanoid V9",
  description: "Image-driven particle humanoid interface for ASTRA.",
};

export default function HumanoidLabPage() {
  return (
    <AstraRuntimeProvider>
      <HumanoidLabV9 />
    </AstraRuntimeProvider>
  );
}
