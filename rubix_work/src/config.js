import * as THREE from "three";

export const CONFIG = {
  size: 3,
  minSize: 1,
  maxSize: 10,

  spacing: 1,
  cubieSize: 0.94,

  stickerSize: 0.79,
  stickerOffset: 0.006,

  cameraDistance: 6,
  maxPixelRatio: 2,

  rotationDuration: 250,
  dragThreshold: 6,
  dragSensitivity: 120,

  validationTolerance: 0.001,
  maxHistory: 100
};

// ============================================================
// AXES AND COLORS
// ============================================================

export const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

export const AXIS_NAMES = ["x", "y", "z"];

export const AXIS_LABELS = {
  x: "X",
  y: "Y",
  z: "Z"
};

export const COLORS = {
  right: "#d93636",
  left: "#ff8c24",
  top: "#f4f1e8",
  bottom: "#f0cc35",
  front: "#36b96b",
  back: "#3285e8"
};

