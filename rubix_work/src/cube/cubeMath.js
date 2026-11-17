// Pure, testable cube transformations (no DOM or Three.js dependency).

export function rotateGridPosition(grid, axis, direction, size) {
  const { x, y, z } = grid;
  const max = size - 1;

  if (axis === "x") {
    return direction === 1
      ? { x, y: max - z, z: y }
      : { x, y: z, z: max - y };
  }

  if (axis === "y") {
    return direction === 1
      ? { x: z, y, z: max - x }
      : { x: max - z, y, z: x };
  }

  if (axis === "z") {
    return direction === 1
      ? { x: max - y, y: x, z }
      : { x: y, y: max - x, z };
  }

  throw new Error(`Unknown axis: ${axis}`);
}

// ============================================================
// ORIENTATION MATRICES
// ============================================================

function multiplyMatrices3(a, b) {
  const result = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      for (let k = 0; k < 3; k++) {
        result[row][col] += a[row][k] * b[k][col];
      }
    }
  }

  return result;
}

function getRotationMatrix3(axis, direction) {
  if (axis === "x") {
    return direction === 1
      ? [
          [1, 0, 0],
          [0, 0, -1],
          [0, 1, 0]
        ]
      : [
          [1, 0, 0],
          [0, 0, 1],
          [0, -1, 0]
        ];
  }

  if (axis === "y") {
    return direction === 1
      ? [
          [0, 0, 1],
          [0, 1, 0],
          [-1, 0, 0]
        ]
      : [
          [0, 0, -1],
          [0, 1, 0],
          [1, 0, 0]
        ];
  }

  if (axis === "z") {
    return direction === 1
      ? [
          [0, -1, 0],
          [1, 0, 0],
          [0, 0, 1]
        ]
      : [
          [0, 1, 0],
          [-1, 0, 0],
          [0, 0, 1]
        ];
  }

  throw new Error(`Unknown axis: ${axis}`);
}

export function rotateOrientation(orientation, axis, direction) {
  return multiplyMatrices3(
    getRotationMatrix3(axis, direction),
    orientation
  );
}

