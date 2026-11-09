import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { pool, db } from '@/db/client';
import {
  StorageError,
  ImageProcessingError,
  SecurityPathError,
  processImageWithSharp,
  MAX_ALLOWED_PIXELS,
  AsyncSemaphore,
  globalSharpLimiter,
  getUploadRootDir,
  ensureUploadDirExists,
  generateStorageKey,
  validateStorageKey,
  safeResolvePath,
  inspectFileMagicBytes,
  computeSha256,
  writeAtomicFile,
  safeUnlinkFile,
  runStorageJanitorCleanup,
} from '@/lib/storage';
import * as uploadRoute from '@/app/api/upload/route';
import * as fileRoute from '@/app/api/files/[id]/route';
import * as sessionModule from '@/lib/auth/session';

// ==============================================================================
// Stateful In-Memory Database Simulator for Storage Integration Tests
// ==============================================================================

interface MockAttachment {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: bigint;
  width: number | null;
  height: number | null;
  checksumSha256: string;
  isPrivate: boolean;
  ownerOnly: boolean;
  entityType: 'cost_item' | 'vendor' | 'wedding' | 'task';
  entityId: string | null;
  processingStatus: 'pending' | 'ready' | 'failed';
  errorMessage: string | null;
  uploaderUserId: string;
  leaseExpiresAt: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockVariant {
  id: string;
  attachmentId: string;
  variantType: 'thumbnail_320' | 'preview_1600';
  storageKey: string;
  mimeType: string;
  fileSizeBytes: bigint;
  width: number;
  height: number;
  createdAt: Date;
}

class MockStorageDatabase {
  public attachments = new Map<string, MockAttachment>();
  public variants = new Map<string, MockVariant>();

  clear() {
    this.attachments.clear();
    this.variants.clear();
  }

  handleQuery(queryObj: any, params: any[] = []): { rows: any[]; rowCount: number } {
    const text: string = typeof queryObj === 'string' ? queryObj : queryObj?.text || '';
    const isArrayMode = queryObj?.rowMode === 'array';
    const trimmed = text.trim();

    // Transaction controls
    if (/^(BEGIN|COMMIT|ROLLBACK);?$/i.test(trimmed)) {
      return { rows: [], rowCount: 0 };
    }

    // 1. SELECT FROM attachments
    if (/select .* from "attachments"/i.test(trimmed)) {
      let matched: MockAttachment[] = [];

      // Query by ID: where "attachments"."id" = $1
      if (/where .*"attachments"\."id" = \$1/i.test(trimmed)) {
        const id = params[0];
        const item = this.attachments.get(id);
        if (item) matched.push(item);
      }
      // Janitor query: where ("attachments"."processing_status" = $1 and "attachments"."lease_expires_at" < $2)
      else if (/where .*processing_status.*=.*\$1.*lease_expires_at.*<.*\$2/i.test(trimmed)) {
        const status = params[0];
        const cutoff = new Date(params[1]);
        for (const item of this.attachments.values()) {
          if (item.processingStatus === status && item.leaseExpiresAt && item.leaseExpiresAt < cutoff) {
            matched.push(item);
          }
        }
      } else {
        matched = Array.from(this.attachments.values());
      }

      if (isArrayMode) {
        const rows = matched.map((a) => [
          a.id,
          a.storageKey,
          a.originalName,
          a.mimeType,
          a.fileSizeBytes,
          a.width,
          a.height,
          a.checksumSha256,
          a.isPrivate,
          a.ownerOnly,
          a.entityType,
          a.entityId,
          a.processingStatus,
          a.errorMessage,
          a.uploaderUserId,
          a.leaseExpiresAt,
          a.isArchived,
          a.archivedAt,
          a.createdAt,
          a.updatedAt,
        ]);
        return { rows, rowCount: rows.length };
      }

      return { rows: matched, rowCount: matched.length };
    }

    // 2. INSERT INTO attachments
    if (/insert into "attachments"/i.test(trimmed)) {
      const colMatch = trimmed.match(/insert into "attachments"\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      const rowData: Record<string, any> = {};

      if (colMatch) {
        const colNames = colMatch[1].split(',').map((s) => s.replace(/["\s]/g, ''));
        const valPlaceholders = colMatch[2].split(',').map((s) => s.trim());
        let pIdx = 0;
        for (let i = 0; i < colNames.length; i++) {
          if (valPlaceholders[i].startsWith('$')) {
            rowData[colNames[i]] = params[pIdx++];
          }
        }
      }

      const id = rowData['id'] || params[0] || crypto.randomUUID();
      const storageKey = rowData['storage_key'] || params[1] || '';
      const originalName = rowData['original_name'] || params[2] || '';
      const mimeType = rowData['mime_type'] || params[3] || '';
      const fileSizeBytes = BigInt(rowData['file_size_bytes'] ?? params[4] ?? 0);
      const checksumSha256 = rowData['checksum_sha256'] || params[5] || '';
      const isPrivate = rowData['is_private'] ?? true;
      const ownerOnly = rowData['owner_only'] ?? true;
      const entityType = rowData['entity_type'] || 'wedding';
      const entityId = rowData['entity_id'] || null;
      const uploaderUserId = rowData['uploader_user_id'] || 'user-1';
      const leaseExpiresAt = rowData['lease_expires_at'] || null;

      const newAttachment: MockAttachment = {
        id,
        storageKey,
        originalName,
        mimeType,
        fileSizeBytes,
        width: null,
        height: null,
        checksumSha256,
        isPrivate,
        ownerOnly,
        entityType,
        entityId,
        processingStatus: 'pending',
        errorMessage: null,
        uploaderUserId,
        leaseExpiresAt,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.attachments.set(id, newAttachment);
      return { rows: [], rowCount: 1 };
    }

    // 3. UPDATE attachments
    if (/update "attachments"/i.test(trimmed)) {
      const idParam = params[params.length - 1]; // usually where id = $X
      const existing = this.attachments.get(idParam);
      if (existing) {
        if (/set.*"processing_status"\s*=\s*\$1/i.test(trimmed) || params.includes('failed') || params.includes('ready')) {
          if (params.includes('failed')) {
            existing.processingStatus = 'failed';
            const errParam = params.find((p) => typeof p === 'string' && p !== 'failed' && p !== idParam);
            if (errParam) existing.errorMessage = errParam;
          } else if (params.includes('ready')) {
            existing.processingStatus = 'ready';
            const numParams = params.filter((p) => typeof p === 'number');
            if (numParams.length >= 2) {
              existing.width = numParams[0];
              existing.height = numParams[1];
            }
          }
        }
        existing.updatedAt = new Date();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 4. SELECT FROM attachment_variants
    if (/select .* from "attachment_variants"/i.test(trimmed)) {
      let matched: MockVariant[] = [];
      const attachmentIdParam = params[0];
      const variantTypeParam = params[1];

      for (const v of this.variants.values()) {
        if (attachmentIdParam && v.attachmentId !== attachmentIdParam) continue;
        if (variantTypeParam && v.variantType !== variantTypeParam) continue;
        matched.push(v);
      }

      if (isArrayMode) {
        const rows = matched.map((v) => [
          v.id,
          v.attachmentId,
          v.variantType,
          v.storageKey,
          v.mimeType,
          v.fileSizeBytes,
          v.width,
          v.height,
          v.createdAt,
        ]);
        return { rows, rowCount: rows.length };
      }

      return { rows: matched, rowCount: matched.length };
    }

    // 5. INSERT INTO attachment_variants
    if (/insert into "attachment_variants"/i.test(trimmed)) {
      const rowCount = Math.floor(params.length / 6);
      for (let r = 0; r < rowCount; r++) {
        const offset = r * 6;
        const attachmentId = params[offset];
        const variantType = params[offset + 1] as 'thumbnail_320' | 'preview_1600';
        const storageKey = params[offset + 2];
        const fileSizeBytes = BigInt(params[offset + 3]);
        const width = Number(params[offset + 4]);
        const height = Number(params[offset + 5]);

        const id = crypto.randomUUID();
        const newVariant: MockVariant = {
          id,
          attachmentId,
          variantType,
          storageKey,
          mimeType: 'image/webp',
          fileSizeBytes,
          width,
          height,
          createdAt: new Date(),
        };
        this.variants.set(id, newVariant);
      }
      return { rows: [], rowCount: Math.max(1, rowCount) };
    }

    return { rows: [], rowCount: 0 };
  }
}

const mockDb = new MockStorageDatabase();

// ==============================================================================
// Test Environment Setup
// ==============================================================================

const TEST_UPLOAD_DIR = path.resolve(process.cwd(), '.uploads_test');

describe('Milestone 3 Media Storage, Sharp & Route Handlers Integration Test Suite', () => {
  const ownerUserId = '00000000-0000-4000-8000-000000000001';
  const familyUserId = '00000000-0000-4000-8000-000000000002';

  beforeAll(() => {
    process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
    ensureUploadDirExists(TEST_UPLOAD_DIR);
  });

  afterAll(async () => {
    // Cleanup temporary upload directory
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      await fs.promises.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    mockDb.clear();

    // Wire up Drizzle pool mocks to use mockDb
    vi.spyOn(pool, 'query').mockImplementation((queryObj: any, params?: any) => {
      return mockDb.handleQuery(queryObj, params) as any;
    });

    vi.spyOn(pool, 'connect').mockImplementation(async () => {
      return {
        query: (queryObj: any, params?: any) => mockDb.handleQuery(queryObj, params),
        release: () => {},
      } as any;
    });

    vi.spyOn(sessionModule, 'getCurrentSession').mockImplementation(async (req) => {
      if (!req) return null;
      const headers = req instanceof Request ? req.headers : req;
      const authHeader = headers.get('authorization');
      if (authHeader === 'Bearer owner-token') {
        return {
          user: { id: ownerUserId, name: 'Chủ sở hữu', email: 'owner@wedding.local', role: 'owner' },
          session: { id: 's-owner', userId: ownerUserId, expiresAt: new Date(Date.now() + 86400000), token: 'owner-token' },
          role: 'owner',
          allowedEventIds: [],
        };
      }
      if (authHeader === 'Bearer family-token') {
        return {
          user: { id: familyUserId, name: 'Người nhà', email: 'family@wedding.local', role: 'family_view' },
          session: { id: 's-family', userId: familyUserId, expiresAt: new Date(Date.now() + 86400000), token: 'family-token' },
          role: 'family_view',
          allowedEventIds: [],
        };
      }
      return null;
    });
  });

  // ============================================================================
  // 1. Sharp Pipeline: 40MP Limit, Auto-Orientation, Metadata Stripping & Renditions
  // ============================================================================
  describe('Sharp Processing Pipeline', () => {
    it('rejects images exceeding 40 megapixel limit before complete decoding (Decompression Bomb Protection)', async () => {
      // 6400 x 6400 = 40,960,000 pixels (> 40 MP)
      const bombBuffer = await sharp({
        create: {
          width: 6400,
          height: 6400,
          channels: 3,
          background: { r: 50, g: 50, b: 50 },
        },
      })
        .jpeg({ quality: 20 })
        .toBuffer();

      await expect(
        processImageWithSharp(bombBuffer, '2026/11', 'test-uuid-bomb')
      ).rejects.toThrowError(/vượt quá giới hạn tối đa 40 megapixel/i);
    });

    it('auto-orients image based on EXIF tag with .rotate() and strips all EXIF/GPS metadata from WebP renditions', async () => {
      // Create a 100x200 vertical image with EXIF orientation 6 (90 degrees CW)
      const inputBuffer = await sharp({
        create: {
          width: 100,
          height: 200,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();

      const result = await processImageWithSharp(inputBuffer, '2026/11', 'test-uuid-orient');

      // 1. Verify original dimensions were captured
      expect(result.originalWidth).toBe(100);
      expect(result.originalHeight).toBe(200);

      // 2. Verify exactly 2 renditions were produced
      expect(result.renditions).toHaveLength(2);
      const [preview, thumb] = result.renditions;
      expect(preview.variantType).toBe('preview_1600');
      expect(thumb.variantType).toBe('thumbnail_320');

      // 3. Verify auto-rotation: orientation 6 rotates 90 deg -> width becomes 200, height becomes 100
      expect(preview.width).toBe(200);
      expect(preview.height).toBe(100);
      expect(thumb.width).toBe(200);
      expect(thumb.height).toBe(100);

      // 4. Verify WebP format and EXIF metadata stripping (zero GPS/camera tags)
      const previewMeta = await sharp(preview.buffer).metadata();
      const thumbMeta = await sharp(thumb.buffer).metadata();

      expect(previewMeta.format).toBe('webp');
      expect(thumbMeta.format).toBe('webp');
      expect(previewMeta.exif).toBeUndefined();
      expect(thumbMeta.exif).toBeUndefined();
      expect(previewMeta.orientation).toBeUndefined();
      expect(thumbMeta.orientation).toBeUndefined();
    });

    it('generates preview_1600 (max 1600px, quality 80) and thumbnail_320 (max 320px, quality 75) respecting withoutEnlargement', async () => {
      // Large 2400 x 1200 image
      const inputBuffer = await sharp({
        create: {
          width: 2400,
          height: 1200,
          channels: 3,
          background: { r: 128, g: 64, b: 32 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processImageWithSharp(inputBuffer, '2026/11', 'test-uuid-dimensions');
      const preview = result.renditions.find((r) => r.variantType === 'preview_1600')!;
      const thumb = result.renditions.find((r) => r.variantType === 'thumbnail_320')!;

      // Preview max long edge 1600px: 2400 -> 1600, 1200 -> 800
      expect(preview.width).toBe(1600);
      expect(preview.height).toBe(800);

      // Thumbnail max long edge 320px: 2400 -> 320, 1200 -> 160
      expect(thumb.width).toBe(320);
      expect(thumb.height).toBe(160);
    });

    it('enforces global concurrency limit of max 2 slots via AsyncSemaphore', async () => {
      const sem = new AsyncSemaphore(2);
      expect(sem.getActiveCount()).toBe(0);
      expect(sem.getQueueLength()).toBe(0);

      const release1 = await sem.acquire();
      expect(sem.getActiveCount()).toBe(1);

      const release2 = await sem.acquire();
      expect(sem.getActiveCount()).toBe(2);
      expect(sem.getQueueLength()).toBe(0);

      // 3rd task must queue
      let task3Acquired = false;
      const task3Promise = sem.acquire().then((rel) => {
        task3Acquired = true;
        return rel;
      });

      expect(sem.getActiveCount()).toBe(2);
      expect(sem.getQueueLength()).toBe(1);
      expect(task3Acquired).toBe(false);

      // Release slot 1 -> Task 3 unblocks
      release1();
      const release3 = await task3Promise;
      expect(task3Acquired).toBe(true);
      expect(sem.getActiveCount()).toBe(2);
      expect(sem.getQueueLength()).toBe(0);

      release2();
      release3();
      expect(sem.getActiveCount()).toBe(0);
    });
  });

  // ============================================================================
  // 2. Storage Security & Path Traversal Prevention (AT41)
  // ============================================================================
  describe('Storage Security & Path Traversal Defense (AT41)', () => {
    it('accepts safe relative and canonical storage keys', () => {
      expect(validateStorageKey('2026/11/photo-uuid.jpg')).toBe(true);
      expect(validateStorageKey('2028/03/8f41e5b2-3023-41a9-b3a6-b5e1bfa49c31-preview.webp')).toBe(true);
      expect(validateStorageKey('/data/uploads/2026/11/doc.pdf')).toBe(true);
    });

    it('strictly rejects directory traversal, backslashes, null-bytes, and encoded traversals', () => {
      expect(validateStorageKey('../../../etc/passwd')).toBe(false);
      expect(validateStorageKey('..%2f..%2fshadow')).toBe(false);
      expect(validateStorageKey('..%5c..%5cboot.ini')).toBe(false);
      expect(validateStorageKey('folder\\file.jpg')).toBe(false);
      expect(validateStorageKey('folder/file\0.jpg')).toBe(false);
      expect(validateStorageKey('/etc/passwd')).toBe(false);
      expect(validateStorageKey('folder/subfolder/')).toBe(false);
      expect(validateStorageKey('')).toBe(false);
    });

    it('safeResolvePath prevents escaping outside the root upload directory', () => {
      const root = TEST_UPLOAD_DIR;
      const safePath = safeResolvePath(root, '2026/11/valid.jpg');
      expect(safePath.startsWith(path.resolve(root))).toBe(true);

      expect(() => safeResolvePath(root, '../../../etc/passwd')).toThrowError(SecurityPathError);
      expect(() => safeResolvePath(root, '2026/11/../..%2fshadow')).toThrowError(SecurityPathError);
      expect(() => safeResolvePath(root, 'valid\0evil.jpg')).toThrowError(SecurityPathError);
    });
  });

  // ============================================================================
  // 3. Magic Bytes Inspection & Instructive Rejections (AT39)
  // ============================================================================
  describe('Magic Bytes Inspection (AT39)', () => {
    it('detects JPEG, PNG, WebP, and PDF magic signatures correctly', async () => {
      // JPEG
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(inspectFileMagicBytes(jpegBuf)).toEqual({ kind: 'image', mimeType: 'image/jpeg', ext: '.jpg' });

      // PNG
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(inspectFileMagicBytes(pngBuf)).toEqual({ kind: 'image', mimeType: 'image/png', ext: '.png' });

      // WebP
      const webpBuf = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.alloc(4),
        Buffer.from('WEBP', 'ascii'),
      ]);
      expect(inspectFileMagicBytes(webpBuf)).toEqual({ kind: 'image', mimeType: 'image/webp', ext: '.webp' });

      // PDF
      const pdfBuf = Buffer.from('%PDF-1.7 header content');
      expect(inspectFileMagicBytes(pdfBuf)).toEqual({ kind: 'pdf', mimeType: 'application/pdf', ext: '.pdf' });
    });

    it('rejects iPhone HEIC/HEIF with specific, helpful conversion guidance', () => {
      // HEIC header: '....ftypheic'
      const heicBuf = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypheic', 'ascii'),
        Buffer.alloc(8),
      ]);

      expect(() => inspectFileMagicBytes(heicBuf)).toThrowError(
        /Định dạng ảnh HEIC\/HEIF từ iPhone chưa được hỗ trợ trực tiếp.*JPEG hoặc PNG/i
      );
    });

    it('rejects video formats with specific instructive error message', () => {
      // MP4 header: '....ftypisom'
      const mp4Buf = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypisom', 'ascii'),
        Buffer.alloc(8),
      ]);

      expect(() => inspectFileMagicBytes(mp4Buf)).toThrowError(
        /Hệ thống chỉ hỗ trợ lưu trữ ảnh và chứng từ tài liệu \(PDF\)\. Định dạng video không được hỗ trợ/i
      );
    });

    it('rejects SVG for security reasons', () => {
      const svgBuf = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(() => inspectFileMagicBytes(svgBuf)).toThrowError(/Định dạng SVG không được hỗ trợ/i);
    });

    it('rejects GIF and RAW camera files with instructive messages', () => {
      const gifBuf = Buffer.from('GIF89a...');
      expect(() => inspectFileMagicBytes(gifBuf)).toThrowError(/Định dạng GIF động không được hỗ trợ/i);

      // TIFF RAW header: II*\0
      const rawBuf = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x10, 0x20]);
      expect(() => inspectFileMagicBytes(rawBuf)).toThrowError(/Tệp ảnh gốc RAW dung lượng lớn chưa được hỗ trợ/i);
    });

    it('rejects corrupt or empty files', () => {
      expect(() => inspectFileMagicBytes(Buffer.from([0x00, 0x01]))).toThrowError(
        /Tệp rỗng hoặc dung lượng quá nhỏ/i
      );
    });
  });

  // ============================================================================
  // 4. AT39: Multi-file Upload with Partial Failure & Independent Processing
  // ============================================================================
  describe('AT39: Multi-file Upload with Partial Failure', () => {
    it('reports failure for invalid files while preserving valid files, leaving no ready record for failed files', async () => {
      // 1. Prepare File 1 (Valid JPEG)
      const validJpeg = await sharp({
        create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .jpeg()
        .toBuffer();

      const form1 = new FormData();
      form1.append('file', new File([validJpeg], 'photo1.jpg', { type: 'image/jpeg' }));
      form1.append('entity_type', 'wedding');

      const req1 = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form1,
        headers: { authorization: 'Bearer owner-token' },
      });
      const res1 = await uploadRoute.POST(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.processing_status).toBe('ready');

      // 2. Prepare File 2 (Unsupported HEIC file)
      const heicBuf = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic', 'ascii'), Buffer.alloc(8)]);
      const form2 = new FormData();
      form2.append('file', new File([heicBuf], 'iphone.heic', { type: 'image/heic' }));
      form2.append('entity_type', 'wedding');

      const req2 = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form2,
        headers: { authorization: 'Bearer owner-token' },
      });
      const res2 = await uploadRoute.POST(req2);
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toBe('UNSUPPORTED_HEIC_FORMAT');

      // 3. Prepare File 3 (Valid PNG)
      const validPng = await sharp({
        create: { width: 200, height: 200, channels: 4, background: { r: 50, g: 60, b: 70, alpha: 1 } },
      })
        .png()
        .toBuffer();

      const form3 = new FormData();
      form3.append('file', new File([validPng], 'logo.png', { type: 'image/png' }));
      form3.append('entity_type', 'wedding');

      const req3 = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form3,
        headers: { authorization: 'Bearer owner-token' },
      });
      const res3 = await uploadRoute.POST(req3);
      expect(res3.status).toBe(201);
      const data3 = await res3.json();
      expect(data3.processing_status).toBe('ready');

      // Verify DB State: No ready record for failed file
      const readyAttachments = Array.from(mockDb.attachments.values()).filter(
        (a) => a.processingStatus === 'ready'
      );
      expect(readyAttachments).toHaveLength(2);
      expect(readyAttachments.map((a) => a.id)).toContain(data1.id);
      expect(readyAttachments.map((a) => a.id)).toContain(data3.id);
    });
  });

  // ============================================================================
  // 5. AT41: Role-Based File Streaming Isolation & URL Guessing Prevention
  // ============================================================================
  describe('AT41: Role-Based File Access & URL Guessing Defense', () => {
    it('blocks Family users from uploading files (HTTP 403)', async () => {
      const validJpeg = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .jpeg()
        .toBuffer();

      const form = new FormData();
      form.append('file', new File([validJpeg], 'test.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer family-token' },
      });
      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('strictly forbids Family users from accessing financial attachments (cost_item)', async () => {
      const pdfBuf = Buffer.from('%PDF-1.7 banquet invoice');
      const form = new FormData();
      form.append('file', new File([pdfBuf], 'invoice.pdf', { type: 'application/pdf' }));
      form.append('entity_type', 'cost_item');

      // Owner uploads invoice
      const uploadReq = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });
      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(201);
      const { id } = await uploadRes.json();

      // Family user tries to download invoice
      const familyReq = new NextRequest(`http://localhost:3000/api/files/${id}`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const familyRes = await fileRoute.GET(familyReq, { params: { id } });
      expect(familyRes.status).toBe(403);
      const err = await familyRes.json();
      expect(err.error).toBe('FORBIDDEN');

      // Owner downloads invoice successfully
      const ownerReq = new NextRequest(`http://localhost:3000/api/files/${id}`, {
        method: 'GET',
        headers: { authorization: 'Bearer owner-token' },
      });
      const ownerRes = await fileRoute.GET(ownerReq, { params: { id } });
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.headers.get('content-type')).toBe('application/pdf');
    });

    it('blocks Family users from downloading raw original photos with EXIF, but grants WebP rendition access', async () => {
      // Create photo with EXIF orientation
      const photoBuf = await sharp({
        create: { width: 500, height: 400, channels: 3, background: { r: 200, g: 100, b: 50 } },
      })
        .withMetadata({ orientation: 1 })
        .jpeg()
        .toBuffer();

      const form = new FormData();
      form.append('file', new File([photoBuf], 'album_photo.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');
      form.append('owner_only', 'false');
      form.append('is_private', 'false');

      const uploadReq = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });
      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(201);
      const { id } = await uploadRes.json();

      // 1. Family requests raw original photo -> HTTP 403 Forbidden
      const rawReq = new NextRequest(`http://localhost:3000/api/files/${id}`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const rawRes = await fileRoute.GET(rawReq, { params: { id } });
      expect(rawRes.status).toBe(403);
      const rawErr = await rawRes.json();
      expect(rawErr.message).toContain('biến thể hiển thị đã loại bỏ siêu dữ liệu');

      // 2. Family requests thumbnail rendition -> HTTP 200 OK (WebP, clean headers)
      const thumbReq = new NextRequest(`http://localhost:3000/api/files/${id}?variant=thumbnail`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const thumbRes = await fileRoute.GET(thumbReq, { params: { id } });
      expect(thumbRes.status).toBe(200);
      expect(thumbRes.headers.get('content-type')).toBe('image/webp');
      expect(thumbRes.headers.get('cache-control')).toContain('private, no-cache');
      expect(thumbRes.headers.get('x-content-type-options')).toBe('nosniff');

      // 3. Family requests preview rendition -> HTTP 200 OK (WebP)
      const previewReq = new NextRequest(`http://localhost:3000/api/files/${id}?variant=preview`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const previewRes = await fileRoute.GET(previewReq, { params: { id } });
      expect(previewRes.status).toBe(200);
      expect(previewRes.headers.get('content-type')).toBe('image/webp');
    });

    it('rejects invalid UUIDs and non-existent files with HTTP 400 and 404', async () => {
      // Invalid UUID
      const invalidReq = new NextRequest('http://localhost:3000/api/files/not-a-valid-uuid', {
        method: 'GET',
        headers: { authorization: 'Bearer owner-token' },
      });
      const invalidRes = await fileRoute.GET(invalidReq, { params: { id: 'not-a-valid-uuid' } });
      expect(invalidRes.status).toBe(400);

      // Non-existent UUID
      const randomUuid = crypto.randomUUID();
      const notFoundReq = new NextRequest(`http://localhost:3000/api/files/${randomUuid}`, {
        method: 'GET',
        headers: { authorization: 'Bearer owner-token' },
      });
      const notFoundRes = await fileRoute.GET(notFoundReq, { params: { id: randomUuid } });
      expect(notFoundRes.status).toBe(404);
    });

    it('rejects spoofed x-user-role header without valid session (HTTP 401 Unauthorized)', async () => {
      const validJpeg = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .jpeg()
        .toBuffer();

      const form = new FormData();
      form.append('file', new File([validJpeg], 'spoof.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');

      // Attempt upload with x-user-role: owner header but no session
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { 'x-user-id': ownerUserId, 'x-user-role': 'owner' },
      });
      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');

      // Attempt file read with x-user-role: owner header but no session
      const getReq = new NextRequest(`http://localhost:3000/api/files/${crypto.randomUUID()}`, {
        method: 'GET',
        headers: { 'x-user-id': ownerUserId, 'x-user-role': 'owner' },
      });
      const getRes = await fileRoute.GET(getReq, { params: { id: crypto.randomUUID() } });
      expect(getRes.status).toBe(401);
      const getData = await getRes.json();
      expect(getData.error).toBe('UNAUTHORIZED');
    });
  });

  // ============================================================================
  // 6. AT42: Compensation on Failure & Janitor Cleanup
  // ============================================================================
  describe('AT42: Compensation on Failure & Janitor Cleanup', () => {
    it('cleans up written files on disk and marks DB record failed when processing fails', async () => {
      // Create a file with valid JPEG header (FF D8 FF) followed by invalid corrupted body that fails Sharp decoding
      const corruptJpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x00, 0x00,
      ]);

      const form = new FormData();
      form.append('file', new File([corruptJpeg], 'corrupt.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });
      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('IMAGE_DECODE_FAILED');

      // Verify compensation: 1 failed DB record, 0 ready records
      const failedRecords = Array.from(mockDb.attachments.values()).filter(
        (a) => a.processingStatus === 'failed'
      );
      expect(failedRecords).toHaveLength(1);

      // Verify that no orphaned files exist on disk
      const failedRecord = failedRecords[0];
      const rootDir = getUploadRootDir();
      const diskPath = safeResolvePath(rootDir, failedRecord.storageKey);
      expect(fs.existsSync(diskPath)).toBe(false);
    });

    it('runStorageJanitorCleanup cleans up expired pending leases (> 24h) and unlinks files', async () => {
      const staleId = crypto.randomUUID();
      const storageKey = `2026/11/${staleId}.jpg`;
      const rootDir = getUploadRootDir();
      const filePath = safeResolvePath(rootDir, storageKey);

      // Write an orphaned file to disk
      await writeAtomicFile(filePath, Buffer.from('stale upload data'));
      expect(fs.existsSync(filePath)).toBe(true);

      // Create a stale pending record whose lease expired 25 hours ago
      const expiredLease = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockDb.attachments.set(staleId, {
        id: staleId,
        storageKey,
        originalName: 'stale.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 17n,
        width: null,
        height: null,
        checksumSha256: 'deadbeef',
        isPrivate: true,
        ownerOnly: true,
        entityType: 'wedding',
        entityId: null,
        processingStatus: 'pending',
        errorMessage: null,
        uploaderUserId: ownerUserId,
        leaseExpiresAt: expiredLease,
        isArchived: false,
        archivedAt: null,
        createdAt: expiredLease,
        updatedAt: expiredLease,
      });

      // Run janitor cleanup
      const result = await runStorageJanitorCleanup();
      expect(result.reclaimedPending).toBe(1);

      // Verify orphaned file was deleted from disk
      expect(fs.existsSync(filePath)).toBe(false);

      // Verify status was changed to failed
      const updated = mockDb.attachments.get(staleId);
      expect(updated?.processingStatus).toBe('failed');
      expect(updated?.errorMessage).toContain('Janitor');
    });
  });

  // ============================================================================
  // 7. AT44: Upload Size Limits Aligned with Reverse Proxy
  // ============================================================================
  describe('AT44: Upload Limits Boundary Testing', () => {
    it('rejects requests with Content-Length exceeding 21 MiB early (HTTP 413)', async () => {
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'content-length': (22 * 1024 * 1024).toString(), // 22 MiB
          authorization: 'Bearer owner-token',
        },
      });
      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects image files exceeding 20 MiB with HTTP 413', async () => {
      // 20 MiB + 1 byte
      const oversizedImage = Buffer.alloc(20 * 1024 * 1024 + 1);
      // Valid JPEG header
      oversizedImage[0] = 0xff;
      oversizedImage[1] = 0xd8;
      oversizedImage[2] = 0xff;

      const form = new FormData();
      form.append('file', new File([oversizedImage], 'huge.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });
      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects PDF files exceeding 10 MiB with HTTP 413', async () => {
      // 10 MiB + 1 byte
      const oversizedPdf = Buffer.alloc(10 * 1024 * 1024 + 1);
      Buffer.from('%PDF-1.7').copy(oversizedPdf, 0);

      const form = new FormData();
      form.append('file', new File([oversizedPdf], 'huge.pdf', { type: 'application/pdf' }));
      form.append('entity_type', 'wedding');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });
      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});
