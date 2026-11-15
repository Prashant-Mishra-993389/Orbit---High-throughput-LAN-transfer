# ShareLAN Security Model

## Principles
1. **LAN is Not Trusted**: Anyone on the same public hostel or campus Wi-Fi can theoretically reach an exposed port.
2. **Strict Filesystem Sandboxing**: All writes and downloads are strictly constrained to the designated storage directory.
3. **No Arbitrary File Access**: Path traversal (`../../`) is categorically blocked.
4. **No Silent Overwrites**: Files matching existing names automatically get non-colliding suffixes (`(1)`).

---

## Filesystem Protection
- **Path Traversal Guard**:
  ```typescript
  export function isPathInside(parentDir: string, targetPath: string): boolean {
    const resolvedParent = path.resolve(parentDir);
    const resolvedTarget = path.resolve(targetPath);
    if (resolvedParent === resolvedTarget) return false;
    return resolvedTarget.startsWith(resolvedParent + path.sep);
  }
  ```
- **Windows Illegal Characters**:
  Strips control characters (0-31), `< > : " / \ | ? *`, trailing periods, and spaces.
- **Reserved Names**:
  Protects against DOS reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
- **Temporary Files**:
  All in-flight streams write to `.sharelan.part` files within an isolated `.temp` directory. Files are promoted via atomic rename only upon SHA-256 verification.
- **Auto-Cleanup**:
  Cancelled or failed transfers immediately delete incomplete `.part` files to prevent disk exhaustion.
