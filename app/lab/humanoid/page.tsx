import HumanoidLabV3 from "@/components/lab/HumanoidLabV3";

export const metadata = {
  title: "ASTRA Humanoid Lab",
  description: "Isolated rigged humanoid testing environment for ASTRA.",
};

export default function HumanoidLabPage() {
  return (
    <div className="astra-humanoid-lab-route">
      <HumanoidLabV3 />
      <style>{`
        html,
        body {
          min-height: 100%;
        }

        .astra-humanoid-lab-route {
          height: 100vh;
          min-height: 620px;
          overflow: hidden;
        }

        .astra-humanoid-lab-route > main,
        .astra-humanoid-lab-route > main > div,
        .astra-humanoid-lab-route > main > div > section {
          height: 100%;
          min-height: 0 !important;
        }

        .astra-humanoid-lab-route > main > div > aside {
          height: 100%;
          box-sizing: border-box;
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
