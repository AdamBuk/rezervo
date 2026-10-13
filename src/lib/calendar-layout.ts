/** A calendar block positioned in minutes since local midnight. */
export type TimedBlock = { id: string; startMin: number; endMin: number };

export type LaidOutBlock<T extends TimedBlock> = T & {
  /** 0-based lane within its overlap group */
  lane: number;
  /** Number of lanes in its overlap group (the block's width is 1 / lanes) */
  lanes: number;
};

/**
 * Side-by-side layout for blocks in one calendar column: overlapping blocks get
 * separate lanes, each group of transitively overlapping blocks shares a lane
 * count. Back-to-back blocks (10:00–11:00, 11:00–12:00) don't overlap.
 */
export function layoutLanes<T extends TimedBlock>(blocks: readonly T[]): LaidOutBlock<T>[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id));
  const result: LaidOutBlock<T>[] = [];

  let group: LaidOutBlock<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const closeGroup = () => {
    for (const block of group) block.lanes = laneEnds.length;
    result.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const block of sorted) {
    if (block.startMin >= groupEnd) closeGroup();
    // First lane that is free again by the time this block starts.
    let lane = laneEnds.findIndex((end) => end <= block.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.endMin);
    } else {
      laneEnds[lane] = block.endMin;
    }
    group.push({ ...block, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, block.endMin);
  }
  closeGroup();
  return result;
}
