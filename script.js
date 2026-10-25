const form = document.querySelector("#shot-form");
const throwButton = document.querySelector("#throw-button");
const resetButton = document.querySelector("#reset-button");
const flightPath = document.querySelector("#flight-path");
const disc = document.querySelector("#disc");
const landingMarker = document.querySelector("#landing-marker");
const flightLive = document.querySelector("#flight-live");
const shotResults = document.querySelector("#shot-results");
const resultDistance = document.querySelector("#result-distance");
const resultRemaining = document.querySelector("#result-remaining");
const remainingLabel = document.querySelector("#remaining-label");
const tee = { x: 600, y: 416 };
const basket = { x: 603, y: 216 };
let animationFrame = 0;
let shotId = 0;

const discInputs = {
  name: document.querySelector("#disc-name"),
  speed: document.querySelector("#disc-speed"),
  glide: document.querySelector("#disc-glide"),
  turn: document.querySelector("#disc-turn"),
  fade: document.querySelector("#disc-fade"),
  style: document.querySelector("#throw-style"),
};
const selectedDiscName = document.querySelector("#selected-disc-name");
const selectedDiscNumbers = document.querySelector("#selected-disc-numbers");
const saveDiscButton = document.querySelector("#save-disc");
const savedDiscsSelect = document.querySelector("#saved-discs");
const discSaveStatus = document.querySelector("#disc-save-status");
const SAVED_DISCS_KEY = "fairway-practice-saved-discs-v1";

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function getDiscProfile() {
  return {
    name: (discInputs.name.value || "Custom Disc").trim().slice(0, 40) || "Custom Disc",
    speed: clampNumber(discInputs.speed.value, 1, 15, 9),
    glide: clampNumber(discInputs.glide.value, 1, 7, 5),
    turn: clampNumber(discInputs.turn.value, -5, 1, -1),
    fade: clampNumber(discInputs.fade.value, 0, 5, 2),
    style: discInputs.style.value || "RHBH",
  };
}

function getFlightDirection(style) {
  // Positive = right on the course SVG. RHBH and LHFH normally fade left.
  return style === "RHBH" || style === "LHFH" ? -1 : 1;
}

function updateDiscReadout() {
  const profile = getDiscProfile();
  selectedDiscName.textContent = profile.name;
  selectedDiscNumbers.textContent = `${profile.speed} / ${profile.glide} / ${profile.turn} / ${profile.fade}`;
}

function readSavedDiscs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_DISCS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function renderSavedDiscs(selectedIndex = "") {
  const discs = readSavedDiscs();
  savedDiscsSelect.innerHTML = '<option value="">Choose a saved disc…</option>';
  discs.forEach((profile, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${profile.name} — ${profile.speed} / ${profile.glide} / ${profile.turn} / ${profile.fade}`;
    savedDiscsSelect.append(option);
  });
  savedDiscsSelect.value = String(selectedIndex);
}

function saveCurrentDisc() {
  const profile = getDiscProfile();
  const discs = readSavedDiscs();
  const sameName = discs.findIndex((discProfile) => discProfile.name.toLowerCase() === profile.name.toLowerCase());
  let index;
  if (sameName >= 0) {
    discs[sameName] = profile;
    index = sameName;
  } else {
    discs.push(profile);
    index = discs.length - 1;
  }
  try {
    localStorage.setItem(SAVED_DISCS_KEY, JSON.stringify(discs.slice(-40)));
    renderSavedDiscs(Math.min(index, 39));
    discSaveStatus.textContent = `${profile.name} saved on this device.`;
  } catch {
    discSaveStatus.textContent = "This browser would not allow saving, but you can still use the disc.";
  }
}

Object.values(discInputs).forEach((input) => input.addEventListener("input", updateDiscReadout));
saveDiscButton.addEventListener("click", saveCurrentDisc);
savedDiscsSelect.addEventListener("change", () => {
  const profile = readSavedDiscs()[Number(savedDiscsSelect.value)];
  if (!profile) return;
  discInputs.name.value = profile.name;
  discInputs.speed.value = profile.speed;
  discInputs.glide.value = profile.glide;
  discInputs.turn.value = profile.turn;
  discInputs.fade.value = profile.fade;
  discInputs.style.value = profile.style || "RHBH";
  updateDiscReadout();
  discSaveStatus.textContent = `${profile.name} selected.`;
});
renderSavedDiscs();
updateDiscReadout();


const controls = {
  speed: document.querySelector("#speed"),
  aim: document.querySelector("#aim"),
  launch: document.querySelector("#launch"),
  hyzer: document.querySelector("#hyzer"),
};

const outputs = {
  speed: document.querySelector("#speed-value"),
  aim: document.querySelector("#aim-value"),
  launch: document.querySelector("#launch-value"),
  hyzer: document.querySelector("#hyzer-value"),
};

function updateLabels() {
  const speed = Number(controls.speed.value);
  const aim = Number(controls.aim.value);
  const launch = Number(controls.launch.value);
  const hyzer = Number(controls.hyzer.value);
  outputs.speed.innerHTML = `${speed} <small>mph</small>`;
  outputs.aim.innerHTML = `${aim}° <small>${aim === 0 ? "center" : aim < 0 ? "left" : "right"}</small>`;
  outputs.launch.textContent = `${launch}°`;
  outputs.hyzer.innerHTML = `${Math.abs(hyzer)}° <small>${hyzer === 0 ? "flat" : hyzer < 0 ? "hyzer" : "anhyzer"}</small>`;
}

Object.values(controls).forEach((control) => control.addEventListener("input", updateLabels));

function getShot() {
  const speed = Number(controls.speed.value);
  const aimAngle = Number(controls.aim.value);
  const launchAngle = Number(controls.launch.value);
  const hyzerAngle = Number(controls.hyzer.value);
  const aimRadians = (aimAngle * Math.PI) / 180;
  const profile = getDiscProfile();

  // Flight numbers influence the model, while actual release speed still matters most.
  // A high-speed disc needs more release speed to reach its designed turn/glide.
  const requiredMph = 25 + profile.speed * 2.8;
  const speedActivation = Math.max(0.35, Math.min(1.15, speed / requiredMph));
  const launchEfficiency = Math.max(0.72, 1 - Math.pow((launchAngle - 10) / 26, 2) * 0.13);
  const releaseAngleEfficiency = Math.max(0.78, 1 - Math.abs(hyzerAngle) * 0.0015);
  const glideMultiplier = 0.82 + profile.glide * 0.055;
  const speedClassEfficiency = 1 - Math.max(0, profile.speed - speed / 4.6) * 0.012;

  const distance = Math.round(
    Math.max(20, speed * 5.05 * launchEfficiency * releaseAngleEfficiency * glideMultiplier * speedClassEfficiency),
  );
  const downrange = distance * Math.cos(aimRadians);
  const aimDrift = distance * Math.sin(aimRadians);

  const flightDirection = getFlightDirection(profile.style);
  // Negative turn moves opposite the eventual fade during the high-speed part of flight.
  const turnDrift = (-profile.turn) * speedActivation * (distance / 300) * 14 * -flightDirection;
  // Fade becomes stronger late in flight, especially if the disc was not fully up to speed.
  const fadeActivation = 0.72 + Math.max(0, 1 - speedActivation) * 0.65;
  const fadeDrift = profile.fade * fadeActivation * (distance / 300) * 13 * flightDirection;
  // Release hyzer/anhyzer is still controlled by the throw itself.
  const releaseDrift = hyzerAngle * (distance / 300) * 1.25;
  const lateral = aimDrift + turnDrift + fadeDrift + releaseDrift;
  const remaining = Math.round(Math.hypot(300 - downrange, lateral));

  return {
    speed,
    launchAngle,
    distance,
    downrange,
    lateral,
    turnDrift,
    fadeDrift,
    remaining,
    profile,
    x: tee.x + lateral * 0.68,
    y: tee.y - downrange * 0.67,
  };
}

function cubicPoint(t, start, control1, control2, end) {
  const inverse = 1 - t;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * t;
  const c = 3 * inverse * t * t;
  const d = t * t * t;
  return {
    x: a * start.x + b * control1.x + c * control2.x + d * end.x,
    y: a * start.y + b * control1.y + c * control2.y + d * end.y,
  };
}

function announce(text) {
  flightLive.textContent = text;
  flightLive.classList.add("visible");
}

function finishShot(shot, id) {
  if (id !== shotId) return;
  disc.classList.remove("in-flight");
  disc.setAttribute("transform", `translate(${shot.x} ${shot.y}) rotate(${shot.lateral > 0 ? 8 : -8})`);
  landingMarker.setAttribute("transform", `translate(${shot.x} ${shot.y})`);
  landingMarker.style.opacity = "1";
  flightPath.style.opacity = ".85";
  shotResults.hidden = false;
  resultDistance.textContent = `${shot.distance} ft`;
  const past = shot.downrange > 300;
  const remaining = Math.abs(shot.remaining);
  remainingLabel.textContent = past ? "PAST THE BASKET" : "TO THE BASKET";
  resultRemaining.textContent = past
    ? `${Math.round(shot.downrange - 300)} ft past`
    : `${remaining} ft`;
  announce(
    past
      ? `Landed ${shot.distance} feet. ${Math.round(shot.downrange - 300)} feet past the basket.`
      : `Landed ${shot.distance} feet. ${remaining} feet to the basket.`,
  );
  throwButton.disabled = false;
  throwButton.innerHTML = '<span class="throw-icon" aria-hidden="true">➜</span> Throw again';
}

function throwDisc(event) {
  event.preventDefault();
  cancelAnimationFrame(animationFrame);
  const id = ++shotId;
  const shot = getShot();
  const apex = Math.max(31, shot.launchAngle * 2.7);
  const turnPixels = shot.turnDrift * 0.68;
  const control1 = {
    x: tee.x + shot.lateral * 0.08 + turnPixels * 0.65,
    y: tee.y - shot.downrange * 0.23 - apex,
  };
  const control2 = {
    x: tee.x + shot.lateral * 0.58 + turnPixels,
    y: shot.y - shot.downrange * 0.23 - apex * 0.6,
  };
  const pathData = `M ${tee.x} ${tee.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${shot.x} ${shot.y}`;
  flightPath.setAttribute("d", pathData);
  flightPath.style.opacity = ".82";
  flightPath.style.strokeDasharray = "1";
  flightPath.style.strokeDashoffset = "1";
  flightPath.setAttribute("pathLength", "1");
  landingMarker.style.opacity = "0";
  shotResults.hidden = true;
  disc.setAttribute("transform", `translate(${tee.x} ${tee.y})`);
  disc.classList.add("in-flight");
  throwButton.disabled = true;
  throwButton.textContent = "In flight…";
  announce(`${shot.profile.name} · ${shot.profile.speed} / ${shot.profile.glide} / ${shot.profile.turn} / ${shot.profile.fade} is in the air.`);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 90 : Math.max(1150, Math.min(2400, 900 + shot.distance * 3));
  const started = performance.now();

  function animate(now) {
    if (id !== shotId) return;
    const progress = Math.min(1, (now - started) / duration);
    const point = cubicPoint(progress, tee, control1, control2, shot);
    const tilt = (shot.lateral >= 0 ? 1 : -1) * Math.sin(progress * Math.PI * 5) * 12;
    disc.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${tilt})`);
    flightPath.style.strokeDashoffset = String(1 - progress);
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      finishShot(shot, id);
    }
  }
  animationFrame = requestAnimationFrame(animate);
}

function resetHole() {
  shotId += 1;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  disc.classList.remove("in-flight");
  disc.setAttribute("transform", `translate(${tee.x} ${tee.y})`);
  flightPath.setAttribute("d", "");
  flightPath.style.opacity = "0";
  flightPath.style.strokeDashoffset = "1";
  landingMarker.style.opacity = "0";
  landingMarker.removeAttribute("transform");
  shotResults.hidden = true;
  resultDistance.textContent = "—";
  resultRemaining.textContent = "—";
  remainingLabel.textContent = "TO THE BASKET";
  flightLive.classList.remove("visible");
  flightLive.textContent = "";
  throwButton.disabled = false;
  throwButton.innerHTML = '<span class="throw-icon" aria-hidden="true">➜</span> Throw disc';
}

form.addEventListener("submit", throwDisc);
resetButton.addEventListener("click", resetHole);
updateLabels();

const cameraMediaDevices = navigator.mediaDevices;
const cameraStartButton = document.querySelector("#start-cameras");
const cameraStopButton = document.querySelector("#stop-cameras");
const cameraStatus = document.querySelector("#camera-status");
const selectDiscColorButton = document.querySelector("#select-disc-color");
const sensitivityInput = document.querySelector("#detection-sensitivity");
const sensitivityOutput = document.querySelector("#detection-sensitivity-value");
const detectionSetupHint = document.querySelector("#detection-setup-hint");
const discColorSwatch = document.querySelector("#disc-color-swatch");
const discColorValue = document.querySelector("#disc-color-value");

const cameraSlots = [
  {
    label: "Camera 1",
    select: document.querySelector("#camera1-select"),
    video: document.querySelector("#camera1-video"),
    preview: document.querySelector("#camera1-preview"),
    overlay: document.querySelector("#camera1-overlay"),
    detectionState: document.querySelector("#camera1-detection-state"),
    coordinates: document.querySelector("#camera1-coordinates"),
    placeholder: document.querySelector("#camera1-placeholder"),
    state: document.querySelector("#camera1-state"),
    details: document.querySelector("#camera1-details"),
    stream: null,
    lastSelectedId: "",
    switchToken: 0,
  },
  {
    label: "Camera 2",
    select: document.querySelector("#camera2-select"),
    video: document.querySelector("#camera2-video"),
    preview: document.querySelector("#camera2-preview"),
    overlay: document.querySelector("#camera2-overlay"),
    detectionState: document.querySelector("#camera2-detection-state"),
    coordinates: document.querySelector("#camera2-coordinates"),
    placeholder: document.querySelector("#camera2-placeholder"),
    state: document.querySelector("#camera2-state"),
    details: document.querySelector("#camera2-details"),
    stream: null,
    lastSelectedId: "",
    switchToken: 0,
  },
];

const cameraApiAvailable = Boolean(
  cameraMediaDevices &&
  typeof cameraMediaDevices.getUserMedia === "function" &&
  typeof cameraMediaDevices.enumerateDevices === "function",
);
let availableVideoCameras = [];
let cameraStarting = false;
let cameraStartToken = 0;
const PROCESS_WIDTH = 320;
const PROCESS_HEIGHT = 180;
const MIN_DETECTION_PIXELS = 12;
const MAX_DETECTION_FRACTION = 0.28;
const DETECTION_INTERVAL_MS = 33;
let selectedDiscColor = null;
let colorPicking = false;
let detectionAnimationFrame = 0;
let lastDetectionAt = -Infinity;

let speedCalibrationActive = false;
let speedCalibrationPoints = [];
let pixelsPerInch = null;
let lastCamera1Detection = null;
let measuredThrowSpeedMph = null;
let recentThrowSpeeds = [];

let autoThrowTimer = null;
let lastAutomaticThrowAt = -Infinity;
const AUTO_THROW_COOLDOWN_MS = 2500;
const AUTO_THROW_SETTLE_MS = 180;
const AUTO_THROW_MIN_MPH = 12;

function scheduleAutomaticCameraThrow() {
  if (isThrowing || !Number.isFinite(measuredThrowSpeedMph)) return;
  if (measuredThrowSpeedMph < AUTO_THROW_MIN_MPH) return;
  if (performance.now() - lastAutomaticThrowAt < AUTO_THROW_COOLDOWN_MS) return;
  clearTimeout(autoThrowTimer);
  autoThrowTimer = setTimeout(() => {
    if (isThrowing || !Number.isFinite(measuredThrowSpeedMph)) return;
    controls.speed.value = String(Math.round(Math.max(Number(controls.speed.min), Math.min(Number(controls.speed.max), measuredThrowSpeedMph))));
    updateLabels();
    lastAutomaticThrowAt = performance.now();
    recentThrowSpeeds = [];
    lastCamera1Detection = null;
    speedCalibrationStatus.textContent = `Automatic throw: ${controls.speed.value} mph.`;
    throwDisc();
  }, AUTO_THROW_SETTLE_MS);
}


const calibrationDistanceInput = document.querySelector("#calibration-distance");
const startSpeedCalibrationButton = document.querySelector("#start-speed-calibration");
const useMeasuredSpeedButton = document.querySelector("#use-measured-speed");
const speedCalibrationStatus = document.querySelector("#speed-calibration-status");
const measuredSpeedOutput = document.querySelector("#measured-speed");

function updateCalibrationButtonState() {
  const camera1Running = Boolean(cameraSlots[0].stream);
  startSpeedCalibrationButton.disabled = !camera1Running;
  if (!camera1Running) speedCalibrationStatus.textContent = "Start Camera 1 first.";
  else if (!pixelsPerInch && !speedCalibrationActive) speedCalibrationStatus.textContent = "Ready. Click Calibrate Camera 1, then click two marks in the Camera 1 preview.";
}

function videoClickToSourcePoint(event, slot) {
  const crop = getVideoSourceCrop(slot);
  if (!crop) return null;
  const rect = slot.video.getBoundingClientRect();
  const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const ny = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  return { x: crop.x + nx * crop.width, y: crop.y + ny * crop.height };
}

function beginSpeedCalibration() {
  if (!cameraSlots[0].stream) return;
  speedCalibrationActive = true;
  speedCalibrationPoints = [];
  lastCamera1Detection = null;
  recentThrowSpeeds = [];
  speedCalibrationStatus.textContent = "Calibration: click the FIRST marker in Camera 1.";
  cameraSlots[0].preview.classList.add("is-color-picking");
}

function handleSpeedCalibrationClick(event) {
  if (!speedCalibrationActive) return;
  const point = videoClickToSourcePoint(event, cameraSlots[0]);
  if (!point) return;
  speedCalibrationPoints.push(point);
  if (speedCalibrationPoints.length === 1) {
    speedCalibrationStatus.textContent = "Good. Now click the SECOND marker in Camera 1.";
    return;
  }
  const a = speedCalibrationPoints[0], b = speedCalibrationPoints[1];
  const pixelDistance = Math.hypot(b.x-a.x, b.y-a.y);
  const realDistanceInches = clampNumber(calibrationDistanceInput.value, 6, 120, 36);
  if (pixelDistance < 20) {
    speedCalibrationPoints = [];
    speedCalibrationStatus.textContent = "Those clicks were too close. Click the first marker again.";
    return;
  }
  pixelsPerInch = pixelDistance / realDistanceInches;
  speedCalibrationActive = false;
  cameraSlots[0].preview.classList.remove("is-color-picking");
  speedCalibrationStatus.textContent = `Calibrated: ${pixelDistance.toFixed(0)} px = ${realDistanceInches} in. Throw the disc through Camera 1's view.`;
}

function recordCamera1Speed(sourceX, sourceY, timestamp) {
  if (!pixelsPerInch || speedCalibrationActive || colorPicking) return;
  const current = {x:sourceX, y:sourceY, t:timestamp};
  if (lastCamera1Detection) {
    const dt = (timestamp-lastCamera1Detection.t)/1000;
    const pixels = Math.hypot(sourceX-lastCamera1Detection.x, sourceY-lastCamera1Detection.y);
    if (dt > .012 && dt < .18) {
      const mph = ((pixels/pixelsPerInch)/dt)/17.6;
      if (mph >= 8 && mph <= 100) {
        recentThrowSpeeds.push(mph);
        recentThrowSpeeds = recentThrowSpeeds.slice(-6);
        const sorted = [...recentThrowSpeeds].sort((a,b)=>a-b);
        const estimate = sorted[Math.max(0, Math.floor(sorted.length*.7))];
        measuredThrowSpeedMph = estimate;
        measuredSpeedOutput.textContent = `${estimate.toFixed(1)} mph`;
        useMeasuredSpeedButton.disabled = false;
        speedCalibrationStatus.textContent = `Speed detected: ${estimate.toFixed(1)} mph. Launching automatically…`;
        scheduleAutomaticCameraThrow();
      }
    }
  }
  lastCamera1Detection = current;
}

startSpeedCalibrationButton.addEventListener("click", beginSpeedCalibration);
cameraSlots[0].video.addEventListener("click", handleSpeedCalibrationClick);
useMeasuredSpeedButton.addEventListener("click", () => {
  if (!Number.isFinite(measuredThrowSpeedMph)) return;
  controls.speed.value = String(Math.round(Math.max(Number(controls.speed.min), Math.min(Number(controls.speed.max), measuredThrowSpeedMph))));
  updateLabels();
  speedCalibrationStatus.textContent = `Using ${controls.speed.value} mph for the next simulated throw.`;
});


cameraSlots.forEach((slot) => {
  slot.overlayContext = slot.overlay.getContext("2d");
  slot.processingCanvas = document.createElement("canvas");
  slot.processingCanvas.width = PROCESS_WIDTH;
  slot.processingCanvas.height = PROCESS_HEIGHT;
  slot.processingContext = slot.processingCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  slot.colorMask = new Uint8Array(PROCESS_WIDTH * PROCESS_HEIGHT);
  slot.componentQueue = new Uint32Array(PROCESS_WIDTH * PROCESS_HEIGHT);
});

const detectionCanvasAvailable = cameraSlots.every(
  (slot) => slot.overlayContext && slot.processingContext,
);

function setCameraStatus(message, state = "info") {
  cameraStatus.textContent = message;
  cameraStatus.dataset.state = state;
}

function setDetectionReadout(slot, label, state, coordinates = "X — px · Y — px") {
  if (slot.detectionState.textContent !== label) {
    slot.detectionState.textContent = label;
  }
  slot.detectionState.dataset.state = state;
  if (slot.coordinates.textContent !== coordinates) {
    slot.coordinates.textContent = coordinates;
  }
}

function getVideoSourceCrop(slot) {
  const videoWidth = slot.video.videoWidth;
  const videoHeight = slot.video.videoHeight;
  const displayWidth = slot.video.clientWidth || slot.preview.clientWidth;
  const displayHeight = slot.video.clientHeight || slot.preview.clientHeight;
  if (!videoWidth || !videoHeight || !displayWidth || !displayHeight) return null;

  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;
  if (videoAspect > displayAspect) {
    const cropWidth = videoHeight * displayAspect;
    return {
      x: (videoWidth - cropWidth) / 2,
      y: 0,
      width: cropWidth,
      height: videoHeight,
    };
  }

  const cropHeight = videoWidth / displayAspect;
  return {
    x: 0,
    y: (videoHeight - cropHeight) / 2,
    width: videoWidth,
    height: cropHeight,
  };
}

function drawVideoToProcessingCanvas(slot, crop = getVideoSourceCrop(slot)) {
  if (!crop || slot.video.readyState < 2) return null;
  slot.processingContext.drawImage(
    slot.video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    PROCESS_WIDTH,
    PROCESS_HEIGHT,
  );
  return crop;
}

function getOverlaySize(slot) {
  const width = Math.max(1, slot.preview.clientWidth);
  const height = Math.max(1, slot.preview.clientHeight);
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);

  if (slot.overlay.width !== pixelWidth || slot.overlay.height !== pixelHeight) {
    slot.overlay.width = pixelWidth;
    slot.overlay.height = pixelHeight;
  }
  slot.overlayContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
}

function clearDetectionOverlay(slot) {
  const { width, height } = getOverlaySize(slot);
  slot.overlayContext.clearRect(0, 0, width, height);
}

function drawDetectionOverlay(slot, region) {
  const { width, height } = getOverlaySize(slot);
  const context = slot.overlayContext;
  const scaleX = width / PROCESS_WIDTH;
  const scaleY = height / PROCESS_HEIGHT;
  const x = region.minX * scaleX;
  const y = region.minY * scaleY;
  const boxWidth = (region.maxX - region.minX + 1) * scaleX;
  const boxHeight = (region.maxY - region.minY + 1) * scaleY;
  const centerX = (region.minX + region.maxX + 1) * 0.5 * scaleX;
  const centerY = (region.minY + region.maxY + 1) * 0.5 * scaleY;

  context.clearRect(0, 0, width, height);
  context.lineJoin = "round";
  context.lineWidth = 4;
  context.strokeStyle = "rgba(18, 31, 22, 0.85)";
  context.strokeRect(x, y, boxWidth, boxHeight);
  context.lineWidth = 2;
  context.strokeStyle = "#f3bd79";
  context.strokeRect(x, y, boxWidth, boxHeight);

  context.beginPath();
  context.moveTo(centerX - 8, centerY);
  context.lineTo(centerX + 8, centerY);
  context.moveTo(centerX, centerY - 8);
  context.lineTo(centerX, centerY + 8);
  context.strokeStyle = "rgba(18, 31, 22, 0.95)";
  context.lineWidth = 4;
  context.stroke();
  context.beginPath();
  context.moveTo(centerX - 8, centerY);
  context.lineTo(centerX + 8, centerY);
  context.moveTo(centerX, centerY - 8);
  context.lineTo(centerX, centerY + 8);
  context.strokeStyle = "#fff7dc";
  context.lineWidth = 2;
  context.stroke();
}

function findLargestColorRegion(slot, imageData) {
  const pixels = imageData.data;
  const mask = slot.colorMask;
  const queue = slot.componentQueue;
  const target = selectedDiscColor;
  const tolerance = Number(sensitivityInput.value);
  const toleranceSquared = tolerance * tolerance;

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * 4;
    const redDifference = pixels[offset] - target.r;
    const greenDifference = pixels[offset + 1] - target.g;
    const blueDifference = pixels[offset + 2] - target.b;
    mask[pixel] = pixels[offset + 3] > 96 &&
      redDifference * redDifference +
        greenDifference * greenDifference +
        blueDifference * blueDifference <= toleranceSquared
      ? 1
      : 0;
  }

  let largest = null;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start]) continue;

    let head = 0;
    let tail = 0;
    let minX = PROCESS_WIDTH;
    let minY = PROCESS_HEIGHT;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    mask[start] = 0;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % PROCESS_WIDTH;
      const y = (pixel / PROCESS_WIDTH) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && mask[pixel - 1]) {
        mask[pixel - 1] = 0;
        queue[tail++] = pixel - 1;
      }
      if (x + 1 < PROCESS_WIDTH && mask[pixel + 1]) {
        mask[pixel + 1] = 0;
        queue[tail++] = pixel + 1;
      }
      if (y > 0 && mask[pixel - PROCESS_WIDTH]) {
        mask[pixel - PROCESS_WIDTH] = 0;
        queue[tail++] = pixel - PROCESS_WIDTH;
      }
      if (y + 1 < PROCESS_HEIGHT && mask[pixel + PROCESS_WIDTH]) {
        mask[pixel + PROCESS_WIDTH] = 0;
        queue[tail++] = pixel + PROCESS_WIDTH;
      }
    }

    if (!largest || tail > largest.area) {
      largest = { area: tail, minX, minY, maxX, maxY };
    }
  }

  if (!largest) return null;
  const boxWidth = largest.maxX - largest.minX + 1;
  const boxHeight = largest.maxY - largest.minY + 1;
  const boxArea = boxWidth * boxHeight;
  const fillRatio = largest.area / boxArea;
  if (
    largest.area < MIN_DETECTION_PIXELS ||
    largest.area > mask.length * MAX_DETECTION_FRACTION ||
    fillRatio < 0.12
  ) {
    return null;
  }
  return largest;
}

function processCameraDetection(slot) {
  if (!slot.stream) {
    setDetectionReadout(slot, "WAITING", "waiting");
    clearDetectionOverlay(slot);
    return;
  }
  if (!selectedDiscColor) {
    setDetectionReadout(slot, "SELECT COLOR", "waiting");
    clearDetectionOverlay(slot);
    return;
  }
  if (colorPicking) {
    setDetectionReadout(slot, slot === cameraSlots[0] ? "CLICK DISC" : "SELECT COLOR", "selecting");
    clearDetectionOverlay(slot);
    return;
  }

  const crop = drawVideoToProcessingCanvas(slot);
  if (!crop) {
    setDetectionReadout(slot, "NO DISC", "no-disc");
    clearDetectionOverlay(slot);
    return;
  }

  try {
    const frame = slot.processingContext.getImageData(0, 0, PROCESS_WIDTH, PROCESS_HEIGHT);
    const region = findLargestColorRegion(slot, frame);
    if (!region) {
      if (slot === cameraSlots[0]) lastCamera1Detection = null;
      setDetectionReadout(slot, "NO DISC", "no-disc");
      clearDetectionOverlay(slot);
      return;
    }

    const normalizedX = (region.minX + region.maxX + 1) / (2 * PROCESS_WIDTH);
    const normalizedY = (region.minY + region.maxY + 1) / (2 * PROCESS_HEIGHT);
    const sourceX = Math.round(crop.x + normalizedX * crop.width);
    const sourceY = Math.round(crop.y + normalizedY * crop.height);
    if (slot === cameraSlots[0]) recordCamera1Speed(sourceX, sourceY, performance.now());
    setDetectionReadout(
      slot,
      "DISC DETECTED",
      "detected",
      `X ${sourceX} px · Y ${sourceY} px`,
    );
    drawDetectionOverlay(slot, region);
  } catch {
    setDetectionReadout(slot, "NO DISC", "no-disc");
    clearDetectionOverlay(slot);
    detectionSetupHint.textContent = "Frame analysis failed. Try restarting the camera previews.";
  }
}

function runDetectionFrame(timestamp) {
  detectionAnimationFrame = 0;
  if (!selectedDiscColor || colorPicking || document.hidden) return;

  if (timestamp - lastDetectionAt >= DETECTION_INTERVAL_MS) {
    lastDetectionAt = timestamp;
    cameraSlots.forEach(processCameraDetection);
  }
  if (cameraSlots.some((slot) => slot.stream)) {
    detectionAnimationFrame = requestAnimationFrame(runDetectionFrame);
  }
}

function startDetectionLoop() {
  if (
    !selectedDiscColor ||
    colorPicking ||
    document.hidden ||
    !cameraSlots.some((slot) => slot.stream) ||
    detectionAnimationFrame
  ) {
    return;
  }
  detectionAnimationFrame = requestAnimationFrame(runDetectionFrame);
}

function stopDetectionLoop() {
  if (detectionAnimationFrame) {
    cancelAnimationFrame(detectionAnimationFrame);
    detectionAnimationFrame = 0;
  }
}

function setColorPicking(active) {
  colorPicking = active;
  selectDiscColorButton.setAttribute("aria-pressed", String(active));
  cameraSlots[0].preview.classList.toggle("is-color-picking", active);
  if (active) {
    stopDetectionLoop();
    cameraSlots.forEach((slot) => {
      setDetectionReadout(
        slot,
        slot === cameraSlots[0] ? "CLICK DISC" : "SELECT COLOR",
        "selecting",
      );
      clearDetectionOverlay(slot);
    });
    detectionSetupHint.textContent = "Color selection is active. Click the disc inside the Camera 1 video.";
    return;
  }

  if (selectedDiscColor) {
    cameraSlots.forEach((slot) => setDetectionReadout(slot, "NO DISC", "no-disc"));
    detectionSetupHint.textContent = "Scanning both camera feeds locally for the sampled disc color.";
    startDetectionLoop();
  } else {
    cameraSlots.forEach((slot) => setDetectionReadout(slot, "SELECT COLOR", "waiting"));
    detectionSetupHint.textContent = "Start both cameras, select a color, then click the disc in the Camera 1 preview.";
  }
}

function sampleDiscColor(event) {
  if (!colorPicking) return;
  event.preventDefault();

  const slot = cameraSlots[0];
  const crop = getVideoSourceCrop(slot);
  const rect = slot.video.getBoundingClientRect();
  if (!crop || slot.video.readyState < 2 || !rect.width || !rect.height) {
    detectionSetupHint.textContent = "Wait for Camera 1 to show a live frame, then click the disc.";
    return;
  }

  drawVideoToProcessingCanvas(slot, crop);
  const x = Math.max(
    0,
    Math.min(PROCESS_WIDTH - 1, Math.floor(((event.clientX - rect.left) / rect.width) * PROCESS_WIDTH)),
  );
  const y = Math.max(
    0,
    Math.min(PROCESS_HEIGHT - 1, Math.floor(((event.clientY - rect.top) / rect.height) * PROCESS_HEIGHT)),
  );
  const left = Math.max(0, x - 1);
  const top = Math.max(0, y - 1);
  const sampleWidth = Math.min(PROCESS_WIDTH - left, 3);
  const sampleHeight = Math.min(PROCESS_HEIGHT - top, 3);
  const sample = slot.processingContext.getImageData(left, top, sampleWidth, sampleHeight).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let offset = 0; offset < sample.length; offset += 4) {
    if (sample[offset + 3] < 96) continue;
    red += sample[offset];
    green += sample[offset + 1];
    blue += sample[offset + 2];
    count += 1;
  }
  if (!count) {
    detectionSetupHint.textContent = "That point was not visible. Click the disc again in Camera 1.";
    return;
  }

  selectedDiscColor = {
    r: Math.round(red / count),
    g: Math.round(green / count),
    b: Math.round(blue / count),
  };
  setColorPicking(false);
  const rgb = `rgb(${selectedDiscColor.r}, ${selectedDiscColor.g}, ${selectedDiscColor.b})`;
  discColorSwatch.style.backgroundColor = rgb;
  discColorValue.textContent = `RGB ${selectedDiscColor.r}, ${selectedDiscColor.g}, ${selectedDiscColor.b}`;
  detectionSetupHint.textContent = "Scanning both camera feeds locally for the sampled disc color.";
  startDetectionLoop();
}

function getStreamDeviceId(stream) {
  const track = stream?.getVideoTracks?.()[0];
  return track?.getSettings?.().deviceId || "";
}

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function getCameraDevices() {
  return cameraMediaDevices.enumerateDevices().then((devices) => {
    const videoInputs = devices.filter(
      (device) => device.kind === "videoinput" && device.deviceId,
    );
    const physicalInputs = videoInputs.filter(
      (device) => device.deviceId !== "default" && device.deviceId !== "communications",
    );
    const candidates = physicalInputs.length ? physicalInputs : videoInputs;
    return [...new Map(candidates.map((device) => [device.deviceId, device])).values()];
  });
}

function updateCameraOptionAvailability() {
  cameraSlots.forEach((slot) => {
    [...slot.select.options].forEach((option) => {
      option.disabled = false;
    });
  });
}

function populateCameraSelects(preferredIds = []) {
  const previousIds = cameraSlots.map((slot) => slot.select.value);

  cameraSlots.forEach((slot) => {
    slot.select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = availableVideoCameras.length
      ? "Choose a different webcam"
      : "No cameras listed yet";
    slot.select.append(placeholder);

    const labelCounts = new Map();
    availableVideoCameras.forEach((device) => {
      const label = device.label.trim();
      if (label) labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    });

    availableVideoCameras.forEach((device, index) => {
      const option = document.createElement("option");
      const label = device.label.trim() || `Camera ${index + 1}`;
      option.value = device.deviceId;
      option.textContent =
        labelCounts.get(label) > 1 ? `${label} (${index + 1})` : label;
      slot.select.append(option);
    });
  });

  const firstId =
    availableVideoCameras.find((device) => device.deviceId === preferredIds[0])?.deviceId ||
    availableVideoCameras.find((device) => device.deviceId === previousIds[0])?.deviceId ||
    availableVideoCameras[0]?.deviceId ||
    "";
  const secondId =
    availableVideoCameras.find(
      (device) =>
        device.deviceId === preferredIds[1] && device.deviceId !== firstId,
    )?.deviceId ||
    availableVideoCameras.find(
      (device) =>
        device.deviceId === previousIds[1] && device.deviceId !== firstId,
    )?.deviceId ||
    availableVideoCameras.find((device) => device.deviceId !== firstId)?.deviceId ||
    "";

  cameraSlots[0].select.value = firstId;
  cameraSlots[1].select.value = secondId;
  cameraSlots.forEach((slot) => {
    slot.lastSelectedId = slot.select.value;
  });
  updateCameraOptionAvailability();
}

async function refreshCameraChoices(preferredIds = []) {
  availableVideoCameras = await getCameraDevices();
  populateCameraSelects(preferredIds);
  return availableVideoCameras;
}

function updateCameraButtons() {
  const hasActiveStream = cameraSlots.some((slot) => slot.stream);
  const bothActive = cameraSlots.every((slot) => slot.stream);
  cameraStartButton.disabled = !cameraApiAvailable || cameraStarting || bothActive;
  cameraStopButton.disabled = !cameraStarting && !hasActiveStream;
  selectDiscColorButton.disabled =
    !cameraApiAvailable ||
    !detectionCanvasAvailable ||
    !cameraSlots[0].stream ||
    cameraStarting;
  selectDiscColorButton.setAttribute("aria-pressed", String(colorPicking));
  cameraSlots.forEach((slot) => {
    slot.select.disabled = !cameraApiAvailable || cameraStarting;
  });
  updateCalibrationButtonState();
}

function getCameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access in your browser settings, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No webcam was found. Check that both cameras are connected.";
    case "NotReadableError":
    case "TrackStartError":
      return "A webcam could not be opened. It may be in use by another app.";
    case "OverconstrainedError":
      return "The selected webcam is unavailable. Choose another camera and try again.";
    default:
      return "A camera could not be started. Check browser permissions and try again.";
  }
}

function getCameraStream(deviceId) {
  const video = { frameRate: { ideal: 60 } };
  if (deviceId) video.deviceId = { exact: deviceId };
  return cameraMediaDevices.getUserMedia({ audio: false, video });
}

function setCameraSlotLive(index, stream) {
  const slot = cameraSlots[index];
  slot.stream = stream;
  slot.video.srcObject = stream;
  slot.placeholder.hidden = true;
  clearDetectionOverlay(slot);
  if (!selectedDiscColor && !colorPicking) {
    setDetectionReadout(slot, "SELECT COLOR", "waiting");
  }

  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings?.() || {};
  const camera = availableVideoCameras.find(
    (device) => device.deviceId === (settings.deviceId || slot.select.value),
  );
  const fps = Number.isFinite(settings.frameRate)
    ? `${Math.round(settings.frameRate)} FPS`
    : "Live";
  slot.state.textContent = `LIVE · ${fps}`;
  slot.state.dataset.state = "live";
  slot.details.textContent = camera?.label
    ? `${camera.label} · ${fps}`
    : `Live preview · ${fps}`;

  track?.addEventListener?.("ended", () => {
    if (slot.stream !== stream) return;
    slot.stream = null;
    slot.video.srcObject = null;
    slot.placeholder.hidden = false;
    slot.state.textContent = "DISCONNECTED";
    slot.state.dataset.state = "error";
    slot.details.textContent = "The camera disconnected. Choose a webcam and try again.";
    clearDetectionOverlay(slot);
    setDetectionReadout(slot, selectedDiscColor ? "WAITING" : "SELECT COLOR", "waiting");
    if (index === 0 && colorPicking) setColorPicking(false);
    updateCameraButtons();
    setCameraStatus(`${slot.label} disconnected. Check the connection and restart it.`, "error");
  });

  const playback = slot.video.play?.();
  if (playback && typeof playback.catch === "function") {
    playback.catch(() => {
      setCameraStatus(
        `${slot.label} is connected, but its preview could not play. Try starting the cameras again.`,
        "error",
      );
    });
  }
  startDetectionLoop();
}

function clearCameraSlot(index) {
  const slot = cameraSlots[index];
  const stream = slot.stream;
  slot.stream = null;
  if (index === 0 && colorPicking) {
    colorPicking = false;
    selectDiscColorButton.setAttribute("aria-pressed", "false");
    slot.preview.classList.remove("is-color-picking");
  }
  slot.video.srcObject = null;
  slot.placeholder.hidden = false;
  slot.state.textContent = "STANDBY";
  slot.state.dataset.state = "idle";
  slot.details.textContent = "Camera access starts when you click Start Cameras.";
  clearDetectionOverlay(slot);
  setDetectionReadout(slot, selectedDiscColor ? "WAITING" : "SELECT COLOR", "waiting");
  stopMediaStream(stream);
}

async function switchCamera(index, requestedId) {
  const slot = cameraSlots[index];
  const previousId = slot.lastSelectedId || getStreamDeviceId(slot.stream);
  const switchToken = ++slot.switchToken;

  if (!requestedId) {
    clearCameraSlot(index);
    slot.lastSelectedId = "";
    updateCameraButtons();
    setCameraStatus(`${slot.label} preview stopped.`, "info");
    return;
  }

  setCameraStatus(`Switching ${slot.label.toLowerCase()}…`, "info");
  try {
    const nextStream = await getCameraStream(requestedId);
    if (switchToken !== slot.switchToken) {
      stopMediaStream(nextStream);
      return;
    }

    const nextDeviceId = getStreamDeviceId(nextStream) || requestedId;
    const otherDeviceId =
      getStreamDeviceId(cameraSlots[1 - index].stream) ||
      cameraSlots[1 - index].select.value;
    if (nextDeviceId && nextDeviceId === otherDeviceId) {
      stopMediaStream(nextStream);
      slot.select.value = previousId;
      setCameraStatus("Choose a different webcam for each preview.", "error");
      updateCameraOptionAvailability();
      return;
    }

    const previousStream = slot.stream;
    setCameraSlotLive(index, nextStream);
    slot.lastSelectedId = nextDeviceId;
    stopMediaStream(previousStream);
    updateCameraButtons();
    setCameraStatus("Both previews use separate cameras. Select either list to switch its webcam.");
  } catch (error) {
    if (switchToken !== slot.switchToken) return;
    slot.select.value = previousId;
    slot.lastSelectedId = previousId;
    updateCameraOptionAvailability();
    setCameraStatus(getCameraErrorMessage(error), "error");
  }
}

async function restartAfterCameraSwap() {
  cameraStarting = true;
  const runToken = ++cameraStartToken;
  cameraSlots.forEach((slot, index) => {
    slot.switchToken += 1;
    clearCameraSlot(index);
  });
  updateCameraButtons();
  setCameraStatus("Switching the webcam assignments…");

  try {
    for (let index = 0; index < cameraSlots.length; index += 1) {
      const slot = cameraSlots[index];
      const requestedId = slot.select.value;
      if (!requestedId) continue;

      const stream = await getCameraStream(requestedId);
      if (runToken !== cameraStartToken) {
        stopMediaStream(stream);
        return;
      }

      const actualId = getStreamDeviceId(stream) || requestedId;
      const firstId =
        getStreamDeviceId(cameraSlots[0].stream) || cameraSlots[0].select.value;
      if (index === 1 && actualId === firstId) {
        stopMediaStream(stream);
        setCameraStatus("Choose a different webcam for each preview.", "error");
        return;
      }

      setCameraSlotLive(index, stream);
      slot.lastSelectedId = actualId;
    }

    if (cameraSlots.every((slot) => slot.stream)) {
      setCameraStatus("Both previews are live with the new camera assignments.", "success");
    } else {
      setCameraStatus("Camera assignments updated. Start Cameras to open both previews.");
    }
  } catch (error) {
    const partialPreview = cameraSlots.some((slot) => slot.stream);
    const prefix = partialPreview ? "One preview is live. " : "";
    setCameraStatus(`${prefix}${getCameraErrorMessage(error)}`, "error");
  } finally {
    if (runToken === cameraStartToken) {
      cameraStarting = false;
      updateCameraButtons();
    }
  }
}

function handleCameraSelectionChange(index) {
  const slot = cameraSlots[index];
  const otherSlot = cameraSlots[1 - index];
  const selectedId = slot.select.value;

  if (selectedId && selectedId === otherSlot.select.value) {
    const previousId = slot.lastSelectedId || getStreamDeviceId(slot.stream);
    if (!previousId || previousId === selectedId) {
      slot.select.value = previousId;
      updateCameraOptionAvailability();
      setCameraStatus("Select two different webcams for the previews.", "error");
      return;
    }

    otherSlot.select.value = previousId;
    slot.lastSelectedId = selectedId;
    otherSlot.lastSelectedId = previousId;
    updateCameraOptionAvailability();
    if (cameraSlots.some((camera) => camera.stream)) {
      void restartAfterCameraSwap();
    } else {
      setCameraStatus("Camera assignments swapped. Start Cameras when you are ready to preview both feeds.");
    }
    return;
  }

  updateCameraOptionAvailability();
  if (slot.stream) {
    void switchCamera(index, selectedId);
    return;
  }

  slot.lastSelectedId = selectedId;
  setCameraStatus("Camera selected. Start Cameras when you are ready to preview both feeds.");
}

async function startCameras() {
  if (!cameraApiAvailable) {
    setCameraStatus(
      "Camera previews need a secure browser connection and MediaDevices support.",
      "error",
    );
    return;
  }
  if (cameraStarting || cameraSlots.every((slot) => slot.stream)) return;

  cameraStarting = true;
  const runToken = ++cameraStartToken;
  updateCameraButtons();
  setCameraStatus("Requesting camera permission…");

  try {
    if (!cameraSlots[0].stream) {
      const firstStream = await getCameraStream(cameraSlots[0].select.value);
      if (runToken !== cameraStartToken) {
        stopMediaStream(firstStream);
        return;
      }
      setCameraSlotLive(0, firstStream);
      const firstDeviceId =
        getStreamDeviceId(firstStream) || cameraSlots[0].select.value;
      await refreshCameraChoices([firstDeviceId, cameraSlots[1].select.value]);
    }
    if (runToken !== cameraStartToken) return;

    const firstDeviceId =
      getStreamDeviceId(cameraSlots[0].stream) || cameraSlots[0].select.value;
    let secondDeviceId = cameraSlots[1].select.value;
    if (!secondDeviceId || secondDeviceId === firstDeviceId) {
      const alternative = availableVideoCameras.find(
        (device) => device.deviceId !== firstDeviceId,
      );
      secondDeviceId = alternative?.deviceId || "";
      cameraSlots[1].select.value = secondDeviceId;
      cameraSlots[1].lastSelectedId = secondDeviceId;
      updateCameraOptionAvailability();
    }

    if (!secondDeviceId || secondDeviceId === firstDeviceId) {
      setCameraStatus(
        "Camera 1 is live. Connect or select a second webcam to show both previews.",
        "error",
      );
      return;
    }

    const existingSecondId = getStreamDeviceId(cameraSlots[1].stream);
    if (!cameraSlots[1].stream || existingSecondId !== secondDeviceId) {
      const secondStream = await getCameraStream(secondDeviceId);
      if (runToken !== cameraStartToken) {
        stopMediaStream(secondStream);
        return;
      }

      const actualSecondId = getStreamDeviceId(secondStream) || secondDeviceId;
      if (actualSecondId === firstDeviceId) {
        stopMediaStream(secondStream);
        setCameraStatus("Choose a different webcam for each preview.", "error");
        return;
      }

      const previousSecondStream = cameraSlots[1].stream;
      setCameraSlotLive(1, secondStream);
      cameraSlots[1].lastSelectedId = actualSecondId;
      stopMediaStream(previousSecondStream);
    }

    const firstFps = cameraSlots[0].state.textContent.replace("LIVE · ", "");
    const secondFps = cameraSlots[1].state.textContent.replace("LIVE · ", "");
    setCameraStatus(
      `Both camera previews are live (${firstFps} / ${secondFps}). 60 FPS is requested when supported; 30 FPS cameras work too.`,
      "success",
    );
  } catch (error) {
    const partialPreview = cameraSlots.some((slot) => slot.stream);
    const prefix = partialPreview ? "One preview is live. " : "";
    setCameraStatus(`${prefix}${getCameraErrorMessage(error)}`, "error");
  } finally {
    if (runToken === cameraStartToken) {
      cameraStarting = false;
      updateCameraButtons();
    }
  }
}

function stopCameras() {
  cameraStartToken += 1;
  cameraStarting = false;
  stopDetectionLoop();
  if (colorPicking) {
    colorPicking = false;
    selectDiscColorButton.setAttribute("aria-pressed", "false");
    cameraSlots[0].preview.classList.remove("is-color-picking");
  }
  cameraSlots.forEach((slot, index) => {
    slot.switchToken += 1;
    clearCameraSlot(index);
  });
  updateCameraButtons();
  setCameraStatus("Cameras stopped. No video is being previewed.");
  detectionSetupHint.textContent = selectedDiscColor
    ? "Disc color saved. Start the cameras to resume local detection."
    : "Start both cameras, select a color, then click the disc in the Camera 1 preview.";
}

cameraSlots.forEach((slot, index) => {
  slot.select.addEventListener("change", () => handleCameraSelectionChange(index));
});
cameraStartButton.addEventListener("click", () => void startCameras());
cameraStopButton.addEventListener("click", stopCameras);
selectDiscColorButton.addEventListener("click", () => {
  if (!cameraSlots[0].stream || !detectionCanvasAvailable) return;
  setColorPicking(!colorPicking);
});
cameraSlots[0].video.addEventListener("click", sampleDiscColor);
sensitivityOutput.textContent = sensitivityInput.value;
sensitivityInput.addEventListener("input", () => {
  sensitivityOutput.textContent = sensitivityInput.value;
});
cameraSlots.forEach((slot) => {
  setDetectionReadout(slot, "SELECT COLOR", "waiting");
});
if (!detectionCanvasAvailable) {
  detectionSetupHint.textContent = "Canvas processing is unavailable in this browser.";
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) startDetectionLoop();
});

if (cameraApiAvailable) {
  setCameraStatus("Choose two webcams. Browser permission is requested when you start.");
  refreshCameraChoices().then(() => {
    if (!availableVideoCameras.length) {
      setCameraStatus("No cameras listed yet. Click Start Cameras to allow access and refresh the list.");
    }
    updateCameraButtons();
  }).catch(() => {
    setCameraStatus("The camera list is unavailable yet. Click Start Cameras to request access.");
    updateCameraButtons();
  });

  cameraMediaDevices.addEventListener?.("devicechange", () => {
    const preferredIds = cameraSlots.map(
      (slot) => getStreamDeviceId(slot.stream) || slot.select.value,
    );
    refreshCameraChoices(preferredIds).catch(() => {
      setCameraStatus("The camera list could not be refreshed.", "error");
    });
  });
} else {
  setCameraStatus(
    "Camera previews need a secure browser connection and MediaDevices support.",
    "error",
  );
  updateCameraButtons();
}
