import HumanoidLabV8 from "@/components/lab/HumanoidLabV8";

export const metadata = {
  title: "ASTRA Human Interface V8",
  description: "Polished interactive humanoid entity interface for ASTRA.",
};

export default function HumanoidLabPage() {
  return (
    <div className="astra-humanoid-lab-route">
      <HumanoidLabV8 />
      <style>{`
        html,
        body {
          min-height: 100%;
          background: #01070c;
        }

        .astra-humanoid-lab-route {
          height: 100vh;
          min-height: 620px;
          overflow: hidden;
        }

        .astra-humanoid-lab-route > main {
          height: 100%;
          min-height: 0 !important;
        }

        .astra-humanoid-lab-route canvas {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
}
