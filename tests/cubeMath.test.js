import test from "node:test";
import assert from "node:assert/strict";
import { rotateGridPosition, rotateOrientation } from "../src/cube/cubeMath.js";

for (const axis of ["x", "y", "z"]) {
  test(`${axis}: four quarter turns restore a grid position`, () => {
    let position = { x: 0, y: 1, z: 2 };
    for (let turn = 0; turn < 4; turn++) {
      position = rotateGridPosition(position, axis, 1, 3);
    }
    assert.deepEqual(position, { x: 0, y: 1, z: 2 });
  });
  test(`${axis}: inverse turn restores a grid position`, () => {
    const initial = { x: 0, y: 1, z: 2 };
    const moved = rotateGridPosition(initial, axis, 1, 3);
    assert.deepEqual(rotateGridPosition(moved, axis, -1, 3), initial);
  });
  test(`${axis}: four quarter turns restore orientation`, () => {
    const identity = [[1,0,0],[0,1,0],[0,0,1]];
    let orientation = identity;
    for (let turn = 0; turn < 4; turn++) {
      orientation = rotateOrientation(orientation, axis, 1);
    }
    assert.deepEqual(orientation, identity);
  });
}
