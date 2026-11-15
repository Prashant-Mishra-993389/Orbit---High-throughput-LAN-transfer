import path from 'node:path';
import fs from 'node:fs/promises';
import { sanitizeFilename } from '@sharelan/shared';

export { sanitizeFilename };

/**
 * Safe directory traversal validator.
 * Returns true if targetPath is strictly inside parentDir.
 */
export function isPathInside(parentDir: string, targetPath: string): boolean {
  const resolvedParent = path.resolve(parentDir);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedParent === resolvedTarget) return false;
  return resolvedTarget.startsWith(resolvedParent + path.sep);
}

/**
 * Finds a collision-free filename in target directory.
 * Never overwrites existing destination files silently.
 * E.g., 'photo.jpg' -> 'photo (1).jpg' -> 'photo (2).jpg'
 */
export async function getUniqueDestinationPath(targetDir: string, originalFileName: string): Promise<string> {
  const safeName = sanitizeFilename(originalFileName);
  let candidatePath = path.join(targetDir, safeName);

  try {
    await fs.access(candidatePath);
  } catch {
    // File doesn't exist, we can use this path
    return candidatePath;
  }

  // File exists, generate (1), (2), etc.
  const ext = path.extname(safeName);
  const baseName = path.basename(safeName, ext);

  let counter = 1;
  while (true) {
    const nextName = `${baseName} (${counter})${ext}`;
    candidatePath = path.join(targetDir, nextName);
    try {
      await fs.access(candidatePath);
      counter++;
    } catch {
      return candidatePath;
    }
  }
}
