import { ATTACH_DIRS, B, BLOCKS, I, buttonBlock, doorBlock, getItem, leverBlock, type AttachFace } from "./blocks";

export interface PlaceHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  id: number;
}

export interface PlannedCell {
  x: number;
  y: number;
  z: number;
  id: number;
}

/** Which way a door placed by a player looking along `yaw` faces (its slab sits on that side). */
export function doorFacing(yaw: number) {
  return ((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4;
}

/**
 * Blocks to set when using `itemId` on the clicked face. Blocks always attach
 * to the face that was clicked; this only decides which state they take.
 * Returns null when the item cannot be placed there.
 */
export function placementFor(itemId: number, hit: PlaceHit, yaw: number): PlannedCell[] | null {
  const clickedReplaceable = BLOCKS[hit.id]?.replaceable;
  const x = clickedReplaceable ? hit.x : hit.x + hit.nx;
  const y = clickedReplaceable ? hit.y : hit.y + hit.ny;
  const z = clickedReplaceable ? hit.z : hit.z + hit.nz;
  const onTop = clickedReplaceable || hit.ny === 1;

  // Wall-or-floor switches take their face from the side that was clicked.
  const attachFace = (): AttachFace | null => {
    if (onTop) return 0;
    if (hit.ny === -1) return null;
    const i = ATTACH_DIRS.findIndex(([dx, dy, dz]) => dx === -hit.nx && dy === -hit.ny && dz === -hit.nz);
    return i > 0 ? (i as AttachFace) : null;
  };

  switch (itemId) {
    case B.LEVER: {
      const f = attachFace();
      return f === null ? null : [{ x, y, z, id: leverBlock(f, false) }];
    }
    case B.BUTTON: {
      const f = attachFace();
      return f === null ? null : [{ x, y, z, id: buttonBlock(f, false) }];
    }
    case I.REDSTONE:
      return [{ x, y, z, id: B.WIRE_0 }];
    case I.SEEDS:
      return hit.id === B.FARMLAND && hit.ny === 1 ? [{ x, y, z, id: B.WHEAT_0 }] : null;
    case I.WOODEN_DOOR:
    case I.IRON_DOOR: {
      if (!onTop) return null;
      const iron = itemId === I.IRON_DOOR;
      const facing = doorFacing(yaw);
      return [
        { x, y, z, id: doorBlock(iron, facing, false, false) },
        { x, y: y + 1, z, id: doorBlock(iron, facing, false, true) },
      ];
    }
  }
  const block = getItem(itemId)?.block;
  return block === undefined ? null : [{ x, y, z, id: block }];
}
