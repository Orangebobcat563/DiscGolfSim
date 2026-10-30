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

const HOLES = [
  { number: 1, name: "Opening Lane", distance: 300, par: 3, note: "Straight, with a little room to shape it." },
  { number: 2, name: "Pine Gap", distance: 245, par: 3, note: "Short and technical. Keep the line controlled." },
  { number: 3, name: "Long Meadow", distance: 410, par: 4, note: "Open distance hole. Placement matters on the second shot." },
  { number: 4, name: "Left Bend", distance: 330, par: 3, note: "The fairway favors a controlled finish to the left." },
  { number: 5, name: "Creek Run", distance: 285, par: 3, note: "A narrow landing zone rewards accuracy." },
  { number: 6, name: "Big Drive", distance: 475, par: 4, note: "The longest hole. Get distance, then attack the basket." },
  { number: 7, name: "Right Window", distance: 315, par: 3, note: "Shape the flight through the right-side window." },
  { number: 8, name: "Uphill Finish", distance: 360, par: 4, note: "A longer approach makes disc choice important." },
  { number: 9, name: "Home Stretch", distance: 390, par: 4, note: "One last controlled drive before the finish." },
];

let currentHoleIndex = 0;
let currentLie = { lateral: 0, downrange: 0 };
let strokesThisHole = 0;
let holeScores = Array(HOLES.length).fill(null);
let holeComplete = false;

const holeChip = document.querySelector("#hole-chip");
const holeNameText = document.querySelector("#hole-name");
const holeMetaText = document.querySelector("#hole-meta");
const distanceNumber = document.querySelector("#hole-distance-number");
const teeLabel = document.querySelector("#tee-label");
const basketDistanceText = document.querySelector("#basket-distance-text");
const sceneCaption = document.querySelector("#scene-caption");
const strokeCountText = document.querySelector("#stroke-count");
const roundScoreText = document.querySelector("#round-score");
const nextHoleButton = document.querySelector("#next-hole");
const newRoundButton = document.querySelector("#new-round");
const scorecardBody = document.querySelector("#scorecard-body");

function currentHole() {
  return HOLES[currentHoleIndex];
}

function holeScale() {
  return 200 / currentHole().distance;
}

function worldToScreen(point) {
  const scale = holeScale();
  return {
    x: tee.x + point.lateral * scale,
    y: tee.y - point.downrange * scale,
  };
}

function remainingToBasket(point = currentLie) {
  return Math.hypot(currentHole().distance - point.downrange, point.lateral);
}

function roundRelativeToPar() {
  return holeScores.reduce((total, strokes, index) => {
    if (strokes == null) return total;
    return total + strokes - HOLES[index].par;
  }, 0);
}

function formatRelative(score) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : String(score);
}

function renderScorecard() {
  if (!scorecardBody) return;
  scorecardBody.innerHTML = HOLES.map((hole, index) => {
    const score = holeScores[index];
    const active = index === currentHoleIndex ? " active" : "";
    return `<div class="scorecard-hole${active}">
      <span>${hole.number}</span>
      <small>PAR ${hole.par}</small>
      <strong>${score == null ? "—" : score}</strong>
    </div>`;
  }).join("");
}

function updateRoundUI() {
  const hole = currentHole();
  if (holeChip) holeChip.innerHTML = `<span class="status-dot"></span> 9-HOLE ROUND <span class="chip-divider">/</span> HOLE ${String(hole.number).padStart(2, "0")}`;
  if (holeNameText) holeNameText.textContent = `${hole.name.toUpperCase()} · PAR ${hole.par}`;
  if (holeMetaText) holeMetaText.innerHTML = `${hole.distance} FT <i></i> HOLE ${hole.number} OF ${HOLES.length}`;
  if (distanceNumber) distanceNumber.textContent = String(Math.round(remainingToBasket()));
  if (teeLabel) teeLabel.innerHTML = `<span class="tee-dot"></span> ${strokesThisHole === 0 ? `TEE ${String(hole.number).padStart(2, "0")}` : `LIE · SHOT ${strokesThisHole + 1}`} <span>${strokesThisHole === 0 ? "YOU ARE HERE" : `${Math.round(remainingToBasket())} FT LEFT`}</span>`;
  if (basketDistanceText) basketDistanceText.textContent = `${Math.round(remainingToBasket())} FT`;
  if (sceneCaption) sceneCaption.innerHTML = `${strokesThisHole === 0 ? "VIEW FROM THE TEE" : "PLAYING FROM YOUR LIE"} <span>·</span> ${hole.note.toUpperCase()}`;
  if (strokeCountText) strokeCountText.textContent = String(strokesThisHole);
  if (roundScoreText) roundScoreText.textContent = formatRelative(roundRelativeToPar());
  if (nextHoleButton) {
    nextHoleButton.hidden = !holeComplete;
    nextHoleButton.textContent = currentHoleIndex === HOLES.length - 1 ? "Finish round" : "Next hole →";
  }
  renderScorecard();
}

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
  const profile = getDiscProfile();

  const requiredMph = 24 + profile.speed * 2.7;
  const speedActivation = Math.max(0.25, Math.min(1.12, speed / requiredMph));
  const launchEfficiency = Math.max(0.68, 1 - Math.pow((launchAngle - 11) / 24, 2) * 0.16);
  const releaseAngleEfficiency = Math.max(0.76, 1 - Math.abs(hyzerAngle) * 0.0022);
  const discSpeedPotential = 0.94 + Math.min(profile.speed, 12) * 0.008;
  const underSpeedPenalty = 1 - Math.max(0, 0.92 - speedActivation) * (0.18 + profile.speed * 0.008);
  const glideCarry = 1 + (profile.glide - 4) * 0.04 * Math.min(1, speedActivation + 0.15);
  const turnCarry = 1 + Math.max(0, -profile.turn) * 0.009 * Math.min(1, speedActivation);
  const fadeCost = 1 - profile.fade * 0.012 * (0.75 + Math.max(0, 1 - speedActivation) * 0.5);
  // Softer throws lose more distance, while normal/hard drives stay close
  // to the existing tuning. This makes touch shots actually feel like touch shots.
  const slowThrowFactor = Math.max(0.24, Math.min(0.94, 0.24 + speed * 0.0115));
  const baseDistance = (4.05 * speed + 0.0095 * speed * speed) * slowThrowFactor;
  // Simulator quick-disc class. Driver keeps full distance; mids/putters trade
  // distance for control, approximating normal real-world relative ranges.
  const simDiscType = window.simDiscType || "driver";
  const simClass = simDiscType === "putter"
    ? { distance: 0.62, turn: 0.55, fade: 0.62 }
    : simDiscType === "midrange"
      ? { distance: 0.79, turn: 0.72, fade: 0.78 }
      : { distance: 1.00, turn: 1.00, fade: 1.00 };
  const distance = (Math.round(Math.max(20,
    baseDistance * launchEfficiency * releaseAngleEfficiency *
    discSpeedPotential * underSpeedPenalty * glideCarry * turnCarry * fadeCost
  ))) * simClass.distance;

  const targetForward = currentHole().distance - currentLie.downrange;
  const targetLateral = -currentLie.lateral;
  const targetBearing = Math.atan2(targetLateral, targetForward);
  const aimRadians = targetBearing + (aimAngle * Math.PI) / 180;

  const flightDirection = getFlightDirection(profile.style);
  const turnDrift = (-profile.turn) * Math.pow(speedActivation, 1.35) * (distance / 300) * 15 * -flightDirection;
  const fadeActivation = 0.72 + Math.max(0, 1 - speedActivation) * 0.8;
  const fadeDrift = profile.fade * fadeActivation * (distance / 300) * 13 * flightDirection;
  const releaseDrift = hyzerAngle * (distance / 300) * 1.25;
  const shapeDrift = turnDrift + fadeDrift + releaseDrift;

  const forwardDelta = distance * Math.cos(aimRadians);
  const lateralDelta = distance * Math.sin(aimRadians) + shapeDrift;
  const landingWorld = {
    lateral: currentLie.lateral + lateralDelta,
    downrange: currentLie.downrange + forwardDelta,
  };
  const landingScreen = worldToScreen(landingWorld);
  const remaining = Math.round(remainingToBasket(landingWorld));

  return {
    speed, launchAngle, distance, profile, turnDrift, fadeDrift,
    remaining,
    startWorld: { ...currentLie },
    landingWorld,
    x: landingScreen.x,
    y: landingScreen.y,
    lateral: lateralDelta,
    downrange: forwardDelta,
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
  strokesThisHole += 1;
  currentLie = { ...shot.landingWorld };
  const remaining = Math.round(remainingToBasket());

  disc.classList.remove("in-flight");
  disc.setAttribute("transform", `translate(${shot.x} ${shot.y}) rotate(${shot.lateral > 0 ? 8 : -8})`);
  landingMarker.setAttribute("transform", `translate(${shot.x} ${shot.y})`);
  landingMarker.style.opacity = "1";
  flightPath.style.opacity = ".85";
  shotResults.hidden = false;
  resultDistance.textContent = `${shot.distance} ft`;

  // A throw that finishes within 12 ft is treated as made so the camera simulator
  // can complete a hole without needing to model chains/cage physics.
  if (remaining <= 12) {
    holeComplete = true;
    holeScores[currentHoleIndex] = strokesThisHole;
    remainingLabel.textContent = "HOLE COMPLETE";
    resultRemaining.textContent = `${strokesThisHole} ${strokesThisHole === 1 ? "throw" : "throws"}`;
    announce(`Hole ${currentHole().number} complete in ${strokesThisHole} throws.`);
  } else {
    remainingLabel.textContent = "TO THE BASKET";
    resultRemaining.textContent = `${remaining} ft`;
    announce(`Landed ${shot.distance} feet. ${remaining} feet to the basket. Your next throw starts from this lie.`);
  }

  if (throwButton) throwButton.disabled = holeComplete;
  if (throwButton) throwButton.innerHTML = '<span class="throw-icon" aria-hidden="true">➜</span> Throw again';
  updateRoundUI();
}

function throwDisc(event) {
  if (event) event.preventDefault();
  if (holeComplete) return;

  cancelAnimationFrame(animationFrame);
  const id = ++shotId;
  const shot = getShot();
  const start = worldToScreen(shot.startWorld);
  const apex = Math.max(31, shot.launchAngle * 2.7);
  const turnPixels = shot.turnDrift * holeScale();
  const control1 = {
    x: start.x + (shot.x - start.x) * 0.08 + turnPixels * 0.65,
    y: start.y + (shot.y - start.y) * 0.23 - apex,
  };
  const control2 = {
    x: start.x + (shot.x - start.x) * 0.58 + turnPixels,
    y: shot.y - Math.abs(shot.y - start.y) * 0.23 - apex * 0.6,
  };

  flightPath.setAttribute("d", `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${shot.x} ${shot.y}`);
  flightPath.style.opacity = ".82";
  flightPath.style.strokeDasharray = "1";
  flightPath.style.strokeDashoffset = "1";
  flightPath.setAttribute("pathLength", "1");
  landingMarker.style.opacity = "0";
  shotResults.hidden = true;
  disc.setAttribute("transform", `translate(${start.x} ${start.y})`);
  disc.classList.add("in-flight");
  if (throwButton) throwButton.disabled = true;
  announce(`${shot.profile.name} · shot ${strokesThisHole + 1} on hole ${currentHole().number} is in the air.`);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 90 : Math.max(1150, Math.min(2400, 900 + shot.distance * 3));
  const started = performance.now();

  function animate(now) {
    if (id !== shotId) return;
    const progress = Math.min(1, (now - started) / duration);
    const point = cubicPoint(progress, start, control1, control2, shot);
    const tilt = (shot.lateral >= 0 ? 1 : -1) * Math.sin(progress * Math.PI * 5) * 12;
    disc.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${tilt})`);
    flightPath.style.strokeDashoffset = String(1 - progress);
    if (progress < 1) animationFrame = requestAnimationFrame(animate);
    else finishShot(shot, id);
  }
  animationFrame = requestAnimationFrame(animate);
}

function resetHole() {
  shotId += 1;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  currentLie = { lateral: 0, downrange: 0 };
  strokesThisHole = 0;
  holeComplete = false;
  holeScores[currentHoleIndex] = null;
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
  if (throwButton) throwButton.disabled = false;
  updateRoundUI();
}

function startHole(index) {
  currentHoleIndex = index;
  currentLie = { lateral: 0, downrange: 0 };
  strokesThisHole = 0;
  holeComplete = false;
  shotId += 1;
  cancelAnimationFrame(animationFrame);
  disc.classList.remove("in-flight");
  disc.setAttribute("transform", `translate(${tee.x} ${tee.y})`);
  flightPath.setAttribute("d", "");
  flightPath.style.opacity = "0";
  landingMarker.style.opacity = "0";
  shotResults.hidden = true;
  flightLive.classList.remove("visible");
  updateRoundUI();
}

function nextHole() {
  if (!holeComplete) return;
  if (currentHoleIndex < HOLES.length - 1) {
    startHole(currentHoleIndex + 1);
  } else {
    const total = holeScores.reduce((sum, value) => sum + (value || 0), 0);
    announce(`Round complete: ${total} throws, ${formatRelative(roundRelativeToPar())} to par.`);
    if (nextHoleButton) nextHoleButton.hidden = true;
  }
}

function newRound() {
  holeScores = Array(HOLES.length).fill(null);
  currentHoleIndex = 0;
  startHole(0);
}

form.addEventListener("submit", throwDisc);
resetButton.addEventListener("click", resetHole);
if (nextHoleButton) nextHoleButton.addEventListener("click", nextHole);
if (newRoundButton) newRoundButton.addEventListener("click", newRound);
updateLabels();
updateRoundUI();

const cameraSimValuesText = document.querySelector("#camera-sim-values");
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
const PROCESS_WIDTH = 400;
const PROCESS_HEIGHT = 225;
const MIN_DETECTION_PIXELS = 12;
const MAX_DETECTION_FRACTION = 0.28;
const DETECTION_INTERVAL_MS = 12;
let selectedDiscColor = null;
let colorPicking = false;
let detectionAnimationFrame = 0;
let lastDetectionAt = -Infinity;

let speedCalibrationActive = false;
let speedCalibrationPoints = [];
let pixelsPerInch = null;
let lastCamera1Detection = null;
let camera1TrackHistory = [];
let camera1Velocity = { x: 0, y: 0 };
let camera1LastRegionCenter = null;
let throwValidationState = "waiting";
let throwValidationSamples = [];
let throwLockStartedAt = -Infinity;
let throwLastDiscSeenAt = -Infinity;
const THROW_CONFIRM_FRAMES = 3;
const THROW_MIN_VALID_MPH = 12;
const THROW_LOCK_MS = 700;
const THROW_REARM_ABSENCE_MS = 450;
let camera1ThrowSide = "left";
let camera1ThrowSideSetupActive = false;
let camera1ThrowSideSetupPoint = null;
let camera1DirectionSamples = [];
let camera1PredictedMisses = 0;
let camera1LastGoodDetectionAt = -Infinity;
const CAMERA1_MAX_PREDICTED_MISSES = 3;
const CAMERA1_PREDICTION_SEARCH_RADIUS = 115;



let measuredThrowSpeedMph = null;
let nextThrowLocked = false;
let liveThrowArmed = false;
let recentThrowSpeeds = [];

let lastCamera2Detection = null;
let camera2AimDegrees = null;
let camera2HyzerDegrees = null;
let smoothedCamera2HyzerDegrees = 0;
let camera2Roundness = null;
let camera2MeasurementAt = -Infinity;
let camera2LastSeenAt = -Infinity;

let autoThrowTimer = null;
let lastAutomaticThrowAt = -Infinity;
let discDetectionStartedAt = -Infinity;
let detectionThrowArmed = true;
const DETECTION_THROW_DELAY_MS = 90;
const DETECTION_REARM_MS = 450;

const AUTO_THROW_COOLDOWN_MS = 1800;
const AUTO_THROW_SETTLE_MS = 140;
const AUTO_THROW_MIN_MPH = 2;


function triggerThrowFromDiscDetection(timestamp) {
  // SPACE/button locks the next real detection. The speed is allowed
  // to come from this same throw; no previous measured speed is required.
  if (!nextThrowLocked) return;

  if (timestamp - lastAutomaticThrowAt < AUTO_THROW_COOLDOWN_MS) return;

  if (!Number.isFinite(discDetectionStartedAt) || discDetectionStartedAt < 0) {
    discDetectionStartedAt = timestamp;
  }

  clearTimeout(autoThrowTimer);

  // Give Camera 2 a very short window to report aim/roundness before launching.
  autoThrowTimer = setTimeout(() => {
    const now = performance.now();

    if (Number.isFinite(measuredThrowSpeedMph)) {
      const cameraSpeedForSim = measuredThrowSpeedMph < 25
        ? measuredThrowSpeedMph * 0.82
        : measuredThrowSpeedMph * 0.90;
      controls.speed.value = String(Math.round(
        Math.max(Number(controls.speed.min),
        Math.min(Number(controls.speed.max), cameraSpeedForSim))
      ));
    }

    const camera2IsFresh = now - camera2MeasurementAt < 1600;
    if (camera2IsFresh && Number.isFinite(camera2AimDegrees)) {
      controls.aim.value = String(Math.round(
        Math.max(Number(controls.aim.min),
        Math.min(Number(controls.aim.max), camera2AimDegrees))
      ));
    }
    if (camera2IsFresh && Number.isFinite(camera2HyzerDegrees)) {
      controls.hyzer.value = String(Math.round(
        Math.max(Number(controls.hyzer.min),
        Math.min(Number(controls.hyzer.max), camera2HyzerDegrees))
      ));
    }

    updateLabels();
    if (cameraSimValuesText) {
      const cameraAngle = Number(controls.hyzer.value);
      const angleName = cameraAngle === 0 ? "flat" : cameraAngle < 0 ? "hyzer" : "anhyzer";
      cameraSimValuesText.textContent =
        `${controls.speed.value} mph · aim ${Number(controls.aim.value).toFixed(1)}° · ${angleName} ${Math.abs(cameraAngle).toFixed(1)}°`;
    }
    lastAutomaticThrowAt = now;
    recentThrowSpeeds = [];
    camera1TrackHistory = [];
    lastCamera1Detection = null;

    if (speedCalibrationStatus) {
      const aimText = camera2IsFresh && Number.isFinite(camera2AimDegrees)
        ? `${Number(controls.aim.value)}° aim`
        : "aim unchanged";
      const hyzerText = camera2IsFresh && Number.isFinite(camera2HyzerDegrees)
        ? `${Number(controls.hyzer.value)}° hyzer/anhyzer`
        : "angle unchanged";
      speedCalibrationStatus.textContent =
        `DISC DETECTED → ${controls.speed.value} mph · ${aimText} · ${hyzerText} · THROWING`;
    }

    throwDisc();
      nextThrowLocked = false;
      liveThrowArmed = false;
      if (armLiveThrowButton) armLiveThrowButton.textContent = "ARM LIVE THROW";
      if (liveThrowArmStatus) liveThrowArmStatus.textContent = "NOT ARMED";
      showThrowLockConfirm("✓ THROW SENT TO COURSE");
      liveThrowArmed = false;
      if (armLiveThrowButton) {
        armLiveThrowButton.textContent = "ARM LIVE THROW";
        armLiveThrowButton.disabled = !Number.isFinite(measuredThrowSpeedMph);
      }
      if (liveThrowArmStatus) liveThrowArmStatus.textContent = "NOT ARMED";
  }, 180);
}

function scheduleAutomaticCameraThrow() {
  if (!Number.isFinite(measuredThrowSpeedMph)) return;
  if (measuredThrowSpeedMph < AUTO_THROW_MIN_MPH) return;
  if (performance.now() - lastAutomaticThrowAt < AUTO_THROW_COOLDOWN_MS) return;
  clearTimeout(autoThrowTimer);
  autoThrowTimer = setTimeout(() => {
    if (!Number.isFinite(measuredThrowSpeedMph)) return;
    controls.speed.value = String(Math.round(Math.max(Number(controls.speed.min), Math.min(Number(controls.speed.max), measuredThrowSpeedMph))));
    const camera2IsFresh = performance.now() - camera2MeasurementAt < 1200;
    if (camera2IsFresh && Number.isFinite(camera2AimDegrees)) {
      controls.aim.value = String(Math.round(Math.max(Number(controls.aim.min), Math.min(Number(controls.aim.max), camera2AimDegrees))));
    }
    if (camera2IsFresh && Number.isFinite(camera2HyzerDegrees)) {
      controls.hyzer.value = String(Math.round(Math.max(Number(controls.hyzer.min), Math.min(Number(controls.hyzer.max), camera2HyzerDegrees))));
    }
    updateLabels();
    lastAutomaticThrowAt = performance.now();
    recentThrowSpeeds = [];
    camera1TrackHistory = [];
    lastCamera1Detection = null;
    speedCalibrationStatus.textContent = `AUTO THROW: ${controls.speed.value} mph · launching simulator now`;
    throwDisc();
  }, AUTO_THROW_SETTLE_MS);
}


const calibrationDistanceInput = document.querySelector("#calibration-distance");
const startSpeedCalibrationButton = document.querySelector("#start-speed-calibration");
const useMeasuredSpeedButton = document.querySelector("#use-measured-speed");
const armLiveThrowButton = document.querySelector("#arm-live-throw");
const liveThrowArmStatus = document.querySelector("#live-throw-arm-status");
const throwLockConfirm = document.querySelector("#throw-lock-confirm");
const throwLockConfirmText = document.querySelector("#throw-lock-confirm-text");
let throwLockConfirmTimer = null;
function showThrowLockConfirm(text) {
  if (!throwLockConfirm) return;
  throwLockConfirmText.textContent = text;
  clearTimeout(throwLockConfirmTimer);
  throwLockConfirm.classList.add("show");
  throwLockConfirmTimer = setTimeout(() => throwLockConfirm.classList.remove("show"), 1300);
}
function lockNextThrow() {
  nextThrowLocked = true;
  liveThrowArmed = true;
  if (armLiveThrowButton) armLiveThrowButton.textContent = "NEXT THROW LOCKED";
  if (liveThrowArmStatus) liveThrowArmStatus.textContent = "LOCKED IN";
  showThrowLockConfirm("🔒 THROW LOCKED IN · THROW NOW");
}

const liveThrowToast = document.querySelector("#live-throw-toast");
const speedCalibrationStatus = document.querySelector("#speed-calibration-status");
const measuredSpeedOutput = document.querySelector("#measured-speed");
const camera2AimOutput = document.querySelector("#camera2-aim-output");
const camera2HyzerOutput = document.querySelector("#camera2-hyzer-output");
const camera2RoundnessOutput = document.querySelector("#camera2-roundness-output");
const camera2MeasurementStatus = document.querySelector("#camera2-measurement-status");

function recordCamera2Throw(sourceX, sourceY, timestamp, region) {
  camera2LastSeenAt = timestamp;
  const current = { x: sourceX, y: sourceY, t: timestamp };
  if (lastCamera2Detection) {
    const dt = (timestamp - lastCamera2Detection.t) / 1000;
    const dx = sourceX - lastCamera2Detection.x;
    const dy = sourceY - lastCamera2Detection.y;
    const movement = Math.hypot(dx, dy);

    // Camera 2 should look down/front at the throwing lane.
    // Motion across its image gives left/right launch direction.
    if (dt > 0.008 && dt < 0.20 && movement > 3) {
      const forward = Math.max(1, Math.abs(dy));
      const rawAim = Math.atan2(dx, forward) * 180 / Math.PI;
      const aim = Math.max(-25, Math.min(25, rawAim));
      camera2AimDegrees = aim;

      // Camera 2 estimates hyzer/anhyzer from how round the disc looks.
      // Face-on disc = close to a circle. More tilt = a thinner ellipse.
      // minor/major axis ratio is our "roundness" value (1.0 = round).
      if (Number.isFinite(region.elongation) && region.elongation >= 1) {
        const roundness = Math.max(0, Math.min(1, 1 / region.elongation));
        camera2Roundness = roundness;

        // Approximate physical tilt: projected circle -> ellipse, ratio ~= cos(tilt).
        const tiltMagnitude = Math.acos(Math.max(0.05, roundness)) * 180 / Math.PI;

        // Roundness gives magnitude; the ellipse orientation supplies the side/sign.
        let orientation = Number.isFinite(region.orientationDeg) ? region.orientationDeg : 0;
        while (orientation > 90) orientation -= 180;
        while (orientation < -90) orientation += 180;

        // Near-round discs do not have a trustworthy orientation, so call them flat.
        // Camera 2 is on the ground looking upward. That perspective makes even
        // a flat disc look somewhat tilted/elliptical, so subtract a small
        // perspective baseline before treating the shape as real hyzer/anhyzer.
        const groundCameraBaseline = 7;
        const correctedTiltMagnitude = Math.max(0, tiltMagnitude - groundCameraBaseline);

        if (roundness > 0.90 || correctedTiltMagnitude < 5) {
          // Stronger flat-zone for the low/upward camera view.
          smoothedCamera2HyzerDegrees *= 0.48;
          if (Math.abs(smoothedCamera2HyzerDegrees) < 3) {
            smoothedCamera2HyzerDegrees = 0;
          }
        } else {
          const sign = orientation >= 0 ? 1 : -1;

          // Once the tilt clears the ground-camera flat zone, make intentional
          // hyzer/anhyzer clear without exaggerating extreme readings.
          const detectedHyzer = Math.max(
            -40,
            Math.min(40, sign * correctedTiltMagnitude * 1.18)
          );

          // Favor the recent frames as the disc approaches Camera 2, while still
          // smoothing enough to reject a single blurry frame.
          smoothedCamera2HyzerDegrees =
            smoothedCamera2HyzerDegrees * 0.52 + detectedHyzer * 0.48;
        }

        camera2HyzerDegrees = Math.max(
          -40,
          Math.min(40, smoothedCamera2HyzerDegrees)
        );
      }

      camera2MeasurementAt = timestamp;
      if (camera2AimOutput) camera2AimOutput.textContent = `${aim.toFixed(1)}°`;
      if (camera2HyzerOutput) camera2HyzerOutput.textContent =
        Number.isFinite(camera2HyzerDegrees)
          ? `${camera2HyzerDegrees > 2 ? "Hyzer " : camera2HyzerDegrees < -2 ? "Anhyzer " : "Flat "}${Math.abs(camera2HyzerDegrees).toFixed(1)}°`
          : "unknown";
      if (camera2RoundnessOutput) camera2RoundnessOutput.textContent =
        Number.isFinite(camera2Roundness) ? `${Math.round(camera2Roundness * 100)}% round` : "—";
      if (camera2MeasurementStatus) camera2MeasurementStatus.textContent =
        "Camera 2 captured the release line. It will be used on the automatic throw.";
    }
  }
  lastCamera2Detection = current;
}

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
  camera1TrackHistory = [];
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



function camera1DirectionGateAllowsThrow(region, sourceX, sourceY, timestamp) {
  if (!region) return false;

  camera1DirectionSamples.push({ x: sourceX, y: sourceY, t: timestamp });
  camera1DirectionSamples = camera1DirectionSamples
    .filter((point) => timestamp - point.t <= 220)
    .slice(-5);

  if (camera1DirectionSamples.length < 2) return false;

  const first = camera1DirectionSamples[0];
  const last = camera1DirectionSamples[camera1DirectionSamples.length - 1];
  const dx = last.x - first.x;

  // Only accept motion that starts on the selected throwing side and travels
  // away from that side. No size/shape/minimum-speed test is used here.
  const startFraction = first.x / Math.max(1, cameraSlots[0].video.videoWidth || PROCESS_WIDTH);
  const startsOnThrowSide = camera1ThrowSide === "left"
    ? startFraction <= 0.55
    : startFraction >= 0.45;
  const movingAway = camera1ThrowSide === "left" ? dx > 8 : dx < -8;

  if (!startsOnThrowSide || !movingAway) return false;

  camera1DirectionSamples = [];
  return true;
}

function updateThrowSideSetupText() {
  const existing = document.querySelector("#throw-side-status");
  if (existing) {
    existing.textContent =
      `Throwing side: ${camera1ThrowSide === "left" ? "LEFT" : "RIGHT"} side of Camera 1`;
  }
}

function resetThrowValidation() {
  throwValidationState = "waiting";
  throwValidationSamples = [];
  throwLastDiscSeenAt = -Infinity;
}

function camera1ThrowLooksDiscLike(region) {
  if (!region) return false;
  const width = Math.max(1, region.maxX - region.minX + 1);
  const height = Math.max(1, region.maxY - region.minY + 1);
  const areaFraction = region.area / (PROCESS_WIDTH * PROCESS_HEIGHT);
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  return region.area >= 8 &&
    areaFraction <= 0.055 &&
    width <= PROCESS_WIDTH * 0.34 &&
    height <= PROCESS_HEIGHT * 0.34 &&
    aspect <= 8.5;
}

function validateCamera1Throw(region, sourceX, sourceY, timestamp) {
  throwLastDiscSeenAt = timestamp;
  if (throwValidationState === "locked") return false;

  if (!camera1ThrowLooksDiscLike(region)) {
    throwValidationSamples = [];
    return false;
  }

  throwValidationSamples.push({ x: sourceX, y: sourceY, t: timestamp });
  throwValidationSamples = throwValidationSamples
    .filter((point) => timestamp - point.t <= 260)
    .slice(-6);

  if (throwValidationSamples.length < THROW_CONFIRM_FRAMES) return false;

  const first = throwValidationSamples[0];
  const last = throwValidationSamples[throwValidationSamples.length - 1];
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0.018) return false;

  const travel = Math.hypot(last.x - first.x, last.y - first.y);
  if (travel < 12) return false;

  // Require several consecutive movements in the same general direction.
  const steps = [];
  for (let i = 1; i < throwValidationSamples.length; i += 1) {
    const a = throwValidationSamples[i - 1];
    const b = throwValidationSamples[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) >= 2) steps.push({ dx, dy });
  }
  if (steps.length < THROW_CONFIRM_FRAMES - 1) return false;

  const totalDx = last.x - first.x;
  const totalDy = last.y - first.y;
  const totalLength = Math.max(1, Math.hypot(totalDx, totalDy));
  const ux = totalDx / totalLength;
  const uy = totalDy / totalLength;
  const forwardSteps = steps.filter((step) => step.dx * ux + step.dy * uy > 0).length;
  if (forwardSteps < THROW_CONFIRM_FRAMES - 1) return false;

  if (Number.isFinite(measuredThrowSpeedMph) &&
      measuredThrowSpeedMph < THROW_MIN_VALID_MPH) return false;

  throwValidationState = "locked";
  throwLockStartedAt = timestamp;
  return true;
}

function maybeRearmValidatedThrow(timestamp) {
  if (
    throwValidationState === "locked" &&
    timestamp - throwLockStartedAt >= THROW_LOCK_MS &&
    timestamp - throwLastDiscSeenAt >= THROW_REARM_ABSENCE_MS
  ) {
    camera1DirectionSamples = [];
    detectionThrowArmed = true;
    discDetectionStartedAt = -Infinity;
  }
}

function recordCamera1Speed(sourceX, sourceY, timestamp) {
  if (!pixelsPerInch || speedCalibrationActive || colorPicking) return;

  const current = { x: sourceX, y: sourceY, t: timestamp };
  camera1TrackHistory.push(current);

  // Keep enough history to bridge one or two missed webcam frames.
  camera1TrackHistory = camera1TrackHistory.filter(
    (point) => timestamp - point.t <= 180,
  );

  const candidateSpeeds = [];

  // Measure the newest point against several older points instead of only the
  // immediately previous frame. Fast discs can move so far that a frame is
  // blurred or missed; a multi-frame baseline is much more stable.
  for (let index = 0; index < camera1TrackHistory.length - 1; index += 1) {
    const previous = camera1TrackHistory[index];
    const dt = (timestamp - previous.t) / 1000;
    if (dt < 0.018 || dt > 0.145) continue;

    const pixels = Math.hypot(
      sourceX - previous.x,
      sourceY - previous.y,
    );
    if (pixels < 3) continue;

    const mph = ((pixels / pixelsPerInch) / dt) / 17.6;
    if (mph >= 1 && mph <= 95) candidateSpeeds.push(mph);
  }

  if (candidateSpeeds.length) {
    candidateSpeeds.sort((a, b) => a - b);

    // Use the upper-middle reading. Motion blur tends to pull detected centers
    // toward each other and under-read full-power throws, while this still
    // avoids using a single extreme outlier.
    const candidateIndex = Math.min(
      candidateSpeeds.length - 1,
      Math.floor(candidateSpeeds.length * 0.65),
    );
    const frameEstimate = candidateSpeeds[candidateIndex];

    recentThrowSpeeds.push(frameEstimate);
    recentThrowSpeeds = recentThrowSpeeds.slice(-8);

    const sorted = [...recentThrowSpeeds].sort((a, b) => a - b);
    const estimateIndex = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.65),
    );
    const estimate = sorted[estimateIndex];

    measuredThrowSpeedMph = estimate;
    measuredSpeedOutput.textContent = `${estimate.toFixed(1)} mph`;
    useMeasuredSpeedButton.disabled = false;

    // A valid speed from Camera 1 confirms the locked disc throw.
    if (nextThrowLocked) {
      triggerThrowFromDiscDetection(timestamp);
    }
    if (armLiveThrowButton) armLiveThrowButton.disabled = false;
    speedCalibrationStatus.textContent =
      `Speed detected: ${estimate.toFixed(1)} mph. Throw captured — launching…`;
  }

  lastCamera1Detection = current;
}

startSpeedCalibrationButton.addEventListener("click", beginSpeedCalibration);
cameraSlots[0].video.addEventListener("click", handleSpeedCalibrationClick);

let liveThrowToastTimer = null;

function showLiveThrowToast(message = "🔒 LIVE THROW LOCKED IN") {
  if (!liveThrowToast) return;
  liveThrowToast.textContent = message;
  liveThrowToast.classList.add("show");
  clearTimeout(liveThrowToastTimer);
  liveThrowToastTimer = setTimeout(() => {
    liveThrowToast.classList.remove("show");
  }, 1400);
}

function armLiveThrow() {
  if (!Number.isFinite(measuredThrowSpeedMph)) {
    showLiveThrowToast("⚠ THROW A TEST SHOT FIRST");
    return;
  }

  controls.speed.value = String(Math.round(measuredThrowSpeedMph));
  liveThrowArmed = true;
  if (armLiveThrowButton) armLiveThrowButton.textContent = "NEXT THROW ARMED";
  if (liveThrowArmStatus) {
    liveThrowArmStatus.textContent = `${measuredThrowSpeedMph.toFixed(1)} MPH ARMED`;
  }
  speedCalibrationStatus.textContent =
    `Live Throw armed at ${measuredThrowSpeedMph.toFixed(1)} mph. Your next detected throw will count.`;
  showLiveThrowToast(`🔒 LOCKED IN · ${measuredThrowSpeedMph.toFixed(1)} MPH`);
}

armLiveThrowButton?.addEventListener("click", lockNextThrow);

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

function colorToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max ? d / max : 0, v: max };
}

function hueDifference(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

function predictedCamera1Center() {
  if (!camera1TrackHistory.length) return null;
  const last = camera1TrackHistory[camera1TrackHistory.length - 1];
  const age = Math.max(0, Math.min(0.16, (performance.now() - last.t) / 1000));
  return {
    x: last.x + camera1Velocity.x * age,
    y: last.y + camera1Velocity.y * age,
  };
}

function findLargestColorRegion(slot, imageData) {
  const pixels = imageData.data;
  const mask = slot.colorMask;
  const queue = slot.componentQueue;
  const target = selectedDiscColor;
  const tolerance = Number(sensitivityInput.value);
  const targetHsv = colorToHsv(target.r, target.g, target.b);
  const activelyTrackingFastDisc =
    slot === cameraSlots[0] && camera1TrackHistory.length >= 2;
  const hueTolerance = Math.max(
    10,
    Math.min(activelyTrackingFastDisc ? 48 : 38, tolerance * (activelyTrackingFastDisc ? 0.38 : 0.30)),
  );
  const saturationTolerance = Math.max(
    0.20,
    Math.min(activelyTrackingFastDisc ? 0.62 : 0.50, tolerance / (activelyTrackingFastDisc ? 175 : 210)),
  );
  const valueTolerance = Math.max(
    0.24,
    Math.min(activelyTrackingFastDisc ? 0.72 : 0.62, tolerance / (activelyTrackingFastDisc ? 150 : 175)),
  );

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * 4;
    const hsv = colorToHsv(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    const hueMatch = targetHsv.s < 0.10
      ? Math.abs(hsv.v - targetHsv.v) <= valueTolerance * 0.7
      : hueDifference(hsv.h, targetHsv.h) <= hueTolerance;
    mask[pixel] = pixels[offset + 3] > 96 &&
      hueMatch &&
      Math.abs(hsv.s - targetHsv.s) <= saturationTolerance &&
      Math.abs(hsv.v - targetHsv.v) <= valueTolerance
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
    let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
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
      sumX += x; sumY += y; sumXX += x * x; sumYY += y * y; sumXY += x * y;

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

    {
      const n = Math.max(1, tail);
      const meanX = sumX / n, meanY = sumY / n;
      const varX = Math.max(0, sumXX / n - meanX * meanX);
      const varY = Math.max(0, sumYY / n - meanY * meanY);
      const covXY = sumXY / n - meanX * meanY;
      const orientationDeg = 0.5 * Math.atan2(2 * covXY, varX - varY) * 180 / Math.PI;
      const trace = varX + varY;
      const root = Math.sqrt(Math.max(0, (varX - varY) ** 2 + 4 * covXY ** 2));
      const major = Math.sqrt(Math.max(0.001, (trace + root) / 2));
      const minor = Math.sqrt(Math.max(0.001, (trace - root) / 2));
      const candidate = {
        area: tail, minX, minY, maxX, maxY,
        centerX: meanX, centerY: meanY,
        orientationDeg, elongation: major / minor,
      };

      const prediction = slot === cameraSlots[0] ? predictedCamera1Center() : null;
      const distance = prediction
        ? Math.hypot(meanX - prediction.x, meanY - prediction.y)
        : 0;

      // Camera 1: once a throw is moving, position is more trustworthy than
      // raw blob size. This prevents similarly colored background objects from
      // stealing the track and gives a blurred disc room to be reacquired.
      if (prediction) {
        const insideSearch = distance <= CAMERA1_PREDICTION_SEARCH_RADIUS;
        const positionWeight = insideSearch
          ? Math.max(0.35, 1.8 - distance / 75)
          : Math.max(0.03, 0.22 - (distance - CAMERA1_PREDICTION_SEARCH_RADIUS) / 500);
        candidate.trackScore = tail * positionWeight;
      } else {
        candidate.trackScore = tail;
      }

      if (!largest || candidate.trackScore > (largest.trackScore ?? largest.area)) {
        largest = candidate;
      }
    }
  }

  if (!largest) return null;
  const boxWidth = largest.maxX - largest.minX + 1;
  const boxHeight = largest.maxY - largest.minY + 1;
  const boxArea = boxWidth * boxHeight;
  const fillRatio = largest.area / boxArea;
  if (
    largest.area < Math.max(8, MIN_DETECTION_PIXELS - 4) ||
    largest.area > mask.length * MAX_DETECTION_FRACTION ||
    fillRatio < 0.065
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
      if (slot === cameraSlots[0]) {
        const now = performance.now();

        // Preserve the short track through a missed/blurred frame. Only clear
        // it after the disc has genuinely been gone for a while.
        if (camera1TrackHistory.length) {
          camera1PredictedMisses += 1;

          // Keep the trajectory alive through up to three missed/blurred frames.
          // Only give up after repeated misses or a clearly stale track.
          if (
            camera1PredictedMisses > CAMERA1_MAX_PREDICTED_MISSES ||
            now - camera1TrackHistory[camera1TrackHistory.length - 1].t > 260
          ) {
            lastCamera1Detection = null;
            camera1TrackHistory = [];
            camera1Velocity = { x: 0, y: 0 };
            camera1LastRegionCenter = null;
            camera1PredictedMisses = 0;
            recentThrowSpeeds = [];
          }
        }

        if (now - discDetectionStartedAt > DETECTION_REARM_MS) {
          detectionThrowArmed = true;
          discDetectionStartedAt = -Infinity;
        }
      }
      if (slot === cameraSlots[1] && performance.now() - camera2LastSeenAt > 220) lastCamera2Detection = null;
      setDetectionReadout(slot, "NO DISC", "no-disc");
      clearDetectionOverlay(slot);
      return;
    }

    const normalizedX = (region.minX + region.maxX + 1) / (2 * PROCESS_WIDTH);
    const normalizedY = (region.minY + region.maxY + 1) / (2 * PROCESS_HEIGHT);
    const sourceX = Math.round(crop.x + normalizedX * crop.width);
    const sourceY = Math.round(crop.y + normalizedY * crop.height);
    const detectionTime = performance.now();
    if (slot === cameraSlots[0]) {
      recordCamera1Speed(sourceX, sourceY, detectionTime);

      // Estimate velocity over a short multi-frame baseline. This is much less
      // sensitive to one noisy centroid caused by motion blur.
      if (camera1TrackHistory.length >= 2) {
        const recent = camera1TrackHistory.slice(-5);
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = (last.t - first.t) / 1000;
        if (dt > 0.012 && dt < 0.18) {
          const vx = (last.x - first.x) / dt;
          const vy = (last.y - first.y) / dt;
          camera1Velocity.x = camera1Velocity.x * 0.25 + vx * 0.75;
          camera1Velocity.y = camera1Velocity.y * 0.25 + vy * 0.75;
        }
      }

      camera1LastRegionCenter = { x: region.centerX, y: region.centerY };
      camera1PredictedMisses = 0;
      camera1LastGoodDetectionAt = detectionTime;
      if (camera1DirectionGateAllowsThrow(region, sourceX, sourceY, detectionTime)) {
        triggerThrowFromDiscDetection(detectionTime);
      }
    }
    if (slot === cameraSlots[1]) {
      recordCamera2Throw(sourceX, sourceY, detectionTime, region);
      // Camera 1 remains the main trigger, but Camera 2 can begin the shared capture window.
      if (!Number.isFinite(discDetectionStartedAt) || discDetectionStartedAt < 0) {
        discDetectionStartedAt = detectionTime;
      }
    }
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
  const radius = 3;
  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);
  const sampleWidth = Math.min(PROCESS_WIDTH - left, radius * 2 + 1);
  const sampleHeight = Math.min(PROCESS_HEIGHT - top, radius * 2 + 1);
  const sample = slot.processingContext.getImageData(left, top, sampleWidth, sampleHeight).data;
  const reds = [];
  const greens = [];
  const blues = [];
  for (let offset = 0; offset < sample.length; offset += 4) {
    if (sample[offset + 3] < 96) continue;
    reds.push(sample[offset]);
    greens.push(sample[offset + 1]);
    blues.push(sample[offset + 2]);
  }
  if (!reds.length) {
    detectionSetupHint.textContent = "That point was not visible. Click near the middle of the disc again.";
    return;
  }
  const median = (values) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  selectedDiscColor = {
    r: median(reds),
    g: median(greens),
    b: median(blues),
  };
  camera1TrackHistory = [];
  camera1Velocity = { x: 0, y: 0 };
  camera1LastRegionCenter = null;
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
  const video = { frameRate: { ideal: 60, min: 30 } };
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
  resetThrowValidation();
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

const throwSideLeftButton = document.querySelector("#throw-side-left");
const throwSideRightButton = document.querySelector("#throw-side-right");

throwSideLeftButton?.addEventListener("click", () => {
  camera1ThrowSide = "left";
  camera1DirectionSamples = [];
  updateThrowSideSetupText();
});

throwSideRightButton?.addEventListener("click", () => {
  camera1ThrowSide = "right";
  camera1DirectionSamples = [];
  updateThrowSideSetupText();
});

updateThrowSideSetupText();


document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.repeat) return;
  const tag = event.target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  event.preventDefault();
  lockNextThrow();
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


/* ===== SELF-CONTAINED COURSE + MONITOR HOTKEYS ===== */
(() => {
  const canvas=document.querySelector("#course-3d-canvas");
  const bigScreenButton=document.querySelector("#big-screen-button");
  if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const miniCanvas=document.querySelector("#wii-mini-map-canvas");
  const miniCtx=miniCanvas?.getContext("2d");
  let dpr=1, anim=null, visualDisc=null, lastLie={lateral:0,downrange:0}, displayLie={lateral:0,downrange:0};

  function holeSafe(){ try{return typeof currentHole==="function"?currentHole():null}catch(_){return null} }
  function lieSafe(){ try{return currentLie?{lateral:currentLie.lateral||0,downrange:currentLie.downrange||0}:{lateral:0,downrange:0}}catch(_){return {lateral:0,downrange:0}} }
  function resize(){
    const r=canvas.getBoundingClientRect(); dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr)); canvas.height=Math.max(1,Math.round(r.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0); draw();
  }
  function project(lateral, forward, height=0){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const depth=Math.max(0,forward);
    const t=Math.min(1.35,depth/300);
    const horizon=h*.31, bottom=h*.92;
    const y=bottom-(bottom-horizon)*(1-Math.exp(-depth/105))-height*(1.4-t*.7);
    const spread=(w*.42)*(1-t*.76);
    const x=w/2+(lateral/55)*spread;
    return {x,y,scale:Math.max(.18,1-t*.78)};
  }

  const COURSE_LAYOUTS = [
    {name:"Opening Lane", bend:0, width:42, trees:"both", feature:"open"},
    {name:"Pine Gap", bend:-18, width:30, trees:"both", feature:"gap"},
    {name:"Long Meadow", bend:10, width:52, trees:"sparse", feature:"meadow"},
    {name:"Left Bend", bend:-34, width:34, trees:"right", feature:"dogleg-left"},
    {name:"Creek Run", bend:20, width:32, trees:"both", feature:"creek"},
    {name:"Big Drive", bend:0, width:58, trees:"sparse", feature:"long"},
    {name:"Right Window", bend:32, width:30, trees:"left", feature:"dogleg-right"},
    {name:"Uphill Finish", bend:-12, width:38, trees:"both", feature:"uphill"},
    {name:"Home Stretch", bend:16, width:40, trees:"both", feature:"finish"}
  ];
  function layoutSafe(){
    const i=typeof currentHoleIndex==="number"?currentHoleIndex:0;
    return COURSE_LAYOUTS[Math.max(0,Math.min(COURSE_LAYOUTS.length-1,i))];
  }
  function centerAt(z,total){
    const L=layoutSafe(), p=Math.max(0,Math.min(1,z/Math.max(1,total)));
    // Terrain can bend, but the basket is always centered in the player's view.
    return L.bend * Math.sin(Math.PI*p) * 0.72;
  }
  function tree(x,z){
    const p=project(x,z),s=p.scale;
    ctx.fillStyle="#684629";ctx.fillRect(p.x-3*s,p.y-32*s,6*s,32*s);
    ctx.fillStyle="#28623a";
    ctx.beginPath();ctx.moveTo(p.x,p.y-70*s);ctx.lineTo(p.x-22*s,p.y-22*s);ctx.lineTo(p.x+22*s,p.y-22*s);ctx.closePath();ctx.fill();
  }
  function basket(z,lateral=0){
    const p=project(lateral,z),s=Math.max(.35,p.scale);
    ctx.strokeStyle="#e5e7eb";ctx.lineWidth=Math.max(2,3*s);
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-55*s);ctx.stroke();
    ctx.fillStyle="#ffd43b";ctx.fillRect(p.x-18*s,p.y-52*s,36*s,7*s);
    ctx.strokeStyle="#d1d5db";ctx.lineWidth=Math.max(1,1.5*s);
    for(let i=-12;i<=12;i+=6){ctx.beginPath();ctx.moveTo(p.x+i*s,p.y-45*s);ctx.lineTo(p.x+i*.55*s,p.y-20*s);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(p.x-21*s,p.y-18*s);ctx.lineTo(p.x+21*s,p.y-18*s);ctx.lineTo(p.x+14*s,p.y-10*s);ctx.lineTo(p.x-14*s,p.y-10*s);ctx.closePath();ctx.stroke();
    ctx.strokeStyle="#f4c430";ctx.beginPath();ctx.moveTo(p.x,p.y-55*s);ctx.lineTo(p.x,p.y-88*s);ctx.stroke();
    ctx.fillStyle="#ffd43b";ctx.beginPath();ctx.moveTo(p.x,p.y-87*s);ctx.lineTo(p.x+24*s,p.y-80*s);ctx.lineTo(p.x,p.y-73*s);ctx.closePath();ctx.fill();
  }
  function draw(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const hole=holeSafe()||{distance:300,par:3,name:"Hole"};
    const lie=displayLie, rawRemaining=(hole.distance||300)-lie.downrange;
    const overthrown=rawRemaining<0, remaining=Math.max(1,Math.abs(rawRemaining));
    const sky=ctx.createLinearGradient(0,0,0,h*.55);sky.addColorStop(0,"#79bde8");sky.addColorStop(1,"#d9effb");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    // Soft clouds and rolling hills for a Wii Sports Golf-like bright course feel.
    ctx.fillStyle="rgba(255,255,255,.78)";
    for(const c of [[.18,.14,34],[.25,.12,25],[.72,.17,30],[.79,.15,22]]){ctx.beginPath();ctx.arc(w*c[0],h*c[1],c[2],0,Math.PI*2);ctx.fill()}
    ctx.fillStyle="#5f9253";ctx.beginPath();ctx.moveTo(0,h*.34);ctx.quadraticCurveTo(w*.18,h*.22,w*.36,h*.34);ctx.quadraticCurveTo(w*.56,h*.20,w*.72,h*.34);ctx.quadraticCurveTo(w*.88,h*.25,w,h*.34);ctx.lineTo(w,h*.48);ctx.lineTo(0,h*.48);ctx.closePath();ctx.fill();
    ctx.fillStyle="#467b42";ctx.fillRect(0,h*.30,w,h*.70);
    
    // Hole-specific terrain/background. These intentionally look different hole-to-hole.
    const terrain=layoutSafe().feature;
    if(terrain==="gap"){
      ctx.fillStyle="#315f36";
      ctx.fillRect(0,h*.30,w*.17,h*.70); ctx.fillRect(w*.83,h*.30,w*.17,h*.70);
    }else if(terrain==="meadow"){
      ctx.fillStyle="rgba(245,214,83,.42)";
      for(let x=18;x<w;x+=38){ctx.beginPath();ctx.arc(x,h*.72+(x%4)*18,4,0,Math.PI*2);ctx.fill()}
    }else if(terrain==="dogleg-left"){
      ctx.fillStyle="#355f32";ctx.beginPath();ctx.ellipse(w*.78,h*.58,w*.22,h*.22,0,0,Math.PI*2);ctx.fill();
    }else if(terrain==="creek"){
      ctx.fillStyle="rgba(66,151,205,.65)";ctx.fillRect(0,h*.59,w,h*.055);
    }else if(terrain==="long"){
      ctx.fillStyle="rgba(224,196,113,.28)";ctx.fillRect(0,h*.70,w,h*.30);
    }else if(terrain==="dogleg-right"){
      ctx.fillStyle="#355f32";ctx.beginPath();ctx.ellipse(w*.22,h*.58,w*.22,h*.22,0,0,Math.PI*2);ctx.fill();
    }else if(terrain==="uphill"){
      ctx.fillStyle="#568a48";ctx.beginPath();ctx.moveTo(0,h*.70);ctx.quadraticCurveTo(w*.5,h*.43,w,h*.70);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    }else if(terrain==="finish"){
      ctx.fillStyle="rgba(45,104,57,.5)";
      ctx.beginPath();ctx.ellipse(w*.12,h*.52,w*.16,h*.22,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(w*.88,h*.55,w*.14,h*.20,0,0,Math.PI*2);ctx.fill();
    }

// Curved fairway: each of the 9 holes has its own width/bend/layout.
    const layout=layoutSafe(), total=Math.max(remaining,40);
    ctx.fillStyle="#73ad58";
    const leftPts=[],rightPts=[];
    for(let z=0;z<=Math.min(total,420);z+=10){
      const c=centerAt(z,total), half=layout.width/2;
      leftPts.push(project(c-half,z)); rightPts.push(project(c+half,z));
    }
    ctx.beginPath();
    rightPts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    leftPts.reverse().forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();

    // Unique hole feature accents.
    if(layout.feature==="creek"){
      const z=total*.58,c=centerAt(z,total),p=project(c,z);
      ctx.strokeStyle="#4fa9d8";ctx.lineWidth=Math.max(5,18*p.scale);
      ctx.beginPath();ctx.moveTo(p.x-80*p.scale,p.y);ctx.quadraticCurveTo(p.x,p.y+10*p.scale,p.x+80*p.scale,p.y-3*p.scale);ctx.stroke();
    }
    if(layout.feature==="uphill"){
      const p=project(centerAt(total*.72,total),total*.72);
      ctx.fillStyle="rgba(80,120,64,.42)";ctx.beginPath();ctx.ellipse(p.x,p.y+12,90*p.scale,28*p.scale,0,0,Math.PI*2);ctx.fill();
    }

    ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.38,h*.91);ctx.lineTo(w*.62,h*.91);ctx.stroke();

    for(let z=18;z<Math.min(Math.max(total,40),420);z+=20){
      const c=centerAt(z,total), half=layout.width/2;
      if(layout.trees!=="right" && (layout.trees!=="sparse" || z%40===18)) tree(c-half-10-(z%9),z);
      if(layout.trees!=="left" && (layout.trees!=="sparse" || z%40===18)) tree(c+half+10+(z%7),z);
    }
    // Pine Gap gets a tighter visual window near the middle.
    if(layout.feature==="gap"){
      const z=total*.48,c=centerAt(z,total);tree(c-14,z);tree(c+14,z);
    }
    basket(remaining,0);
    const d=visualDisc || {lateral:0,forward:0,height:1.2};
    const dp=project(d.lateral,d.forward,d.height);
    ctx.save();ctx.translate(dp.x,dp.y);ctx.rotate(d.roll||0);
    ctx.fillStyle="#ff5a2f";ctx.beginPath();ctx.ellipse(0,0,Math.max(7,13*dp.scale),Math.max(3,5*dp.scale),0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    const hi=document.querySelector("#wii-hole-label"),di=document.querySelector("#wii-distance-label");
    if(hi)hi.textContent=`HOLE ${(typeof currentHoleIndex==="number"?currentHoleIndex:0)+1} · ${hole.name||""}`;
    if(di)di.textContent=overthrown
      ? `${Math.round(remaining)} FT PAST PIN · FACING BACK TO BASKET · PAR ${hole.par||3}`
      : `${Math.round(remaining)} FT LEFT · PAR ${hole.par||3}`;
    drawMiniMap();
    updateDiscHud();
  }
  function fly(before,after){
    if(anim)cancelAnimationFrame(anim);

    // Work out the actual throw distance from old lie to new lie.
    const globalDX=(after.lateral||0)-(before.lateral||0);
    const globalDZ=(after.downrange||0)-(before.downrange||0);
    const throwLen=Math.max(1,Math.hypot(globalDX,globalDZ));

    // The camera is always facing the basket, so screen-forward is toward the target.
    // Use only the measured aim as a small left/right screen offset.
    let aimDeg=0;
    try{ aimDeg=Number(controls?.aim?.value||0); }catch(_){}
    const aimRad=aimDeg*Math.PI/180;
    const screenForward=Math.max(1,throwLen*Math.cos(aimRad));
    const screenLateral=throwLen*Math.sin(aimRad);

    const start=performance.now();
    const dur=Math.max(900,Math.min(2500,850+throwLen*5.2));
    const type=window.simDiscType||"driver";
    const curve=type==="driver"?2.2:type==="midrange"?1.25:.55;

    function frame(now){
      const t=Math.min(1,(now-start)/dur);
      const e=t*t*(3-2*t);

      // One smooth disc-golf-like arc: slight turn early, gentle fade late.
      const turnFade=Math.sin(Math.PI*t) * curve * (t-.42);
      const peak=Math.min(18,3.5+throwLen*.045);
      const height=.18 + Math.sin(Math.PI*t)*peak;

      visualDisc={
        lateral:screenLateral*e+turnFade,
        forward:screenForward*e,
        height,
        roll:.08*Math.sin(Math.PI*t)
      };
      draw();

      if(t<1){
        anim=requestAnimationFrame(frame);
      }else{
        // Show the disc at the exact visual landing point first.
        visualDisc={lateral:screenLateral,forward:screenForward,height:.12,roll:0};
        draw();

        setTimeout(()=>{
          // Only now move the player/camera to the real physics landing position.
          anim=null;
          visualDisc=null;
          displayLie={...after};
          lastLie={...after};
          draw();
        },220);
      }
    }
    anim=requestAnimationFrame(frame);
  }

  function visibleDiscOptions(){
    return [...document.querySelectorAll(".disc-option,.disc-card,[data-disc]")].filter(e=>e.offsetParent!==null);
  }
  function selectedDiscElement(){
    const opts=visibleDiscOptions();
    return opts.find(e=>e.classList.contains("selected")||e.getAttribute("aria-pressed")==="true"||e.checked) || opts[0] || null;
  }
  function readDiscNumbers(el){
    if(!el)return {name:"NO DISC",speed:"—",glide:"—",turn:"—",fade:"—"};
    const text=(el.innerText||el.textContent||"").replace(/\s+/g," ").trim();
    const ds=el.dataset||{};
    const pick=(key)=>{
      if(ds[key]!==undefined)return ds[key];
      const m=text.match(new RegExp(key+"\\\\s*[:\\\\-]?\\\\s*(-?\\\\d+(?:\\\\.\\\\d+)?)","i"));
      return m?m[1]:"—";
    };
    let name=ds.name||ds.discName||el.querySelector(".disc-name,.name,h3,h4,strong")?.textContent?.trim()||text.split(/Speed|Glide|Turn|Fade/i)[0].trim();
    if(!name)name="SAVED DISC";
    return {name,speed:pick("speed"),glide:pick("glide"),turn:pick("turn"),fade:pick("fade")};
  }
  function updateDiscHud(){}

  function drawMiniMap(){
    if(!miniCanvas||!miniCtx)return;
    const r=miniCanvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
    const W=Math.max(1,Math.round(r.width*ratio)),H=Math.max(1,Math.round(r.height*ratio));
    if(miniCanvas.width!==W||miniCanvas.height!==H){miniCanvas.width=W;miniCanvas.height=H}
    miniCtx.setTransform(ratio,0,0,ratio,0,0);
    const w=r.width,h=r.height,hole=holeSafe()||{distance:300},lie=displayLie;
    miniCtx.clearRect(0,0,w,h);miniCtx.fillStyle="#dfead5";miniCtx.fillRect(0,0,w,h);
    // Top-down map uses the same unique bend as the main course.
    const L=layoutSafe(), hd=hole.distance||300;
    const mapX=(z)=>w*.50+(centerAt(z,hd)/70)*w*.62;
    const mapY=(z)=>h*.92-(z/hd)*h*.82;
    miniCtx.fillStyle="#77ad59";miniCtx.strokeStyle="#77ad59";miniCtx.lineWidth=Math.max(18,L.width*.55);miniCtx.lineCap="round";
    miniCtx.beginPath();
    for(let z=0;z<=hd;z+=10){const x=mapX(z),y=mapY(z);if(z===0)miniCtx.moveTo(x,y);else miniCtx.lineTo(x,y)}
    miniCtx.stroke();
    // Basket follows the dogleg endpoint.
    const bx=mapX(hd),by=mapY(hd);
    miniCtx.fillStyle="#ffd43b";miniCtx.beginPath();miniCtx.arc(bx,by,6,0,Math.PI*2);miniCtx.fill();
    miniCtx.strokeStyle="#4b6170";miniCtx.lineWidth=2;miniCtx.beginPath();miniCtx.moveTo(bx,by);miniCtx.lineTo(bx,by+10);miniCtx.stroke();
    // Player/current lie can pass beyond the basket; don't clamp overthrows to the pin.
    const progress=(lie.downrange||0)/hd;
    const py=Math.max(8,Math.min(h-8,h*.92-progress*h*.82));
    const px=mapX(Math.min(hd,Math.max(0,lie.downrange||0)))+Math.max(-w*.23,Math.min(w*.23,(lie.lateral||0)*1.2));
    miniCtx.fillStyle="#ffffff";miniCtx.strokeStyle="#244c67";miniCtx.lineWidth=2;
    miniCtx.beginPath();miniCtx.arc(px,py,6,0,Math.PI*2);miniCtx.fill();miniCtx.stroke();
    miniCtx.strokeStyle="rgba(36,76,103,.55)";miniCtx.setLineDash([4,4]);miniCtx.beginPath();miniCtx.moveTo(px,py);miniCtx.lineTo(bx,by);miniCtx.stroke();miniCtx.setLineDash([]);
  }
  const SIM_TYPES=["driver","midrange","putter"];
  window.simDiscType=window.simDiscType||"driver";
  function setSimDisc(type){
    if(!SIM_TYPES.includes(type))return;
    window.simDiscType=type;
    document.querySelectorAll(".sim-disc-type").forEach(b=>b.classList.toggle("selected",b.dataset.simDisc===type));
  }
  function clickDisc(delta){
    let i=SIM_TYPES.indexOf(window.simDiscType||"driver");
    setSimDisc(SIM_TYPES[(i+delta+SIM_TYPES.length)%SIM_TYPES.length]);
  }
  function nextHoleKey(){const b=[...document.querySelectorAll("button")].find(x=>/next hole/i.test(x.textContent));if(b&&!b.disabled)b.click();}
  async function big(){
    document.body.classList.toggle("sim-big-screen");const on=document.body.classList.contains("sim-big-screen");
    if(bigScreenButton)bigScreenButton.textContent=on?"✕ EXIT BIG SCREEN":"⛶ BIG SCREEN";
    try{if(on&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen()}catch(_){}
    setTimeout(resize,80);
  }
  document.querySelectorAll(".sim-disc-type").forEach(b=>b.addEventListener("click",()=>setSimDisc(b.dataset.simDisc)));
  setSimDisc(window.simDiscType);
  bigScreenButton?.addEventListener("click",big);
  document.addEventListener("keydown",e=>{
    const tag=e.target?.tagName?.toLowerCase();if(["input","textarea","select"].includes(tag))return;
    if(e.code==="Digit1"){e.preventDefault();setSimDisc("driver")}
    if(e.code==="Digit2"){e.preventDefault();setSimDisc("midrange")}
    if(e.code==="Digit3"){e.preventDefault();setSimDisc("putter")}
    if(e.code==="ArrowRight"){e.preventDefault();clickDisc(1)}
    if(e.code==="ArrowLeft"){e.preventDefault();clickDisc(-1)}
    if(e.code==="KeyN"){e.preventDefault();nextHoleKey()}
    if(e.code==="KeyF"){e.preventDefault();big()}
  });
  lastLie=lieSafe(); displayLie={...lastLie};
  setInterval(()=>{
    const l=lieSafe();
    if(!anim&&(Math.abs(l.lateral-lastLie.lateral)>.01||Math.abs(l.downrange-lastLie.downrange)>.01)){
      const b={...displayLie};
      lastLie={...l};

      // Update monitor HUD with the throw that just produced this landing position.
      const lastMain=document.querySelector("#last-throw-main");
      const lastDetail=document.querySelector("#last-throw-detail");
      const throwFeet=Math.round(Math.hypot(
        (l.downrange||0)-(b.downrange||0),
        (l.lateral||0)-(b.lateral||0)
      ));
      if(lastMain) lastMain.textContent=`${throwFeet} ft`;
      if(lastDetail){
        let mph="—", aim="—", angle="—";
        try{
          mph=controls?.speed?.value ?? "—";
          aim=Number(controls?.aim?.value ?? 0).toFixed(1)+"°";
          const a=Number(controls?.hyzer?.value ?? 0);
          angle=a===0?"Flat":`${Math.abs(a).toFixed(1)}° ${a<0?"Hyzer":"Anhyzer"}`;
        }catch(_){}
        lastDetail.textContent=`${mph} mph · Aim ${aim} · ${angle}`;
      }
      fly(b,l);
    } else if(!anim) draw();
  },100);
  window.addEventListener("resize",resize);
  resize();
})();
