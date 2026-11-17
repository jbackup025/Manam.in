import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { MAX_ASSETS_PER_WEDDING } from './constants';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { AssetKind, WeddingAssetDoc } from '../types/wedding';

function getLimitsForKind(kind: AssetKind): { maxDimension: number; maxBytes: number } {
  if (kind === 'logo' || kind === 'qr') {
    return { maxDimension: 400, maxBytes: 100 * 1024 };
  }
  return { maxDimension: 1600, maxBytes: 250 * 1024 };
}

function estimateBase64Bytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const b64 = dataUrl.slice(commaIdx + 1);
  return Math.floor((b64.length * 3) / 4);
}

export async function compressImageToWebP(
  file: File,
  kind: AssetKind
): Promise<{ dataUrl: string; width: number; height: number; bytes: number }> {
  const { maxDimension, maxBytes } = getLimitsForKind(kind);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Invalid image file'));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas compression unavailable in this browser');
  }

  let currentWidth = width;
  let currentHeight = height;

  for (let scaleStep = 0; scaleStep < 4; scaleStep++) {
    canvas.width = currentWidth;
    canvas.height = currentHeight;
    ctx.clearRect(0, 0, currentWidth, currentHeight);
    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

    for (let quality = 0.86; quality >= 0.36; quality -= 0.1) {
      const dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp')) {
        // Fallback if Safari/older engine produces PNG
        const jpegUrl = canvas.toDataURL('image/jpeg', quality);
        const bytes = estimateBase64Bytes(jpegUrl);
        if (bytes <= maxBytes) {
          return { dataUrl: jpegUrl, width: currentWidth, height: currentHeight, bytes };
        }
        continue;
      }
      const bytes = estimateBase64Bytes(dataUrl);
      if (bytes <= maxBytes) {
        return { dataUrl, width: currentWidth, height: currentHeight, bytes };
      }
    }

    currentWidth = Math.max(80, Math.round(currentWidth * 0.78));
    currentHeight = Math.max(80, Math.round(currentHeight * 0.78));
  }

  throw new Error(`Could not compress image under ${Math.round(maxBytes / 1024)} KB.`);
}

export async function listWeddingAssets(slug: string): Promise<WeddingAssetDoc[]> {
  const path = `weddings/${slug}/assets`;
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WeddingAssetDoc, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getWeddingAsset(
  slug: string,
  assetId: string
): Promise<WeddingAssetDoc | null> {
  if (!assetId) return null;
  const path = `weddings/${slug}/assets/${assetId}`;
  try {
    const snap = await getDoc(doc(db, path));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<WeddingAssetDoc, 'id'>) };
  } catch {
    return null;
  }
}

export async function uploadWeddingAsset(
  slug: string,
  file: File,
  kind: AssetKind
): Promise<WeddingAssetDoc> {
  const existing = await listWeddingAssets(slug);
  if (existing.length >= MAX_ASSETS_PER_WEDDING) {
    throw new Error(`Maximum ${MAX_ASSETS_PER_WEDDING} images reached for this wedding. Delete an unused image first.`);
  }

  const compressed = await compressImageToWebP(file, kind);
  const assetId = `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `weddings/${slug}/assets/${assetId}`;

  try {
    await setDoc(doc(db, path), {
      kind,
      dataUrl: compressed.dataUrl,
      width: compressed.width,
      height: compressed.height,
      bytes: compressed.bytes,
      createdAt: serverTimestamp(),
    });
    const saved = await getDoc(doc(db, path));
    return { id: assetId, ...(saved.data() as Omit<WeddingAssetDoc, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWeddingAsset(slug: string, assetId: string): Promise<void> {
  const path = `weddings/${slug}/assets/${assetId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
