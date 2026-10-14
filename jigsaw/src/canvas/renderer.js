import { allBounds, composeTransform, hitTest, multiply, worldBounds } from '../domain/geometry.js';
import { interpolateTransform } from './transition.js';

const GRID_SIZE = 24;

export class CanvasRenderer {
  constructor(canvas, getBitmap) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.getBitmap = getBitmap;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  toWorld(screenX, screenY, camera) {
    return { x: camera.x + (screenX - this.width / 2) / camera.zoom, y: camera.y + (screenY - this.height / 2) / camera.zoom };
  }

  toScreen(worldX, worldY, camera) {
    return { x: (worldX - camera.x) * camera.zoom + this.width / 2, y: (worldY - camera.y) * camera.zoom + this.height / 2 };
  }

  hitTest(items, metadata, camera, screenX, screenY) {
    return hitTest(items, metadata, this.toWorld(screenX, screenY, camera));
  }

  draw(state) {
    const { document: doc, metadata, camera, selectedId, pending = [], alignDraft, transformDraft, layoutTransition, snapGuides } = state;
    this.currentCamera = camera;
    const context = this.context;
    const dpr = this.dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#16171a';
    context.fillRect(0, 0, this.width, this.height);
    context.fillStyle = '#2b2d31';
    for (let y = 11; y < this.height; y += GRID_SIZE) {
      for (let x = 11; x < this.width; x += GRID_SIZE) {
        context.beginPath();
        context.arc(x, y, 1, 0, Math.PI * 2);
        context.fill();
      }
    }
    const tx = this.width / 2 - camera.x * camera.zoom;
    const ty = this.height / 2 - camera.y * camera.zoom;
    context.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, dpr * tx, dpr * ty);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    for (const item of doc.items) {
      const transition = layoutTransition?.items.get(item.id);
      const transitionTransform = transition ? interpolateTransform(transition.from, transition.to, layoutTransition.progress) : null;
      const override = item.id === alignDraft?.id ? alignDraft.transform
        : item.id === transformDraft?.id ? transformDraft.transform
          : transitionTransform;
      this.drawItem(context, item, metadata, override, transition, layoutTransition?.progress || 0);
    }
    for (let index = 0; index < pending.length; index++) {
      const image = pending[index];
      const x = camera.x - this.width / (2 * camera.zoom) + 32 + index * 26;
      const y = camera.y - this.height / (2 * camera.zoom) + 46;
      context.save();
      context.globalAlpha = 0.36;
      context.drawImage(image.bitmap, x, y, image.width, image.height);
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2 / camera.zoom;
      context.setLineDash([8 / camera.zoom, 5 / camera.zoom]);
      context.strokeRect(x, y, image.width, image.height);
      context.restore();
    }
    this.drawSnapGuides(context, snapGuides, camera);
    const selected = doc.items.find((item) => item.id === selectedId);
    const selectedTransition = selected && layoutTransition?.items.get(selected.id);
    const selectedTransitionTransform = selectedTransition ? interpolateTransform(selectedTransition.from, selectedTransition.to, layoutTransition.progress) : null;
    const selectedOverride = selected && transformDraft?.id === selected.id ? transformDraft.transform
      : selected && alignDraft?.id === selected.id ? alignDraft.transform
        : selectedTransitionTransform;
    if (selected) this.drawSelection(context, this.withTransition(selected, selectedTransition, layoutTransition?.progress || 0, selectedOverride), metadata, camera);
    const alignItem = doc.items.find((item) => item.id === alignDraft?.id);
    if (alignItem) this.drawAlignmentBadge(context, worldBounds({ ...alignItem, ...alignDraft.transform }, metadata), camera);
    if (!alignDraft && layoutTransition) {
      for (const item of doc.items) {
        const transition = item.needsAlignment && layoutTransition.items.get(item.id);
        if (!transition) continue;
        const transform = interpolateTransform(transition.from, transition.to, layoutTransition.progress);
        this.drawAlignmentBadge(context, worldBounds({ ...item, ...transform }, metadata), camera);
      }
    }
  }

  withTransition(item, transition, progress, overrideTransform = null) {
    const visibleItem = overrideTransform ? { ...item, ...overrideTransform } : item;
    if (item.type === 'group' && transition?.children?.size) {
      visibleItem.children = item.children.map((child) => {
        const childTransition = transition.children.get(child.id);
        return childTransition ? { ...child, ...interpolateTransform(childTransition.from, childTransition.to, progress) } : child;
      });
    }
    return visibleItem;
  }

  drawItem(context, item, metadata, overrideTransform = null, transition = null, progress = 0) {
    const visibleItem = this.withTransition(item, transition, progress, overrideTransform);
    const matrix = composeTransform(visibleItem);
    if (item.type === 'group') {
      for (const child of visibleItem.children) this.drawImage(context, child, metadata, this.getBitmap(child.assetId), matrix);
    } else {
      this.drawImage(context, item, metadata, this.getBitmap(item.assetId), null);
    }
    const bounds = worldBounds(visibleItem, metadata);
    if (item.needsAlignment && bounds) {
      context.save();
      context.resetTransform();
      const dpr = this.dpr;
      const screen = this.toScreen(bounds.left, bounds.top, this.currentCamera);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = '#f5bd4f';
      context.beginPath(); context.arc(screen.x + 13, screen.y + 13, 6, 0, Math.PI * 2); context.fill();
      context.restore();
    }
  }

  drawImage(context, image, metadata, bitmap, parentMatrix) {
    if (!bitmap) return;
    const asset = metadata[image.assetId];
    if (!asset) return;
    const matrix = parentMatrix ? multiply(parentMatrix, composeTransform(image)) : composeTransform(image);
    context.save();
    context.transform(...matrix);
    context.drawImage(bitmap, 0, 0, asset.width, asset.height);
    context.restore();
  }

  drawSelection(context, item, metadata, camera) {
    const bounds = worldBounds(item, metadata);
    if (!bounds) return;
    const topLeft = this.toScreen(bounds.left, bounds.top, camera);
    const bottomRight = this.toScreen(bounds.right, bounds.bottom, camera);
    const x = topLeft.x, y = topLeft.y, width = bottomRight.x - x, height = bottomRight.y - y;
    const forcedColors = Boolean(globalThis.matchMedia?.('(forced-colors: active)').matches);
    const selectionColor = forcedColors ? 'Highlight' : '#5b9dff';
    const handleFill = forcedColors ? 'Canvas' : '#f5f8ff';
    context.save();
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.strokeStyle = selectionColor;
    context.lineWidth = 1.5;
    context.setLineDash([]);
    context.strokeRect(x, y, width, height);
    const handles = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
    for (const [hx, hy] of handles) {
      context.fillStyle = handleFill; context.strokeStyle = selectionColor; context.lineWidth = forcedColors ? 2 : 1.5;
      context.beginPath(); context.rect(hx - 4, hy - 4, 8, 8); context.fill(); context.stroke();
    }
    const rotationX = x + width / 2, rotationY = y - 23;
    context.strokeStyle = selectionColor; context.beginPath(); context.moveTo(rotationX, y); context.lineTo(rotationX, rotationY); context.stroke();
    context.fillStyle = handleFill; context.beginPath(); context.arc(rotationX, rotationY, 5, 0, Math.PI * 2); context.fill(); context.stroke();
    context.restore();
  }

  drawSnapGuides(context, guides, camera) {
    if (!guides) return;
    context.save();
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.strokeStyle = globalThis.matchMedia?.('(forced-colors: active)').matches ? 'CanvasText' : '#ff6f91';
    context.lineWidth = 1;
    context.setLineDash([]);
    context.beginPath();
    if (guides.x !== null) {
      const x = this.toScreen(guides.x, camera.y, camera).x;
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
    }
    if (guides.y !== null) {
      const y = this.toScreen(camera.x, guides.y, camera).y;
      context.moveTo(0, y);
      context.lineTo(this.width, y);
    }
    context.stroke();
    context.restore();
  }

  drawAlignmentBadge(context, bounds, camera) {
    if (!bounds) return;
    const screen = this.toScreen(bounds.left, bounds.top, camera);
    context.save(); context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.fillStyle = globalThis.matchMedia?.('(forced-colors: active)').matches ? 'CanvasText' : '#f5bd4f'; context.font = '700 11px system-ui';
    context.fillText('정렬 필요', screen.x + 20, screen.y + 17);
    context.restore();
  }

  fit(items, metadata, camera, padding = 64, viewport = null) {
    const bounds = allBounds(items, metadata);
    if (!bounds) { camera.x = 0; camera.y = 0; camera.zoom = 1; return; }
    const region = viewport || { left: 0, top: 0, right: this.width, bottom: this.height };
    const regionWidth = Math.max(1, region.right - region.left);
    const regionHeight = Math.max(1, region.bottom - region.top);
    const scaleX = Math.max(1, regionWidth - padding * 2) / Math.max(1, bounds.width);
    const scaleY = Math.max(1, regionHeight - padding * 2) / Math.max(1, bounds.height);
    camera.zoom = Math.max(0.04, Math.min(4, Math.min(scaleX, scaleY)));
    const centerX = (region.left + region.right) / 2;
    const centerY = (region.top + region.bottom) / 2;
    camera.x = (bounds.left + bounds.right) / 2 - (centerX - this.width / 2) / camera.zoom;
    camera.y = (bounds.top + bounds.bottom) / 2 - (centerY - this.height / 2) / camera.zoom;
  }
}
