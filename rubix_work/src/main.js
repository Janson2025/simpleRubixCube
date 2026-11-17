import * as THREE from "three";

import { CONFIG, AXES, AXIS_NAMES, AXIS_LABELS } from "./config.js";
import { createScene } from "./scene/createScene.js";
import { rotateGridPosition, rotateOrientation } from "./cube/cubeMath.js";

// ============================================================
// DOM
// ============================================================

const root = document.getElementById("root");
const sizeLabel = document.getElementById("cube-size-label");

const panel = document.getElementById("controls-panel");
const toggleButton = document.getElementById("controls-toggle");
const controlsContent = document.getElementById("controls-content");
const chevron = document.getElementById("controls-chevron");

const sizeSlider = document.getElementById("size-slider");
const sizeValue = document.getElementById("size-value");

const moveHistoryElement = document.getElementById("move-history");
const moveCountElement = document.getElementById("controls-move-count");
const clearHistoryButton = document.getElementById("clear-history");
const undoButton = document.getElementById("undo-move");
const redoButton = document.getElementById("redo-move");
const scrambleButton = document.getElementById("scramble-cube");
const statusElement = document.getElementById("rotation-status");

if (!root || !sizeLabel) {
  throw new Error("Missing cube canvas or size indicator.");
}

if (
  !panel ||
  !toggleButton ||
  !controlsContent ||
  !sizeSlider ||
  !sizeValue ||
  !moveHistoryElement
) {
  throw new Error("Missing controls panel elements.");
}

CONFIG.size = THREE.MathUtils.clamp(
  Math.round(CONFIG.size),
  CONFIG.minSize,
  CONFIG.maxSize
);

sizeSlider.value = String(CONFIG.size);

// ============================================================
// CONTROLS PANEL
// ============================================================

let panelExpanded = false;

function setPanelExpanded(expanded) {
  panelExpanded = expanded;

  panel.classList.toggle("is-expanded", expanded);

  controlsContent.hidden = !expanded;

  toggleButton.setAttribute(
    "aria-expanded",
    String(expanded)
  );

  if (chevron) {
    chevron.textContent = expanded ? "⌄" : "⌃";
  }
}

toggleButton.addEventListener("click", () => {
  setPanelExpanded(!panelExpanded);
});

setPanelExpanded(false);

// ============================================================
// MOVE HISTORY / UNDO / REDO
// ============================================================

const moveHistory = [];
let historyCursor = 0;
let isPlayingSequence = false;
let animationQueue = [];

function renderMoveHistory() {
  moveHistoryElement.replaceChildren();

  if (moveHistory.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No moves yet";
    moveHistoryElement.appendChild(empty);
  } else {
    moveHistory.forEach((move, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "history-move";
      item.textContent = move.notation;
      item.title = `Play ${move.notation}`;
      item.setAttribute("aria-label", `Play move ${move.notation}`);

      if (index < historyCursor) item.classList.add("is-applied");
      if (index === historyCursor - 1) item.classList.add("is-latest");

      item.disabled = isPlayingSequence || isRotating;

      item.addEventListener("click", () => {
        playMove(move, { record: true });
      });

      moveHistoryElement.appendChild(item);
    });
  }

  moveCountElement.textContent = `${historyCursor} / ${moveHistory.length} MOVES`;

  if (undoButton) {
    undoButton.disabled =
      historyCursor === 0 || isPlayingSequence || isRotating;
  }

  if (redoButton) {
    redoButton.disabled =
      historyCursor >= moveHistory.length || isPlayingSequence || isRotating;
  }

  if (clearHistoryButton) {
    clearHistoryButton.disabled =
      moveHistory.length === 0 || isPlayingSequence || isRotating;
  }

  if (scrambleButton) {
    scrambleButton.disabled = isPlayingSequence || isRotating;
  }
}

function createMove(axis, layer, quarterTurns) {
  const reverse = quarterTurns < 0;

  return {
    axis,
    layer,
    quarterTurns,
    notation: `${AXIS_LABELS[axis]}${layer + 1}${reverse ? "'" : ""}`,
    description: `${axis.toUpperCase()} axis, slice ${layer + 1}, ${reverse ? "reverse" : "forward"}`
  };
}

function recordMove(axis, layer, quarterTurns) {
  if (!quarterTurns) return;

  if (historyCursor < moveHistory.length) {
    moveHistory.splice(historyCursor);
  }

  moveHistory.push(createMove(axis, layer, quarterTurns));
  historyCursor = moveHistory.length;

  while (moveHistory.length > CONFIG.maxHistory) {
    moveHistory.shift();
    historyCursor = Math.max(0, historyCursor - 1);
  }

  renderMoveHistory();
}

function playMove(move, options = {}) {
  return animateSliceRotation(
    move.axis,
    move.layer,
    options.inverse ? -move.quarterTurns : move.quarterTurns,
    {
      record: options.record !== false,
      onComplete: options.onComplete
    }
  );
}

function undoMove() {
  if (isRotating || isPlayingSequence || historyCursor <= 0) return;

  const move = moveHistory[historyCursor - 1];

  playMove(move, {
    inverse: true,
    record: false,
    onComplete: () => {
      historyCursor--;
      renderMoveHistory();
      setStatus(`Undid ${move.notation}`);
    }
  });
}

function redoMove() {
  if (isRotating || isPlayingSequence || historyCursor >= moveHistory.length) return;

  const move = moveHistory[historyCursor];

  playMove(move, {
    record: false,
    onComplete: () => {
      historyCursor++;
      renderMoveHistory();
      setStatus(`Redid ${move.notation}`);
    }
  });
}

undoButton?.addEventListener("click", undoMove);
redoButton?.addEventListener("click", redoMove);

clearHistoryButton?.addEventListener("click", () => {
  if (isRotating || isPlayingSequence) return;

  moveHistory.length = 0;
  historyCursor = 0;

  renderMoveHistory();
  setStatus("Move history cleared");
});

function runMoveSequence(moves, label = "Playing moves") {
  if (
    isRotating ||
    pointerState.active ||
    isPlayingSequence ||
    !moves.length
  ) {
    return;
  }

  isPlayingSequence = true;
  animationQueue = [...moves];

  renderMoveHistory();
  setStatus(label);

  const playNext = () => {
    if (animationQueue.length === 0) {
      isPlayingSequence = false;
      renderMoveHistory();
      setStatus("Sequence complete");
      return;
    }

    const move = animationQueue.shift();

    animateSliceRotation(
      move.axis,
      move.layer,
      move.quarterTurns,
      {
        record: true,
        onComplete: playNext
      }
    );
  };

  playNext();
}

function scrambleCube() {
  if (isRotating || pointerState.active || isPlayingSequence) return;

  const scrambleLength = Math.max(20, CONFIG.size * 8);
  const moves = [];
  let previous = "";

  for (let i = 0; i < scrambleLength; i++) {
    let axis;
    let layer;
    let key;

    do {
      axis = AXIS_NAMES[
        Math.floor(Math.random() * AXIS_NAMES.length)
      ];

      layer = Math.floor(Math.random() * CONFIG.size);
      key = `${axis}:${layer}`;
    } while (key === previous && CONFIG.size > 1);

    previous = key;

    moves.push(
      createMove(
        axis,
        layer,
        Math.random() < 0.5 ? -1 : 1
      )
    );
  }

  runMoveSequence(
    moves,
    `Scrambling with ${moves.length} moves...`
  );
}

scrambleButton?.addEventListener("click", scrambleCube);

// ============================================================
// STATUS
// ============================================================

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// ============================================================
// SCENE
// ============================================================

const {
  scene, camera, renderer, controls, environmentTarget,
  bodyMaterial, stickerMaterials, cubieGeometry, stickerGeometry
} = createScene(root, CONFIG);

// ============================================================
// CUBE STATE
// ============================================================

const cube = new THREE.Group();
scene.add(cube);

const cubiesById = new Map();

let nextCubieId = 0;
let isRotating = false;
let currentRotation = null;

// ============================================================
// GRID HELPERS
// ============================================================

function gridToWorld(grid) {
  const offset = (CONFIG.size - 1) / 2;

  return new THREE.Vector3(
    (grid.x - offset) * CONFIG.spacing,
    (grid.y - offset) * CONFIG.spacing,
    (grid.z - offset) * CONFIG.spacing
  );
}

function gridKey(grid) {
  return `${grid.x},${grid.y},${grid.z}`;
}

// ============================================================
// STICKERS
// ============================================================

function addSticker(cubie, colorKey, position, rotation) {
  const sticker = new THREE.Mesh(
    stickerGeometry,
    stickerMaterials[colorKey]
  );

  sticker.position.copy(position);

  sticker.rotation.set(
    rotation.x,
    rotation.y,
    rotation.z
  );

  sticker.userData.isSticker = true;

  cubie.add(sticker);
}

// ============================================================
// CUBIE GENERATION
// ============================================================

function createCubie(x, y, z) {
  const cubie = new THREE.Mesh(
    cubieGeometry,
    bodyMaterial
  );

  cubie.position.copy(
    gridToWorld({ x, y, z })
  );

  cubie.userData.id = nextCubieId++;

  cubie.userData.gridPosition = { x, y, z };

  cubie.userData.orientation = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];

  cubie.castShadow = false;
  cubie.receiveShadow = false;

  const half =
    CONFIG.cubieSize / 2 + CONFIG.stickerOffset;

  const position = (px, py, pz) =>
    new THREE.Vector3(px, py, pz);

  // A 1×1×1 cube meets all six surface conditions.
  // This creates exactly one cubie with six stickers.

  if (x === CONFIG.size - 1) {
    addSticker(
      cubie,
      "right",
      position(half, 0, 0),
      { x: 0, y: Math.PI / 2, z: 0 }
    );
  }

  if (x === 0) {
    addSticker(
      cubie,
      "left",
      position(-half, 0, 0),
      { x: 0, y: -Math.PI / 2, z: 0 }
    );
  }

  if (y === CONFIG.size - 1) {
    addSticker(
      cubie,
      "top",
      position(0, half, 0),
      { x: -Math.PI / 2, y: 0, z: 0 }
    );
  }

  if (y === 0) {
    addSticker(
      cubie,
      "bottom",
      position(0, -half, 0),
      { x: Math.PI / 2, y: 0, z: 0 }
    );
  }

  if (z === CONFIG.size - 1) {
    addSticker(
      cubie,
      "front",
      position(0, 0, half),
      { x: 0, y: 0, z: 0 }
    );
  }

  if (z === 0) {
    addSticker(
      cubie,
      "back",
      position(0, 0, -half),
      { x: 0, y: Math.PI, z: 0 }
    );
  }

  cubiesById.set(cubie.userData.id, cubie);

  return cubie;
}

// ============================================================
// BUILD / REBUILD CUBE
// ============================================================

function buildCube() {
  cube.clear();
  cubiesById.clear();

  nextCubieId = 0;

  for (let x = 0; x < CONFIG.size; x++) {
    for (let y = 0; y < CONFIG.size; y++) {
      for (let z = 0; z < CONFIG.size; z++) {
        const isSurfaceCubie =
          CONFIG.size === 1 ||
          x === 0 ||
          x === CONFIG.size - 1 ||
          y === 0 ||
          y === CONFIG.size - 1 ||
          z === 0 ||
          z === CONFIG.size - 1;

        if (!isSurfaceCubie) {
          continue;
        }

        cube.add(createCubie(x, y, z));
      }
    }
  }

  rebuildGridLookup();
  updateSizeLabels();
  resizeRenderer();

  validateCubeState();
}

let cubiesByGrid = new Map();

function rebuildGridLookup() {
  cubiesByGrid.clear();

  for (const cubie of cubiesById.values()) {
    cubiesByGrid.set(
      gridKey(cubie.userData.gridPosition),
      cubie
    );
  }
}

function updateSizeLabels() {
  const label = `${CONFIG.size} × ${CONFIG.size} × ${CONFIG.size}`;

  sizeLabel.textContent = label;
  sizeValue.textContent = label;
  sizeSlider.value = String(CONFIG.size);
}

// ============================================================
// CUBE SIZE SLIDER
// ============================================================

function changeCubeSize(newSize) {
  const size = THREE.MathUtils.clamp(
    Math.round(newSize),
    CONFIG.minSize,
    CONFIG.maxSize
  );

  if (size === CONFIG.size || isRotating || pointerState.active) {
    sizeSlider.value = String(CONFIG.size);
    return;
  }

  CONFIG.size = size;

  moveHistory.length = 0;
  historyCursor = 0;

  renderMoveHistory();

  buildCube();
  buildSliceButtons();

  setStatus(`Cube changed to ${size} × ${size} × ${size}`);
}

sizeSlider.addEventListener("input", (event) => {
  changeCubeSize(Number(event.target.value));
});

// ============================================================
// SLICE SELECTION
// ============================================================

function getLayerCubies(axis, layerIndex) {
  return [...cubiesById.values()].filter((cubie) => {
    return cubie.userData.gridPosition[axis] === layerIndex;
  });
}

// ============================================================
// GRID ROTATION
// ============================================================

function orientationToQuaternion(orientation) {
  const matrix = new THREE.Matrix4().set(
    orientation[0][0], orientation[0][1], orientation[0][2], 0,
    orientation[1][0], orientation[1][1], orientation[1][2], 0,
    orientation[2][0], orientation[2][1], orientation[2][2], 0,
    0, 0, 0, 1
  );
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

// ============================================================
// COMMIT LOGICAL CUBE STATE
// ============================================================

function updateCubeState(cubies, axis, quarterTurns) {
  if (quarterTurns === 0) {
    return;
  }

  const direction = Math.sign(quarterTurns);
  const repetitions = Math.abs(quarterTurns);

  for (const cubie of cubies) {
    for (let i = 0; i < repetitions; i++) {
      cubie.userData.gridPosition = rotateGridPosition(
        cubie.userData.gridPosition,
        axis,
        direction,
        CONFIG.size
      );

      cubie.userData.orientation = rotateOrientation(
        cubie.userData.orientation,
        axis,
        direction
      );
    }
  }
}

// ============================================================
// ANIMATION UTILITIES
// ============================================================

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================
// BEGIN SLICE ROTATION
// ============================================================

function beginSliceRotation(axis, layerIndex) {
  if (!AXES[axis]) {
    return null;
  }

  if (
    !Number.isInteger(layerIndex) ||
    layerIndex < 0 ||
    layerIndex >= CONFIG.size
  ) {
    return null;
  }

  const cubies = getLayerCubies(axis, layerIndex);

  if (cubies.length === 0) {
    return null;
  }

  const pivot = new THREE.Group();
  cube.add(pivot);

  for (const cubie of cubies) {
    pivot.attach(cubie);
  }

  const rotation = {
    axis,
    layerIndex,
    cubies,
    pivot,
    angle: 0,
    settled: false,
    recordMove: true,
    onComplete: null
  };

  currentRotation = rotation;

  return rotation;
}

// ============================================================
// FINISH ROTATION
// ============================================================

function finishSliceRotation(rotation, quarterTurns) {
  const { axis, cubies, pivot } = rotation;

  pivot.quaternion.setFromAxisAngle(
    AXES[axis],
    quarterTurns * Math.PI / 2
  );

  pivot.updateMatrixWorld(true);

  for (const cubie of cubies) {
    cube.attach(cubie);
  }

  updateCubeState(cubies, axis, quarterTurns);

  for (const cubie of cubies) {
    cubie.position.copy(
      gridToWorld(cubie.userData.gridPosition)
    );

    cubie.quaternion.copy(
      orientationToQuaternion(cubie.userData.orientation)
    );

    cubie.scale.set(1, 1, 1);
    cubie.updateMatrix();
  }

  cube.remove(pivot);

  rebuildGridLookup();

  isRotating = false;
  currentRotation = null;

  controls.enabled = true;

  if (quarterTurns !== 0) {
    if (rotation.recordMove !== false) {
      recordMove(axis, rotation.layerIndex, quarterTurns);
    }

    setStatus(
      `${AXIS_LABELS[axis]}${rotation.layerIndex + 1}` +
      `${quarterTurns < 0 ? "'" : ""} completed`
    );
  } else {
    setStatus("Ready for a turn");
  }

  validateCubeState();
  renderMoveHistory();

  if (typeof rotation.onComplete === "function") {
    const callback = rotation.onComplete;
    rotation.onComplete = null;
    callback();
  }
}

// ============================================================
// SETTLE / ANIMATE ROTATION
// ============================================================

function settleSlice(rotation, targetAngle = null) {
  if (!rotation || rotation.settled) {
    return;
  }

  rotation.settled = true;

  const quarterTurn = Math.PI / 2;

  const targetQuarterTurns = targetAngle === null
    ? Math.round(rotation.angle / quarterTurn)
    : Math.round(targetAngle / quarterTurn);

  const snappedAngle = targetQuarterTurns * quarterTurn;

  const startAngle = rotation.angle;
  const difference = snappedAngle - startAngle;
  const startTime = performance.now();

  function animateSettle(now) {
    const progress = Math.min(
      (now - startTime) / CONFIG.rotationDuration,
      1
    );

    const eased = easeInOutCubic(progress);
    const angle = startAngle + difference * eased;

    rotation.pivot.quaternion.setFromAxisAngle(
      AXES[rotation.axis],
      angle
    );

    if (progress < 1) {
      requestAnimationFrame(animateSettle);
      return;
    }

    finishSliceRotation(rotation, targetQuarterTurns);
  }

  if (Math.abs(difference) < 0.0001) {
    finishSliceRotation(rotation, targetQuarterTurns);
    return;
  }

  requestAnimationFrame(animateSettle);
}

// ============================================================
// ANIMATED BUTTON / KEYBOARD ROTATION
// ============================================================

function animateSliceRotation(
  axis,
  layerIndex,
  direction = 1,
  options = {}
) {
  if (isRotating || pointerState.active) {
    return;
  }

  if (
    !AXES[axis] ||
    !Number.isInteger(layerIndex) ||
    layerIndex < 0 ||
    layerIndex >= CONFIG.size
  ) {
    return;
  }

  const rotation = beginSliceRotation(axis, layerIndex);

  if (!rotation) {
    return false;
  }

  rotation.recordMove = options.record !== false;
  rotation.onComplete = options.onComplete ?? null;

  isRotating = true;
  controls.enabled = false;

  const startTime = performance.now();
  const targetAngle = direction * Math.PI / 2;

  setStatus(
    `Rotating ${AXIS_LABELS[axis]}${layerIndex + 1}...`
  );

  function animateTurn(now) {
    const progress = Math.min(
      (now - startTime) / CONFIG.rotationDuration,
      1
    );

    const eased = easeInOutCubic(progress);

    rotation.angle = targetAngle * eased;

    rotation.pivot.quaternion.setFromAxisAngle(
      AXES[axis],
      rotation.angle
    );

    if (progress < 1) {
      requestAnimationFrame(animateTurn);
      return;
    }

    rotation.angle = targetAngle;
    settleSlice(rotation, targetAngle);
  }

  requestAnimationFrame(animateTurn);

  return true;
}

// ============================================================
// DYNAMIC SLICE BUTTONS
// ============================================================

function buildSliceButtons() {
  for (const axis of AXIS_NAMES) {
    const container = document.getElementById(
      `axis-${axis}-buttons`
    );

    if (!container) {
      continue;
    }

    container.replaceChildren();

    for (let layer = 0; layer < CONFIG.size; layer++) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "slice-button";
      button.textContent = String(layer + 1);

      button.title =
        `Rotate ${axis.toUpperCase()} axis, slice ${layer + 1}`;

      button.setAttribute(
        "aria-label",
        `Rotate ${axis.toUpperCase()} axis slice ${layer + 1}`
      );

      button.addEventListener("click", (event) => {
        animateSliceRotation(
          axis,
          layer,
          event.shiftKey ? -1 : 1
        );
      });

      container.appendChild(button);
    }
  }
}

// ============================================================
// KEYBOARD CONTROLS: X/Y/Z + NUMBER
// ============================================================

let activeKeyboardAxis = null;

const heldAxisKeys = new Set();

function updateKeyboardAxis() {
  if (heldAxisKeys.has("KeyX")) {
    activeKeyboardAxis = "x";
  } else if (heldAxisKeys.has("KeyY")) {
    activeKeyboardAxis = "y";
  } else if (heldAxisKeys.has("KeyZ")) {
    activeKeyboardAxis = "z";
  } else {
    activeKeyboardAxis = null;
  }
}

function getSliceFromDigit(code) {
  if (code === "Digit0" || code === "Numpad0") {
    return 9;
  }

  const match = code.match(/^(?:Digit|Numpad)([1-9])$/);

  if (!match) {
    return null;
  }

  return Number(match[1]) - 1;
}

window.addEventListener("keydown", (event) => {
  const target = event.target;

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  ) {
    return;
  }

  if (
    event.code === "KeyX" ||
    event.code === "KeyY" ||
    event.code === "KeyZ"
  ) {
    heldAxisKeys.add(event.code);
    updateKeyboardAxis();
    return;
  }

  if (!activeKeyboardAxis) {
    return;
  }

  const layer = getSliceFromDigit(event.code);

  if (layer === null) {
    return;
  }

  event.preventDefault();

  if (layer >= CONFIG.size) {
    setStatus(`This cube only has ${CONFIG.size} slices per axis`);
    return;
  }

  animateSliceRotation(
    activeKeyboardAxis,
    layer,
    event.shiftKey ? -1 : 1
  );
});

window.addEventListener("keyup", (event) => {
  heldAxisKeys.delete(event.code);
  updateKeyboardAxis();
});

window.addEventListener("blur", () => {
  heldAxisKeys.clear();
  activeKeyboardAxis = null;
});

// ============================================================
// POINTER / RAYCASTING
// ============================================================

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

const worldQuaternion = new THREE.Quaternion();
const inverseCubeQuaternion = new THREE.Quaternion();
const normalVector = new THREE.Vector3();

const pointerState = {
  active: false,
  pointerId: null,

  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,

  dragging: false,
  rotation: null,

  selectedCubie: null,
  faceNormal: null,
  hitPointCubeLocal: null,

  screenDirection: null
};

// ============================================================
// POINTER COORDINATES
// ============================================================

function setPointerCoordinates(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointerNDC.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointerNDC.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function projectCubeLocalPoint(point) {
  const worldPoint = cube.localToWorld(point.clone());
  const ndc = worldPoint.project(camera);

  const rect = renderer.domElement.getBoundingClientRect();

  return new THREE.Vector2(
    (ndc.x + 1) * 0.5 * rect.width,
    (1 - ndc.y) * 0.5 * rect.height
  );
}

// ============================================================
// RAYCASTING
// ============================================================

function findCubieIntersection(event) {
  setPointerCoordinates(event);

  raycaster.setFromCamera(pointerNDC, camera);

  const intersections = raycaster.intersectObjects(
    [...cubiesById.values()],
    false
  );

  return intersections.find(
    (intersection) => intersection.face !== null
  ) ?? null;
}

// ============================================================
// FACE NORMAL
// ============================================================

function getFaceNormalInCubeSpace(intersection) {
  intersection.object.getWorldQuaternion(worldQuaternion);

  normalVector
    .copy(intersection.face.normal)
    .applyQuaternion(worldQuaternion);

  cube.getWorldQuaternion(inverseCubeQuaternion);
  inverseCubeQuaternion.invert();

  normalVector.applyQuaternion(inverseCubeQuaternion);

  normalVector.set(
    Math.round(normalVector.x),
    Math.round(normalVector.y),
    Math.round(normalVector.z)
  );

  return normalVector.clone().normalize();
}

// ============================================================
// PROJECTED ROTATION DIRECTION
// ============================================================

function getProjectedRotationDirection(
  axisName,
  localPoint,
  gridPosition
) {
  const epsilon = 0.01;

  const centerGrid = {
    x: (CONFIG.size - 1) / 2,
    y: (CONFIG.size - 1) / 2,
    z: (CONFIG.size - 1) / 2
  };

  centerGrid[axisName] = gridPosition[axisName];

  const sliceAxisCenter = gridToWorld(centerGrid);

  const relativePoint = localPoint
    .clone()
    .sub(sliceAxisCenter);

  const before = projectCubeLocalPoint(localPoint);

  const rotatedPoint = relativePoint
    .applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(
        AXES[axisName],
        epsilon
      )
    )
    .add(sliceAxisCenter);

  const after = projectCubeLocalPoint(rotatedPoint);
  const delta = after.sub(before);

  if (delta.lengthSq() < 1e-8) {
    return null;
  }

  return delta.normalize();
}

// ============================================================
// GESTURE AXIS SELECTION
// ============================================================

function chooseGestureRotation(
  faceNormal,
  hitPoint,
  gridPosition,
  deltaX,
  deltaY
) {
  const swipe = new THREE.Vector2(deltaX, deltaY);

  if (swipe.lengthSq() < 1e-8) {
    return null;
  }

  swipe.normalize();

  const normalAxis =
    Math.abs(faceNormal.x) > 0.5 ? "x" :
    Math.abs(faceNormal.y) > 0.5 ? "y" : "z";

  let best = null;

  for (const axisName of AXIS_NAMES) {
    if (axisName === normalAxis) {
      continue;
    }

    const positiveDirection = getProjectedRotationDirection(
      axisName,
      hitPoint,
      gridPosition
    );

    if (!positiveDirection) {
      continue;
    }

    for (const sign of [1, -1]) {
      const candidateDirection = positiveDirection
        .clone()
        .multiplyScalar(sign);

      const score = candidateDirection.dot(swipe);

      if (!best || score > best.score) {
        best = {
          axis: axisName,
          sign,
          score,
          screenDirection: positiveDirection.clone()
        };
      }
    }
  }

  if (!best || best.score < 0.15) {
    return null;
  }

  return best;
}

// ============================================================
// POINTER-DOWN
// ============================================================

function handlePointerDown(event) {
  if (pointerState.active || isRotating) {
    return;
  }

  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  // Don't start cube interactions on the floating controls.
  if (panel.contains(event.target)) {
    return;
  }

  const intersection = findCubieIntersection(event);

  // Empty-space dragging remains OrbitControls' responsibility.
  if (!intersection) {
    return;
  }

  const cubie = intersection.object;
  const faceNormal = getFaceNormalInCubeSpace(intersection);

  const hitPointCubeLocal = cube.worldToLocal(
    intersection.point.clone()
  );

  pointerState.active = true;
  pointerState.pointerId = event.pointerId;

  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;

  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;

  pointerState.dragging = false;
  pointerState.rotation = null;

  pointerState.selectedCubie = cubie;
  pointerState.faceNormal = faceNormal;
  pointerState.hitPointCubeLocal = hitPointCubeLocal;

  pointerState.screenDirection = null;

  controls.enabled = false;

  renderer.domElement.setPointerCapture(event.pointerId);
}

// ============================================================
// POINTER-MOVE
// ============================================================

function handlePointerMove(event) {
  if (
    !pointerState.active ||
    event.pointerId !== pointerState.pointerId
  ) {
    return;
  }

  const totalX = event.clientX - pointerState.startX;
  const totalY = event.clientY - pointerState.startY;

  if (!pointerState.dragging) {
    if (
      Math.hypot(totalX, totalY) <
      CONFIG.dragThreshold
    ) {
      return;
    }

    const choice = chooseGestureRotation(
      pointerState.faceNormal,
      pointerState.hitPointCubeLocal,
      pointerState.selectedCubie.userData.gridPosition,
      totalX,
      totalY
    );

    if (!choice) {
      pointerState.lastX = event.clientX;
      pointerState.lastY = event.clientY;
      return;
    }

    const axis = choice.axis;

    const layerIndex =
      pointerState.selectedCubie.userData.gridPosition[axis];

    const rotation = beginSliceRotation(axis, layerIndex);

    if (!rotation) {
      resetPointerState();
      controls.enabled = true;
      return;
    }

    pointerState.dragging = true;
    pointerState.rotation = rotation;
    pointerState.screenDirection = choice.screenDirection;

    isRotating = true;

    setStatus(
      `Dragging ${AXIS_LABELS[axis]}${layerIndex + 1}...`
    );
  }

  const rotation = pointerState.rotation;

  if (!rotation || !pointerState.screenDirection) {
    return;
  }

  const deltaX = event.clientX - pointerState.lastX;
  const deltaY = event.clientY - pointerState.lastY;

  const screenDelta = new THREE.Vector2(deltaX, deltaY);

  // The dot product includes the correct sign already.
  // Do not multiply by a second direction value.
  const projectedPixels = screenDelta.dot(
    pointerState.screenDirection
  );

  const deltaAngle =
    projectedPixels *
    (Math.PI / 2) /
    CONFIG.dragSensitivity;

  rotation.angle += deltaAngle;

  rotation.pivot.quaternion.setFromAxisAngle(
    AXES[rotation.axis],
    rotation.angle
  );

  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
}

// ============================================================
// POINTER-UP
// ============================================================

function handlePointerUp(event) {
  if (
    !pointerState.active ||
    event.pointerId !== pointerState.pointerId
  ) {
    return;
  }

  const rotation = pointerState.rotation;

  if (rotation) {
    settleSlice(rotation, rotation.angle);
  } else {
    controls.enabled = true;
  }

  resetPointerState();
}

// ============================================================
// POINTER RESET / CANCEL
// ============================================================

function resetPointerState() {
  pointerState.active = false;
  pointerState.pointerId = null;

  pointerState.dragging = false;
  pointerState.rotation = null;

  pointerState.selectedCubie = null;
  pointerState.faceNormal = null;
  pointerState.hitPointCubeLocal = null;

  pointerState.screenDirection = null;
}

function handlePointerCancel(event) {
  if (
    !pointerState.active ||
    event.pointerId !== pointerState.pointerId
  ) {
    return;
  }

  const rotation = pointerState.rotation;

  if (rotation) {
    settleSlice(rotation, rotation.angle);
  } else {
    controls.enabled = true;
  }

  resetPointerState();
}

// ============================================================
// REGISTER POINTER EVENTS
// ============================================================

renderer.domElement.addEventListener(
  "pointerdown",
  handlePointerDown
);

renderer.domElement.addEventListener(
  "pointermove",
  handlePointerMove
);

renderer.domElement.addEventListener(
  "pointerup",
  handlePointerUp
);

renderer.domElement.addEventListener(
  "pointercancel",
  handlePointerCancel
);

// ============================================================
// VALIDATE CUBE STATE
// ============================================================

function validateCubeState() {
  const occupied = new Set();
  let valid = true;

  for (const cubie of cubiesById.values()) {
    const grid = cubie.userData.gridPosition;

    const inBounds = [grid.x, grid.y, grid.z].every(
      (coordinate) =>
        Number.isInteger(coordinate) &&
        coordinate >= 0 &&
        coordinate < CONFIG.size
    );

    if (!inBounds) {
      console.error("Cubie outside logical grid:", grid);
      valid = false;
      continue;
    }

    const key = gridKey(grid);

    if (occupied.has(key)) {
      console.error("Duplicate cubie position:", key);
      valid = false;
    }

    occupied.add(key);

    const expectedPosition = gridToWorld(grid);

    if (
      cubie.position.distanceTo(expectedPosition) >
      CONFIG.validationTolerance
    ) {
      console.error(
        "Cubie position does not match logical grid:",
        cubie.userData.id
      );

      valid = false;
    }
  }

  if (valid) {
    console.debug(
      `Cube state valid (${cubiesById.size} cubies).`
    );
  }

  return valid;
}

// ============================================================
// RESPONSIVE CAMERA / RENDERER
// ============================================================

function resizeRenderer() {
  const width = root.clientWidth;
  const height = root.clientHeight;

  if (width <= 0 || height <= 0) {
    return;
  }

  camera.aspect = width / height;

  const halfVerticalFov = THREE.MathUtils.degToRad(
    camera.fov / 2
  );

  const halfHorizontalFov = Math.atan(
    Math.tan(halfVerticalFov) * camera.aspect
  );

  const limitingHalfFov = Math.min(
    halfVerticalFov,
    halfHorizontalFov
  );

  const cubeRadius = Math.sqrt(3) * (
    (CONFIG.size - 1) * CONFIG.spacing +
    CONFIG.cubieSize
  ) / 2;

  const fitDistance =
    (cubeRadius / Math.sin(limitingHalfFov)) * 1.12;

  const desiredDistance = Math.max(
    CONFIG.cameraDistance,
    fitDistance
  );

  const viewDirection = camera.position
    .clone()
    .sub(controls.target)
    .normalize();

  camera.position.copy(
    controls.target
      .clone()
      .addScaledVector(viewDirection, desiredDistance)
  );

  controls.minDistance = Math.min(
    3.5,
    desiredDistance * 0.65
  );

  controls.maxDistance = Math.max(
    30,
    desiredDistance * 2.4
  );

  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(root);

// ============================================================
// INITIALIZE
// ============================================================

buildCube();
buildSliceButtons();
renderMoveHistory();
resizeRenderer();

// ============================================================
// ANIMATION LOOP
// ============================================================

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

animate();

// ============================================================
// CLEANUP
// ============================================================

window.addEventListener("beforeunload", () => {
  resizeObserver.disconnect();
  controls.dispose();

  renderer.domElement.removeEventListener(
    "pointerdown",
    handlePointerDown
  );

  renderer.domElement.removeEventListener(
    "pointermove",
    handlePointerMove
  );

  renderer.domElement.removeEventListener(
    "pointerup",
    handlePointerUp
  );

  renderer.domElement.removeEventListener(
    "pointercancel",
    handlePointerCancel
  );

  cubieGeometry.dispose();
  stickerGeometry.dispose();
  bodyMaterial.dispose();

  Object.values(stickerMaterials).forEach((material) => {
    material.dispose();
  });

  environmentTarget.dispose();
  renderer.dispose();
});