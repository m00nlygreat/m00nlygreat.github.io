import { referencedAssetIds } from '../domain/model.js';

export function createPersistenceSnapshot(document, assetStore, view, stateRevision) {
  const assets = [];
  for (const id of referencedAssetIds(document)) {
    const asset = assetStore.get(id);
    const metadata = document.assets[id];
    if (asset && metadata) assets.push({ ...metadata, blob: asset.blob });
  }
  return {
    schemaVersion: 1,
    document: structuredClone(document),
    assets,
    view: structuredClone(view),
    stateRevision
  };
}
