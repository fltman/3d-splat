type DemoPair = {
  photo: string;
  depth: string;
  width: number;
  height: number;
};

const WIDTH = 1440;
const HEIGHT = 960;

function canvas(): HTMLCanvasElement {
  const element = document.createElement("canvas");
  element.width = WIDTH;
  element.height = HEIGHT;
  return element;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function createDemoPair(): DemoPair {
  const photoCanvas = canvas();
  const photo = photoCanvas.getContext("2d")!;

  const room = photo.createLinearGradient(0, 0, WIDTH, HEIGHT);
  room.addColorStop(0, "#324950");
  room.addColorStop(0.48, "#c0a070");
  room.addColorStop(1, "#2d1d22");
  photo.fillStyle = room;
  photo.fillRect(0, 0, WIDTH, HEIGHT);

  // Architectural lines make the parallax especially readable.
  photo.fillStyle = "#1b2629";
  photo.beginPath();
  photo.moveTo(0, 0);
  photo.lineTo(455, 250);
  photo.lineTo(455, 715);
  photo.lineTo(0, HEIGHT);
  photo.closePath();
  photo.fill();
  photo.fillStyle = "#655144";
  photo.beginPath();
  photo.moveTo(WIDTH, 0);
  photo.lineTo(990, 255);
  photo.lineTo(990, 715);
  photo.lineTo(WIDTH, HEIGHT);
  photo.closePath();
  photo.fill();

  const windowGlow = photo.createLinearGradient(0, 220, 0, 740);
  windowGlow.addColorStop(0, "#d9f1e9");
  windowGlow.addColorStop(0.55, "#8fbfc0");
  windowGlow.addColorStop(1, "#415d66");
  photo.fillStyle = windowGlow;
  photo.fillRect(455, 230, 535, 500);
  photo.fillStyle = "rgba(18,34,39,.85)";
  photo.fillRect(704, 230, 25, 500);
  photo.fillRect(455, 470, 535, 18);

  const floor = photo.createLinearGradient(0, 680, 0, HEIGHT);
  floor.addColorStop(0, "#775f4d");
  floor.addColorStop(1, "#1e1618");
  photo.fillStyle = floor;
  photo.beginPath();
  photo.moveTo(455, 730);
  photo.lineTo(990, 730);
  photo.lineTo(WIDTH, HEIGHT);
  photo.lineTo(0, HEIGHT);
  photo.closePath();
  photo.fill();

  // Distant hills.
  photo.fillStyle = "rgba(45,91,91,.7)";
  photo.beginPath();
  photo.moveTo(455, 540);
  photo.bezierCurveTo(560, 430, 660, 575, 760, 475);
  photo.bezierCurveTo(835, 400, 910, 510, 990, 430);
  photo.lineTo(990, 730);
  photo.lineTo(455, 730);
  photo.closePath();
  photo.fill();

  // Sofa.
  photo.fillStyle = "#b94832";
  roundedRect(photo, 260, 635, 920, 270, 58);
  photo.fill();
  photo.fillStyle = "#d05c3f";
  roundedRect(photo, 320, 560, 800, 230, 70);
  photo.fill();
  photo.strokeStyle = "rgba(79,25,20,.55)";
  photo.lineWidth = 9;
  photo.beginPath();
  photo.moveTo(700, 580);
  photo.lineTo(700, 810);
  photo.stroke();

  // Foreground table and sculptural object.
  photo.fillStyle = "#20191b";
  photo.beginPath();
  photo.ellipse(735, 900, 410, 115, 0, 0, Math.PI * 2);
  photo.fill();
  const vase = photo.createRadialGradient(650, 605, 15, 720, 680, 170);
  vase.addColorStop(0, "#f6dd8f");
  vase.addColorStop(0.42, "#d68b32");
  vase.addColorStop(1, "#542820");
  photo.fillStyle = vase;
  photo.beginPath();
  photo.moveTo(650, 835);
  photo.bezierCurveTo(600, 730, 640, 700, 670, 650);
  photo.bezierCurveTo(690, 600, 685, 560, 720, 545);
  photo.bezierCurveTo(760, 570, 745, 610, 775, 665);
  photo.bezierCurveTo(820, 745, 850, 790, 805, 835);
  photo.closePath();
  photo.fill();

  // Plant silhouette.
  photo.strokeStyle = "#142b25";
  photo.fillStyle = "#1d4739";
  photo.lineWidth = 16;
  photo.beginPath();
  photo.moveTo(1090, 760);
  photo.lineTo(1140, 360);
  photo.stroke();
  for (const [x, y, rx, ry, rotation] of [
    [1085, 470, 72, 30, -0.5],
    [1190, 425, 88, 34, 0.35],
    [1080, 570, 95, 36, -0.35],
    [1195, 550, 78, 32, 0.45],
    [1100, 365, 60, 27, -0.7],
  ] as const) {
    photo.beginPath();
    photo.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    photo.fill();
  }
  photo.fillStyle = "#171b19";
  roundedRect(photo, 1040, 735, 180, 180, 22);
  photo.fill();

  // Soft cinematic grade.
  const vignette = photo.createRadialGradient(720, 450, 240, 720, 480, 890);
  vignette.addColorStop(0, "rgba(255,245,210,0.06)");
  vignette.addColorStop(0.65, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.5)");
  photo.fillStyle = vignette;
  photo.fillRect(0, 0, WIDTH, HEIGHT);

  const depthCanvas = canvas();
  const depth = depthCanvas.getContext("2d")!;
  const back = depth.createLinearGradient(0, 0, 0, HEIGHT);
  back.addColorStop(0, "#171717");
  back.addColorStop(0.72, "#3a3a3a");
  back.addColorStop(1, "#777");
  depth.fillStyle = back;
  depth.fillRect(0, 0, WIDTH, HEIGHT);
  depth.fillStyle = "#101010";
  depth.fillRect(455, 230, 535, 500);
  depth.fillStyle = "#555";
  depth.beginPath();
  depth.moveTo(0, 0);
  depth.lineTo(455, 250);
  depth.lineTo(455, 715);
  depth.lineTo(0, HEIGHT);
  depth.closePath();
  depth.fill();
  depth.fillStyle = "#4b4b4b";
  depth.beginPath();
  depth.moveTo(WIDTH, 0);
  depth.lineTo(990, 255);
  depth.lineTo(990, 715);
  depth.lineTo(WIDTH, HEIGHT);
  depth.closePath();
  depth.fill();
  depth.fillStyle = "#999";
  roundedRect(depth, 260, 635, 920, 270, 58);
  depth.fill();
  depth.fillStyle = "#adadad";
  roundedRect(depth, 320, 560, 800, 230, 70);
  depth.fill();
  depth.fillStyle = "#d4d4d4";
  depth.beginPath();
  depth.ellipse(735, 900, 410, 115, 0, 0, Math.PI * 2);
  depth.fill();
  depth.fillStyle = "#eeeeee";
  depth.beginPath();
  depth.moveTo(650, 835);
  depth.bezierCurveTo(600, 730, 640, 700, 670, 650);
  depth.bezierCurveTo(690, 600, 685, 560, 720, 545);
  depth.bezierCurveTo(760, 570, 745, 610, 775, 665);
  depth.bezierCurveTo(820, 745, 850, 790, 805, 835);
  depth.closePath();
  depth.fill();
  depth.fillStyle = "#b7b7b7";
  roundedRect(depth, 1040, 735, 180, 180, 22);
  depth.fill();

  return {
    photo: photoCanvas.toDataURL("image/jpeg", 0.92),
    depth: depthCanvas.toDataURL("image/png"),
    width: WIDTH,
    height: HEIGHT,
  };
}
