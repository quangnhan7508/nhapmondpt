// Fan-out hand geometry and drop zone collision helpers

export interface CardFanTransform {
  rotate: number;
  y: number;
  zIndex: number;
}

export function calcFanTransform(index: number, total: number): CardFanTransform {
  if (total <= 1) {
    return { rotate: 0, y: 0, zIndex: 1 };
  }

  const mid = (total - 1) / 2;
  const offset = index - mid;

  // Max fan angle between -24deg and +24deg depending on hand size
  const maxAngle = Math.min(26, total * 3.2);
  const rotate = (offset / Math.max(1, mid)) * maxAngle;

  // Parabolic downward dip for cards towards the edges
  const y = Math.pow(Math.abs(offset), 1.35) * (total > 8 ? 2.5 : 3.5);

  return {
    rotate: Math.round(rotate * 10) / 10,
    y: Math.round(y * 10) / 10,
    zIndex: index + 1
  };
}

export function isDroppedInZone(
  point: { x: number; y: number },
  dropZoneId: string = 'table-drop-zone'
): boolean {
  const el = document.getElementById(dropZoneId);
  if (!el) {
    // Fallback: if dragged into the upper 65% of the screen
    return point.y < window.innerHeight * 0.65;
  }

  const rect = el.getBoundingClientRect();
  // Add a generous 40px margin around the drop zone for comfortable gameplay
  const margin = 40;
  return (
    point.x >= rect.left - margin &&
    point.x <= rect.right + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.bottom + margin
  );
}
