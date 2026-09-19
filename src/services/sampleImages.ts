import { SampleImageItem } from "../types";

export const SAMPLE_IMAGES: SampleImageItem[] = [
  {
    id: "mountain-sunset",
    name: "Alpine Sunset Landscape",
    category: "Landscape",
    description: "Serene alpine mountains with sunset gradients and a corner copyright watermark.",
    watermarkDescription: "Corner text watermark: '© 2026 SHUTTER-LENS ARCHIVE · ALL RIGHTS RESERVED'",
    generator: () => createAlpineLandscape(),
  },
  {
    id: "neon-cyberpunk",
    name: "Neo-Tokyo Skyline",
    category: "Architecture",
    description: "Vibrant night city with neon lights and a bottom-right agency badge watermark.",
    watermarkDescription: "Bottom-right stamp: 'METRO-PIXELS · WATERMARK PREVIEW'",
    generator: () => createCyberpunkSkyline(),
  },
  {
    id: "minimal-interior",
    name: "Nordic Minimalist Studio",
    category: "Interior",
    description: "Clean aesthetic warm living room with diagonal center copyright notice.",
    watermarkDescription: "Diagonal center watermark banner: 'STOCK-PREVIEW #88412'",
    generator: () => createMinimalInterior(),
  },
  {
    id: "forest-mist",
    name: "Emerald Forest Canopy",
    category: "Nature",
    description: "Morning mist through pine needles with bottom-left photographer stamp.",
    watermarkDescription: "Bottom-left signature: 'LUMEN PHOTO · RAW ARCHIVE'",
    generator: () => createForestCanopy(),
  },
];

function createAlpineLandscape(): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, "#1e1b4b");
    sky.addColorStop(0.35, "#701a75");
    sky.addColorStop(0.65, "#f97316");
    sky.addColorStop(1, "#fde047");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 640);

    // Glowing sun
    const sunGrad = ctx.createRadialGradient(480, 360, 10, 480, 360, 140);
    sunGrad.addColorStop(0, "#ffffff");
    sunGrad.addColorStop(0.3, "#fef08a");
    sunGrad.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(480, 360, 140, 0, Math.PI * 2);
    ctx.fill();

    // Distant mountain ridge
    ctx.fillStyle = "#431407";
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.lineTo(160, 320);
    ctx.lineTo(310, 410);
    ctx.lineTo(490, 270);
    ctx.lineTo(680, 390);
    ctx.lineTo(840, 290);
    ctx.lineTo(960, 440);
    ctx.lineTo(960, 640);
    ctx.lineTo(0, 640);
    ctx.closePath();
    ctx.fill();

    // Closer mountain ridge with textured shadow
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.moveTo(0, 490);
    ctx.lineTo(120, 430);
    ctx.lineTo(240, 500);
    ctx.lineTo(410, 370);
    ctx.lineTo(600, 490);
    ctx.lineTo(770, 410);
    ctx.lineTo(960, 520);
    ctx.lineTo(960, 640);
    ctx.lineTo(0, 640);
    ctx.closePath();
    ctx.fill();

    // Lake reflections
    const lake = ctx.createLinearGradient(0, 510, 0, 640);
    lake.addColorStop(0, "#0c0a09");
    lake.addColorStop(0.5, "#451a03");
    lake.addColorStop(1, "#78350f");
    ctx.fillStyle = lake;
    ctx.fillRect(0, 520, 960, 120);

    // Pine trees silhouettes
    ctx.fillStyle = "#09090b";
    for (let i = 20; i < 940; i += 28) {
      const treeH = 30 + (Math.sin(i * 0.1) * 15 + 15);
      ctx.beginPath();
      ctx.moveTo(i, 540);
      ctx.lineTo(i + 12, 540 - treeH);
      ctx.lineTo(i + 24, 540);
      ctx.closePath();
      ctx.fill();
    }

    // Watermark Zone: Bottom-Right Copyright Watermark
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "bold 15px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 4;
    ctx.fillText("© 2026 SHUTTER-LENS ARCHIVE · ALL RIGHTS RESERVED", 930, 605);

    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(254, 215, 170, 0.8)";
    ctx.fillText("PREVIEW LICENSED FOR EVALUATION ONLY // ID #9921", 930, 622);
    ctx.restore();

    resolve(canvas.toDataURL("image/jpeg", 0.92));
  });
}

function createCyberpunkSkyline(): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;

    // Dark cyberpunk background
    const bg = ctx.createLinearGradient(0, 0, 0, 640);
    bg.addColorStop(0, "#030712");
    bg.addColorStop(0.6, "#0f172a");
    bg.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 640);

    // Neon glow grid
    ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 960; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 640);
      ctx.stroke();
    }
    for (let y = 0; y < 640; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }

    // Futuristic skyscraper blocks
    const buildings = [
      { x: 40, w: 90, h: 420, color: "#020617" },
      { x: 150, w: 120, h: 510, color: "#0f172a" },
      { x: 290, w: 80, h: 360, color: "#090d16" },
      { x: 390, w: 140, h: 480, color: "#0f172a" },
      { x: 550, w: 110, h: 400, color: "#020617" },
      { x: 680, w: 130, h: 540, color: "#090d16" },
      { x: 830, w: 90, h: 380, color: "#0f172a" },
    ];

    for (const b of buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, 640 - b.h, b.w, b.h);

      // Window lights
      for (let wy = 640 - b.h + 20; wy < 620; wy += 18) {
        for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 14) {
          if (Math.random() > 0.45) {
            ctx.fillStyle = Math.random() > 0.5 ? "rgba(56, 189, 248, 0.7)" : "rgba(244, 63, 94, 0.65)";
            ctx.fillRect(wx, wy, 7, 10);
          }
        }
      }
    }

    // Neon signs
    ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#ec4899";
    ctx.shadowColor = "#ec4899";
    ctx.shadowBlur = 15;
    ctx.fillText("NEO TOKYO", 410, 240);

    ctx.fillStyle = "#06b6d4";
    ctx.shadowColor = "#06b6d4";
    ctx.shadowBlur = 15;
    ctx.fillText("CYBER DYNAMICS", 165, 290);
    ctx.shadowBlur = 0;

    // Watermark Zone: Bottom-Right Logo Badge
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 16px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText("METRO-PIXELS · WATERMARK", 920, 585);
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
    ctx.fillText("NON-COMMERCIAL WATERMARK // SAMPLE", 920, 608);
    ctx.restore();

    resolve(canvas.toDataURL("image/jpeg", 0.92));
  });
}

function createMinimalInterior(): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;

    // Warm minimalist room wall
    const wall = ctx.createLinearGradient(0, 0, 960, 640);
    wall.addColorStop(0, "#f5f5f4");
    wall.addColorStop(0.5, "#e7e5e4");
    wall.addColorStop(1, "#d6d3d1");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 960, 640);

    // Wooden floor
    const floor = ctx.createLinearGradient(0, 460, 0, 640);
    floor.addColorStop(0, "#a8a29e");
    floor.addColorStop(1, "#78716c");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 460, 960, 180);

    // Large window casting light beam
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(120, 60);
    ctx.lineTo(440, 60);
    ctx.lineTo(600, 460);
    ctx.lineTo(200, 460);
    ctx.closePath();
    ctx.fill();

    // Minimal modern chair / sofa silhouette
    ctx.fillStyle = "#292524";
    ctx.beginPath();
    ctx.roundRect(300, 360, 360, 90, [16, 16, 4, 4]);
    ctx.fill();

    ctx.fillStyle = "#44403c";
    ctx.beginPath();
    ctx.roundRect(330, 450, 300, 30, [4, 4, 4, 4]);
    ctx.fill();

    // Chair legs
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(340, 480, 10, 80);
    ctx.fillRect(610, 480, 10, 80);

    // Indoor olive tree pot
    ctx.fillStyle = "#57534e";
    ctx.beginPath();
    ctx.roundRect(140, 380, 70, 90, [4, 4, 12, 12]);
    ctx.fill();

    // Tree branches & leaves
    ctx.strokeStyle = "#44403c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(175, 380);
    ctx.lineTo(175, 230);
    ctx.lineTo(130, 170);
    ctx.moveTo(175, 270);
    ctx.lineTo(220, 190);
    ctx.stroke();

    ctx.fillStyle = "#3f6212";
    for (let i = 0; i < 24; i++) {
      const lx = 120 + Math.random() * 110;
      const ly = 150 + Math.random() * 120;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 14, 8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Centered Diagonal Semi-Transparent Watermark Banner
    ctx.save();
    ctx.translate(480, 320);
    ctx.rotate(-Math.PI / 8);
    ctx.fillStyle = "rgba(120, 113, 108, 0.45)";
    ctx.font = "bold 38px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STOCK-PREVIEW #88412", 0, 0);
    ctx.font = "14px 'JetBrains Mono', monospace";
    ctx.fillText("NELTH-IA INPAINT TEST SAMPLE · WATERMARK OVERLAY", 0, 26);
    ctx.restore();

    resolve(canvas.toDataURL("image/jpeg", 0.92));
  });
}

function createForestCanopy(): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;

    // Forest canopy backdrop
    const grad = ctx.createRadialGradient(480, 100, 20, 480, 320, 600);
    grad.addColorStop(0, "#dcfce7");
    grad.addColorStop(0.3, "#22c55e");
    grad.addColorStop(0.7, "#15803d");
    grad.addColorStop(1, "#052e16");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 960, 640);

    // Tree trunks
    ctx.fillStyle = "#14532d";
    ctx.fillRect(80, 0, 70, 640);
    ctx.fillRect(260, 0, 95, 640);
    ctx.fillRect(520, 0, 65, 640);
    ctx.fillRect(720, 0, 110, 640);

    // Sunbeams / God rays
    ctx.fillStyle = "rgba(254, 240, 138, 0.18)";
    for (let angle = 0.2; angle < 1.0; angle += 0.15) {
      ctx.beginPath();
      ctx.moveTo(480, 0);
      ctx.lineTo(960 * angle - 100, 640);
      ctx.lineTo(960 * angle + 80, 640);
      ctx.closePath();
      ctx.fill();
    }

    // Bottom-Left Photographer Watermark Stamp
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 5;
    ctx.fillText("LUMEN PHOTO · RAW ARCHIVE", 40, 580);
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(187, 247, 208, 0.9)";
    ctx.fillText("WATERMARK PROTECTED 2026 // DO NOT REPOST", 40, 602);
    ctx.restore();

    resolve(canvas.toDataURL("image/jpeg", 0.92));
  });
}
