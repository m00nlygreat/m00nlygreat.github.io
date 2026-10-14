const DESCRIPTOR_BITS = 128;
const FEATURE_RADIUS = 9;
const pairPoints = (() => {
  let seed = 0x9e3779b9;
  const random = (limit) => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return Math.abs(seed) % limit; };
  return Array.from({ length: DESCRIPTOR_BITS }, () => [
    random(FEATURE_RADIUS * 2 + 1) - FEATURE_RADIUS, random(FEATURE_RADIUS * 2 + 1) - FEATURE_RADIUS,
    random(FEATURE_RADIUS * 2 + 1) - FEATURE_RADIUS, random(FEATURE_RADIUS * 2 + 1) - FEATURE_RADIUS
  ]);
})();

const popcount = (value) => {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

function descriptorDistance(left, right) {
  let distance = 0;
  for (let index = 0; index < left.length; index++) distance += popcount(left[index] ^ right[index]);
  return distance;
}

function descriptorAt(gray, width, x, y) {
  const bits = new Uint32Array(DESCRIPTOR_BITS / 32);
  for (let index = 0; index < DESCRIPTOR_BITS; index++) {
    const [ax, ay, bx, by] = pairPoints[index];
    if (gray[(y + ay) * width + x + ax] < gray[(y + by) * width + x + bx]) bits[index >>> 5] |= 1 << (index & 31);
  }
  return bits;
}

export function extractFeatures(gray, width, height, maxFeatures = 800) {
  const candidates = [];
  const start = FEATURE_RADIUS + 2;
  const endX = width - start, endY = height - start;
  for (let y = start; y < endY; y++) {
    for (let x = start; x < endX; x++) {
      let xx = 0, yy = 0, xy = 0, contrast = 0;
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const offset = (y + oy) * width + x + ox;
          const gx = gray[offset + 1] - gray[offset - 1];
          const gy = gray[offset + width] - gray[offset - width];
          xx += gx * gx; yy += gy * gy; xy += gx * gy;
          contrast += Math.abs(gx) + Math.abs(gy);
        }
      }
      const score = xx * yy - xy * xy - 0.045 * (xx + yy) ** 2;
      if (score > 0 && contrast > 350) candidates.push({ x, y, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const occupied = new Map();
  const features = [];
  for (const point of candidates) {
    const gx = Math.floor(point.x / 7), gy = Math.floor(point.y / 7);
    let tooClose = false;
    for (let by = gy - 1; by <= gy + 1 && !tooClose; by++) {
      for (let bx = gx - 1; bx <= gx + 1 && !tooClose; bx++) {
        for (const chosen of occupied.get(`${bx},${by}`) || []) {
          if ((chosen.x - point.x) ** 2 + (chosen.y - point.y) ** 2 < 49) { tooClose = true; break; }
        }
      }
    }
    if (tooClose) continue;
    const key = `${gx},${gy}`;
    if (!occupied.has(key)) occupied.set(key, []);
    occupied.get(key).push(point);
    features.push({ x: point.x, y: point.y, descriptor: descriptorAt(gray, width, point.x, point.y) });
    if (features.length >= maxFeatures) break;
  }
  return features;
}

function bestMatches(featuresA, featuresB) {
  const nearestA = [];
  for (const pointA of featuresA) {
    let best = Infinity, second = Infinity, bestIndex = -1;
    for (let index = 0; index < featuresB.length; index++) {
      const distance = descriptorDistance(pointA.descriptor, featuresB[index].descriptor);
      if (distance < best) { second = best; best = distance; bestIndex = index; }
      else if (distance < second) second = distance;
    }
    nearestA.push({ index: bestIndex, best, second });
  }
  const nearestB = new Int32Array(featuresB.length);
  const distancesB = new Int16Array(featuresB.length);
  nearestB.fill(-1); distancesB.fill(32767);
  for (let aIndex = 0; aIndex < featuresA.length; aIndex++) {
    const match = nearestA[aIndex];
    if (match.index >= 0 && match.best < distancesB[match.index]) { nearestB[match.index] = aIndex; distancesB[match.index] = match.best; }
  }
  const matches = [];
  for (let aIndex = 0; aIndex < nearestA.length; aIndex++) {
    const match = nearestA[aIndex];
    if (match.index < 0 || nearestB[match.index] !== aIndex || match.best > 44) continue;
    if (match.second < Infinity && match.best > match.second * 0.82) continue;
    matches.push({ a: featuresA[aIndex], b: featuresB[match.index], distance: match.best });
  }
  return matches;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

export function correlationScore(imageA, imageB, dx, dy, stride) {
  const startX = Math.max(0, -dx), endX = Math.min(imageB.width, imageA.width - dx);
  const startY = Math.max(0, -dy), endY = Math.min(imageB.height, imageA.height - dy);
  const overlapWidth = endX - startX, overlapHeight = endY - startY;
  if (overlapWidth < 18 || overlapHeight < 18) return null;
  let count = 0, sumA = 0, sumB = 0, squareA = 0, squareB = 0, product = 0;
  for (let y = startY; y < endY; y += stride) {
    const rowA = (y + dy) * imageA.width;
    const rowB = y * imageB.width;
    for (let x = startX; x < endX; x += stride) {
      const a = imageA.gray[rowA + x + dx], b = imageB.gray[rowB + x];
      sumA += a; sumB += b; squareA += a * a; squareB += b * b; product += a * b; count++;
    }
  }
  if (count < 100) return null;
  const varianceA = squareA - sumA * sumA / count;
  const varianceB = squareB - sumB * sumB / count;
  if (varianceA < count * 18 || varianceB < count * 18) return null;
  return (product - sumA * sumB / count) / Math.sqrt(varianceA * varianceB);
}

export function correlateTranslation(imageA, imageB) {
  const factor = Math.max(2, Math.ceil(Math.max(imageA.width, imageA.height) / 160));
  const width = Math.ceil(imageA.width / factor), height = Math.ceil(imageA.height / factor);
  const sampleImage = (source) => {
    const gray = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const sourceY = Math.min(source.height - 1, Math.round(y * source.height / height));
      for (let x = 0; x < width; x++) {
        const sourceX = Math.min(source.width - 1, Math.round(x * source.width / width));
        gray[y * width + x] = source.gray[sourceY * source.width + sourceX];
      }
    }
    return { width, height, gray };
  };
  const a = sampleImage(imageA), b = sampleImage(imageB);
  const maxX = Math.floor(width * .76), maxY = Math.floor(height * .76);
  const stride = Math.max(2, Math.round(Math.min(width, height) / 64));
  let best = { score: -1, dx: 0, dy: 0 };
  const peaks = [];
  const startX = -Math.floor(maxX / 2) * 2, startY = -Math.floor(maxY / 2) * 2;
  for (let dy = startY; dy <= maxY; dy += 2) {
    for (let dx = startX; dx <= maxX; dx += 2) {
      const score = correlationScore(a, b, dx, dy, stride);
      if (score === null) continue;
      if (score > best.score) best = { score, dx, dy };
      if (score > .7) peaks.push({ score, dx, dy });
    }
  }
  if (best.score < .75) return { matched: false, reason: 'low-correlation', confidence: best.score, dx: best.dx * factor, dy: best.dy * factor };
  const competing = peaks.filter((point) => Math.hypot(point.dx - best.dx, point.dy - best.dy) > 5)
    .sort((left, right) => right.score - left.score)[0];
  const margin = competing ? best.score - competing.score : 1;
  if (margin < .012) return { matched: false, reason: 'ambiguous-correlation', confidence: best.score, margin, dx: best.dx * factor, dy: best.dy * factor };

  const fineStride = Math.max(3, Math.round(Math.min(imageA.width, imageA.height) / 96));
  let fine = { score: -1, dx: best.dx * factor, dy: best.dy * factor };
  const centerX = best.dx * factor, centerY = best.dy * factor;
  for (let dy = centerY - factor; dy <= centerY + factor; dy++) {
    for (let dx = centerX - factor; dx <= centerX + factor; dx++) {
      const score = correlationScore(imageA, imageB, dx, dy, fineStride);
      if (score !== null && score > fine.score) fine = { score, dx, dy };
    }
  }
  const overlapWidth = imageA.width - Math.abs(fine.dx), overlapHeight = imageA.height - Math.abs(fine.dy);
  const overlapRatio = Math.max(0, overlapWidth) * Math.max(0, overlapHeight) / (imageA.width * imageA.height);
  if (fine.score < .80 || overlapRatio < .08) return { matched: false, reason: 'low-correlation', confidence: fine.score, overlapRatio, dx: fine.dx, dy: fine.dy };
  const pixelScale = imageA.originalWidth / imageA.width;
  return { matched: true, dx: Math.round(fine.dx * pixelScale), dy: Math.round(fine.dy * pixelScale), confidence: Math.min(fine.score, .999), overlapRatio, inliers: 0, correspondences: 0, method: 'normalized-correlation' };
}

export function matchPair(imageA, imageB) {
  if (imageA.originalWidth !== imageB.originalWidth || imageA.originalHeight !== imageB.originalHeight) {
    return { matched: false, reason: 'different-size' };
  }
  if (imageA.width < 40 || imageA.height < 40 || imageB.width < 40 || imageB.height < 40) {
    return { matched: false, reason: 'too-small' };
  }
  const featuresA = imageA.features || extractFeatures(imageA.gray, imageA.width, imageA.height);
  const featuresB = imageB.features || extractFeatures(imageB.gray, imageB.width, imageB.height);
  if (featuresA.length < 8 || featuresB.length < 8) return correlateTranslation(imageA, imageB);
  const matches = bestMatches(featuresA, featuresB);
  if (matches.length < 8) return correlateTranslation(imageA, imageB);

  let bestInliers = [];
  for (const candidate of matches) {
    const dx = candidate.a.x - candidate.b.x;
    const dy = candidate.a.y - candidate.b.y;
    const inliers = matches.filter((match) => Math.hypot((match.a.x - match.b.x) - dx, (match.a.y - match.b.y) - dy) <= 3.25);
    if (inliers.length > bestInliers.length) bestInliers = inliers;
  }
  const ratio = bestInliers.length / matches.length;
  if (bestInliers.length < 7 || ratio < 0.46) return correlateTranslation(imageA, imageB);
  const dx = median(bestInliers.map((match) => match.a.x - match.b.x));
  const dy = median(bestInliers.map((match) => match.a.y - match.b.y));
  const spreadX = Math.max(...bestInliers.map((match) => match.a.x)) - Math.min(...bestInliers.map((match) => match.a.x));
  const spreadY = Math.max(...bestInliers.map((match) => match.a.y)) - Math.min(...bestInliers.map((match) => match.a.y));
  const coverage = Math.max(spreadX / imageA.width, spreadY / imageA.height);
  if (coverage < 0.16) return correlateTranslation(imageA, imageB);
  const overlapWidth = imageA.width - Math.abs(dx), overlapHeight = imageA.height - Math.abs(dy);
  const overlapRatio = Math.max(0, overlapWidth) * Math.max(0, overlapHeight) / (imageA.width * imageA.height);
  if (overlapRatio < 0.06 || overlapWidth < 18 || overlapHeight < 18) return correlateTranslation(imageA, imageB);
  const pixelScale = imageA.originalWidth / imageA.width;
  return {
    matched: true, dx: Math.round(dx * pixelScale), dy: Math.round(dy * pixelScale),
    confidence: ratio, inliers: bestInliers.length, correspondences: matches.length, overlapRatio
  };
}

export function buildStitchComponents(images, edges) {
  const parent = images.map((_, index) => index);
  const find = (value) => parent[value] === value ? value : (parent[value] = find(parent[value]));
  const graph = images.map(() => []);
  for (const edge of [...edges].sort((a, b) => b.confidence - a.confidence)) {
    const aRoot = find(edge.a), bRoot = find(edge.b);
    if (aRoot === bRoot) continue;
    parent[bRoot] = aRoot;
    graph[edge.a].push({ index: edge.b, dx: edge.dx, dy: edge.dy });
    graph[edge.b].push({ index: edge.a, dx: -edge.dx, dy: -edge.dy });
  }
  const components = new Map();
  images.forEach((_, index) => {
    const root = find(index);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(index);
  });
  return [...components.values()].map((indices) => {
    const positions = new Map([[indices[0], { x: 0, y: 0 }]]);
    const queue = [indices[0]];
    while (queue.length) {
      const current = queue.shift();
      for (const edge of graph[current]) {
        if (positions.has(edge.index)) continue;
        const position = positions.get(current);
        positions.set(edge.index, { x: position.x + edge.dx, y: position.y + edge.dy });
        queue.push(edge.index);
      }
    }
    return indices.map((index) => ({ index, ...positions.get(index), matched: indices.length > 1 }));
  });
}

export function createStitchResult(images, edges, rejectedPairsByReason = {}, failureReasonsByIndex = []) {
  const components = buildStitchComponents(images, edges);
  return {
    components: components.map((component) => component.map(({ index, x, y, matched }) => {
      const needsAlignment = images.length > 1 && !matched;
      return {
        assetId: images[index].assetId,
        x,
        y,
        matched,
        needsAlignment,
        failureReasons: needsAlignment ? [...(failureReasonsByIndex[index] || [])].sort() : []
      };
    })),
    matchedPairs: edges.length,
    rejectedPairsByReason: { ...rejectedPairsByReason }
  };
}
