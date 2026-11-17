import * as THREE from "three";
import { OrbitControls } from "https://esm.sh/three@0.158.0/examples/jsm/controls/OrbitControls.js?external=three";
import { RoomEnvironment } from "https://esm.sh/three@0.158.0/examples/jsm/environments/RoomEnvironment.js?external=three";
import { COLORS } from "../config.js";

/** Owns the WebGL renderer, camera, controls, lighting, and reusable assets. */
export function createScene(root, CONFIG) {
  const scene = new THREE.Scene();
  scene.background = null;

  // ============================================================
  // CAMERA
  // ============================================================

  const camera = new THREE.PerspectiveCamera(
    40,
    1,
    0.1,
    100
  );

  camera.position.set(
    CONFIG.cameraDistance,
    CONFIG.cameraDistance * 0.75,
    CONFIG.cameraDistance
  );

  camera.lookAt(0, 0, 0);

  // ============================================================
  // RENDERER
  // ============================================================

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio)
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  renderer.domElement.style.touchAction = "none";
  root.appendChild(renderer.domElement);

  // ============================================================
  // ENVIRONMENT MAP
  // ============================================================

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const roomEnvironment = new RoomEnvironment();

  const environmentTarget = pmremGenerator.fromScene(
    roomEnvironment,
    0.04
  );

  scene.environment = environmentTarget.texture;

  roomEnvironment.dispose();
  pmremGenerator.dispose();

  // ============================================================
  // ORBIT CONTROLS
  // ============================================================

  const controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;

  controls.minDistance = 3.5;
  controls.maxDistance = 30;

  controls.target.set(0, 0, 0);

  // ============================================================
  // LIGHTING
  // ============================================================

  scene.add(
    new THREE.AmbientLight(0xffffff, 1.8)
  );

  const keyLight = new THREE.DirectionalLight(
    0xffffff,
    3
  );

  keyLight.position.set(5, 8, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(
    0xa9bbff,
    1.1
  );

  fillLight.position.set(-5, 2, -4);
  scene.add(fillLight);

  // ============================================================
  // MATERIALS
  // ============================================================

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x17191d,
    roughness: 0.48,
    metalness: 0.02
  });

  const stickerMaterialOptions = {
    roughness: 0.2,
    metalness: 0.04,
    envMapIntensity: 1.35,
    clearcoat: 0.48,
    clearcoatRoughness: 0.16,
    side: THREE.DoubleSide
  };

  const stickerMaterials = Object.fromEntries(
    Object.entries(COLORS).map(([key, color]) => [
      key,
      new THREE.MeshPhysicalMaterial({
        ...stickerMaterialOptions,
        color
      })
    ])
  );

  // ============================================================
  // GEOMETRY
  // ============================================================

  const cubieGeometry = new THREE.BoxGeometry(
    CONFIG.cubieSize,
    CONFIG.cubieSize,
    CONFIG.cubieSize
  );

  const stickerGeometry = new THREE.PlaneGeometry(
    CONFIG.stickerSize,
    CONFIG.stickerSize
  );

  return {
    scene, camera, renderer, controls, environmentTarget,
    bodyMaterial, stickerMaterials, cubieGeometry, stickerGeometry
  };
}
