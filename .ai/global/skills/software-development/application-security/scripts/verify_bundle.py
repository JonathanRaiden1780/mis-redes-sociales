#!/usr/bin/env python3
"""Verify a bundle.aiep file decrypts correctly and list its contents.

Usage:
    python3 scripts/verify_bundle.py <bundle_path> <passphrase>

Exit codes:
    0 - OK, prints file listing
    1 - Decryption failed (wrong passphrase or corrupted)
    2 - Invalid bundle format
"""

from __future__ import annotations

import sys
import tarfile
import io
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from aiep.security.crypto import EncryptedBlob, decrypt, EncryptionError


def main(bundle_path: str, passphrase: str) -> int:
    path = Path(bundle_path)
    if not path.exists():
        print(f"ERROR: Bundle not found: {path}", file=sys.stderr)
        return 2

    size = path.stat().st_size
    print(f"Bundle: {path} ({size} bytes)")

    # Deserialize
    try:
        blob = EncryptedBlob.deserialize(path.read_bytes())
    except (ValueError, KeyError) as e:
        print(f"ERROR: Invalid bundle format: {e}", file=sys.stderr)
        return 2

    print(f"Algorithm: {blob.algorithm}")
    print(f"Iterations: {blob.iterations}")
    print(f"Salt: {blob.salt[:8]}...")
    print(f"Ciphertext: {len(blob.ciphertext)} bytes")

    # Decrypt
    try:
        tar_data = decrypt(blob, passphrase)
    except EncryptionError as e:
        print(f"ERROR: Decryption failed: {e}", file=sys.stderr)
        print("Wrong passphrase or corrupted data.", file=sys.stderr)
        return 1

    # List tar contents
    tar_buffer = io.BytesIO(tar_data.encode("latin-1"))
    try:
        with tarfile.open(fileobj=tar_buffer, mode="r") as tar:
            members = tar.getmembers()
            print(f"\nContents: {len(members)} files\n")
            print(f"{'SIZE':>8}  NAME")
            print("-" * 60)
            for m in members:
                print(f"{m.size:>8}  {m.name}")
    except tarfile.TarError as e:
        print(f"ERROR: Invalid tar archive: {e}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <bundle_path> <passphrase>", file=sys.stderr)
        sys.exit(2)

    sys.exit(main(sys.argv[1], sys.argv[2]))
