/**
 * In-Memory Folder Traversal & POSIX TAR Stream Packager
 * Enables zero-disk-overhead, streaming folder drag-and-drop transfers in Orbit.
 */

export interface ScannedFile {
  file: File;
  relativePath: string;
}

export interface FolderPackageResult {
  file: File;
  isFolder: boolean;
  folderName: string;
  totalFiles: number;
  totalBytes: number;
}

/**
 * Recursively scans FileSystemEntry trees from HTML5 drag-and-drop
 */
async function scanDirectoryEntry(
  entry: any,
  currentPath: string
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject);
    });
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    results.push({ file, relativePath });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    // readEntries must be called in a loop until it returns an empty array
    const readAllEntries = async (): Promise<any[]> => {
      const all: any[] = [];
      while (true) {
        const batch = await new Promise<any[]>((resolve, reject) => {
          dirReader.readEntries(resolve, reject);
        });
        if (batch.length === 0) break;
        all.push(...batch);
      }
      return all;
    };

    const entries = await readAllEntries();
    for (const child of entries) {
      const childResults = await scanDirectoryEntry(child, newPath);
      results.push(...childResults);
    }
  }

  return results;
}

/**
 * Creates a standard POSIX ustar 512-byte header for a file entry
 */
function createTarHeader(name: string, size: number, mtimeMs: number): Uint8Array {
  const header = new Uint8Array(512);
  const encoder = new TextEncoder();

  // Normalize path to use forward slashes and max 99 chars in standard name field
  const safeName = name.replace(/\\/g, '/').slice(0, 99);
  const nameBytes = encoder.encode(safeName);
  header.set(nameBytes, 0);

  // File mode: 0000644 (octal)
  header.set(encoder.encode('0000644\0'), 100);

  // Owner UID: 0000000
  header.set(encoder.encode('0000000\0'), 108);

  // Owner GID: 0000000
  header.set(encoder.encode('0000000\0'), 116);

  // File size in octal (11 chars + null)
  const sizeOctal = size.toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(sizeOctal), 124);

  // Mtime in octal (11 chars + null)
  const mtimeOctal = Math.floor(mtimeMs / 1000).toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(mtimeOctal), 136);

  // Checksum field: filled with 8 spaces for calculation
  for (let i = 148; i < 156; i++) header[i] = 32;

  // Type flag: '0' for normal file
  header[156] = 48; // ASCII '0'

  // Magic: 'ustar\0'
  header.set(encoder.encode('ustar\0'), 257);

  // Version: '00'
  header.set(encoder.encode('00'), 263);

  // Uname / Gname
  header.set(encoder.encode('orbit\0'), 265);
  header.set(encoder.encode('orbit\0'), 297);

  // Compute checksum: unsigned sum of all 512 bytes
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }

  // Write checksum: 6 octal digits + null + space
  const checksumOctal = checksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(encoder.encode(checksumOctal), 148);

  return header;
}

/**
 * Packages an array of files into a streaming uncompressed POSIX TAR archive.
 * Zero RAM duplication: Uses Blob parts referencing original File handles directly.
 */
export function packageFilesIntoTar(
  scannedFiles: ScannedFile[],
  archiveName: string
): File {
  const parts: any[] = [];
  let totalBytes = 0;

  for (const item of scannedFiles) {
    const header = createTarHeader(
      item.relativePath,
      item.file.size,
      item.file.lastModified || Date.now()
    );
    parts.push(header.buffer);
    parts.push(item.file);
    totalBytes += 512 + item.file.size;

    // Pad file content to 512-byte boundary
    const remainder = item.file.size % 512;
    if (remainder !== 0) {
      const padSize = 512 - remainder;
      parts.push(new Uint8Array(padSize).buffer);
      totalBytes += padSize;
    }
  }

  // End of archive: two 512-byte zero blocks (1024 bytes)
  const endBlock = new Uint8Array(1024);
  parts.push(endBlock.buffer);
  totalBytes += 1024;

  const tarBlob = new Blob(parts, { type: 'application/x-tar' });
  const finalName = archiveName.endsWith('.tar') ? archiveName : `${archiveName}.tar`;

  return new File([tarBlob], finalName, {
    type: 'application/x-tar',
    lastModified: Date.now(),
  });
}

/**
 * Processes drag-and-drop DataTransfer items or input change events.
 * Detects whether folders or multiple files were dropped.
 */
export async function processDroppedData(
  dataTransfer: DataTransfer
): Promise<FolderPackageResult> {
  const items = dataTransfer.items;

  // Check if browser supports webkitGetAsEntry (Chrome, Edge, Safari, modern Firefox)
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const scanned: ScannedFile[] = [];
    let detectedFolderName = '';
    let isDirectoryDetected = false;

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (!entry) continue;

      if (entry.isDirectory) {
        isDirectoryDetected = true;
        if (!detectedFolderName) detectedFolderName = entry.name;
        const subFiles = await scanDirectoryEntry(entry, entry.name);
        scanned.push(...subFiles);
      } else if (entry.isFile) {
        const file = dataTransfer.files[i] || (await new Promise<File>((r) => (entry as any).file(r)));
        scanned.push({ file, relativePath: file.name });
      }
    }

    if (scanned.length === 0 && dataTransfer.files.length > 0) {
      // Fallback to standard files array
      const f = dataTransfer.files[0];
      return {
        file: f,
        isFolder: false,
        folderName: f.name,
        totalFiles: 1,
        totalBytes: f.size,
      };
    }

    // If a single file was dropped with no directories, return as raw original file
    if (!isDirectoryDetected && scanned.length === 1) {
      return {
        file: scanned[0].file,
        isFolder: false,
        folderName: scanned[0].file.name,
        totalFiles: 1,
        totalBytes: scanned[0].file.size,
      };
    }

    // Multi-file or Folder bundle: Package into streaming TAR archive
    const archiveTitle = detectedFolderName || `Orbit_Batch_${scanned.length}_Files`;
    const tarFile = packageFilesIntoTar(scanned, archiveTitle);
    const sumBytes = scanned.reduce((acc, curr) => acc + curr.file.size, 0);

    return {
      file: tarFile,
      isFolder: isDirectoryDetected || scanned.length > 1,
      folderName: archiveTitle,
      totalFiles: scanned.length,
      totalBytes: sumBytes,
    };
  }

  // Fallback for browsers without webkitGetAsEntry
  const rawFiles = Array.from(dataTransfer.files);
  if (rawFiles.length <= 1) {
    const f = rawFiles[0];
    return {
      file: f,
      isFolder: false,
      folderName: f ? f.name : 'unnamed',
      totalFiles: rawFiles.length,
      totalBytes: f ? f.size : 0,
    };
  }

  // Multi-file fallback: bundle into tar
  const scanned = rawFiles.map((f) => ({ file: f, relativePath: f.name }));
  const archiveTitle = `Orbit_Batch_${scanned.length}_Files`;
  const tarFile = packageFilesIntoTar(scanned, archiveTitle);
  const sumBytes = scanned.reduce((acc, curr) => acc + curr.file.size, 0);

  return {
    file: tarFile,
    isFolder: true,
    folderName: archiveTitle,
    totalFiles: scanned.length,
    totalBytes: sumBytes,
  };
}
