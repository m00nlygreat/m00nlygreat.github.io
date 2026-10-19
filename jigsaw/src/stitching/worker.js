import { createStitchResult, extractFeatures, matchPair } from './matcher.js';

async function readImage(blob, originalWidth, originalHeight, assetId) {
  let bitmap;
  try { bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { bitmap = await createImageBitmap(blob); }
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel++) {
    gray[pixel] = (rgba[index] * 77 + rgba[index + 1] * 150 + rgba[index + 2] * 29) >> 8;
  }
  bitmap.close();
  return { assetId, width, height, gray, features: extractFeatures(gray, width, height), originalWidth, originalHeight };
}

self.onmessage = async (event) => {
  const { operationId, images, candidatePairs, allowDifferentDimensions = false } = event.data;
  try {
    const decoded = [];
    for (let index = 0; index < images.length; index++) {
      decoded.push(await readImage(images[index].blob, images[index].width, images[index].height, images[index].assetId));
      self.postMessage({ operationId, type: 'progress', phase: 'read', completed: index + 1, total: images.length });
    }
    const edges = [];
    const failureReasonsByIndex = Array.from({ length: images.length }, () => new Set());
    const rejectedPairsByReason = {};
    if (candidatePairs !== null && candidatePairs !== undefined && (!Array.isArray(candidatePairs) || candidatePairs.some((pair) => !Array.isArray(pair) || pair.length !== 2
      || !pair.every((index) => Number.isInteger(index) && index >= 0 && index < images.length) || pair[0] === pair[1]))) {
      throw new Error('비교할 이미지 쌍이 올바르지 않습니다.');
    }
    const total = candidatePairs?.length ?? images.length * (images.length - 1) / 2;
    function* allPairs() {
      for (let a = 0; a < images.length; a++) for (let b = a + 1; b < images.length; b++) yield [a, b];
    }
    let completed = 0;
    for (const [a, b] of candidatePairs || allPairs()) {
      const result = matchPair(decoded[a], decoded[b], { allowDifferentDimensions });
      if (result.matched) edges.push({ a, b, dx: result.dx, dy: result.dy, confidence: result.confidence });
      else {
        const reason = result.reason || 'no-overlap';
        rejectedPairsByReason[reason] = (rejectedPairsByReason[reason] || 0) + 1;
        failureReasonsByIndex[a].add(reason);
        failureReasonsByIndex[b].add(reason);
      }
      completed++;
      self.postMessage({ operationId, type: 'progress', phase: 'match', completed, total, matchedPairs: edges.length });
    }
    self.postMessage({ operationId, type: 'progress', phase: 'layout', completed: 0, total: images.length });
    const result = createStitchResult(decoded, edges, rejectedPairsByReason, failureReasonsByIndex);
    const matchedEdges = edges.map(({ a, b, dx, dy, confidence }) => ({
      assetIdA: images[a].assetId,
      assetIdB: images[b].assetId,
      dx,
      dy,
      confidence
    }));
    self.postMessage({ operationId, type: 'progress', phase: 'layout', completed: images.length, total: images.length });
    self.postMessage({ operationId, type: 'result', ...result, matchedEdges });
  } catch (error) {
    self.postMessage({ operationId, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
