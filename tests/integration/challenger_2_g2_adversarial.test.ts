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
import {
  createFamilyInvite,
  redeemFamilyInvite,
  revokeFamilyInvite,
  InviteError,
} from '@/lib/auth/invites';
import * as sessionModule from '@/lib/auth/session';

// ==============================================================================
// Unified Adversarial Test Harness Database Simulator
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

interface MockInvite {
  id: string;
  email: string;
  tokenHash: string;
  role: 'owner' | 'family_view';
  allowedEventIds: string[];
  expiresAt: Date;
  invitedByUserId: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: Date;
}

interface MockEventAccess {
  id: string;
  userId: string;
  eventId: string;
  createdAt: Date;
}

class AdversarialMockDatabase {
  public attachments = new Map<string, MockAttachment>();
  public variants = new Map<string, MockVariant>();
  public memberInvites = new Map<string, MockInvite>();
  public memberEventAccess: MockEventAccess[] = [];
  public users = new Map<string, any>();
  public auditLogs: any[] = [];

  // Hook to simulate transient database failure during specific operations
  public failNextVariantInsert: boolean = false;
  public failNextInviteUpdate: boolean = false;

  clear() {
    this.attachments.clear();
    this.variants.clear();
    this.memberInvites.clear();
    this.memberEventAccess = [];
    this.users.clear();
    this.auditLogs = [];
    this.failNextVariantInsert = false;
    this.failNextInviteUpdate = false;
  }

  handleQuery(queryObj: any, params: any[] = []): { rows: any[]; rowCount: number } {
    const text: string = typeof queryObj === 'string' ? queryObj : queryObj?.text || '';
    const isArrayMode = queryObj?.rowMode === 'array';
    const trimmed = text.trim();

    // Transaction controls
    if (/^(BEGIN|COMMIT|ROLLBACK);?$/i.test(trimmed)) {
      return { rows: [], rowCount: 0 };
    }

    // -------------------------------------------------------------
    // ATTACHMENTS
    // -------------------------------------------------------------
    if (/select .* from "attachments"/i.test(trimmed)) {
      let matched: MockAttachment[] = [];
      if (/where .*"attachments"\."id" = \$1/i.test(trimmed)) {
        const id = params[0];
        const item = this.attachments.get(id);
        if (item) matched.push(item);
      } else if (/where .*processing_status.*=.*\$1.*lease_expires_at.*<.*\$2/i.test(trimmed)) {
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

      const id = rowData.id || params[0];
      const newAtt: MockAttachment = {
        id,
        storageKey: rowData.storage_key || params[1],
        originalName: rowData.original_name || params[2],
        mimeType: rowData.mime_type || params[3],
        fileSizeBytes: BigInt(rowData.file_size_bytes || params[4] || 0),
        width: rowData.width !== undefined ? rowData.width : null,
        height: rowData.height !== undefined ? rowData.height : null,
        checksumSha256: rowData.checksum_sha256 || params[5] || '',
        isPrivate: rowData.is_private !== undefined ? Boolean(rowData.is_private) : true,
        ownerOnly: rowData.owner_only !== undefined ? Boolean(rowData.owner_only) : true,
        entityType: rowData.entity_type || 'wedding',
        entityId: rowData.entity_id || null,
        processingStatus: rowData.processing_status || 'pending',
        errorMessage: null,
        uploaderUserId: rowData.uploader_user_id || '00000000-0000-4000-8000-000000000001',
        leaseExpiresAt: rowData.lease_expires_at ? new Date(rowData.lease_expires_at) : null,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.attachments.set(id, newAtt);
      return { rows: [newAtt], rowCount: 1 };
    }

    if (/update "attachments"/i.test(trimmed)) {
      const id = params[params.length - 1];
      const existing = this.attachments.get(id);
      if (existing) {
        if (/set .*"processing_status" = \$1/i.test(trimmed)) {
          existing.processingStatus = params[0];
          existing.errorMessage = params[1] || null;
          existing.leaseExpiresAt = null;
        } else if (/set .*"width" = \$1.*"height" = \$2.*"processing_status" = \$3/i.test(trimmed)) {
          existing.width = params[0];
          existing.height = params[1];
          existing.processingStatus = params[2];
          existing.leaseExpiresAt = null;
        }
        existing.updatedAt = new Date();
      }
      return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 };
    }

    // -------------------------------------------------------------
    // ATTACHMENT VARIANTS
    // -------------------------------------------------------------
    if (/select .* from "attachment_variants"/i.test(trimmed)) {
      let matched: MockVariant[] = [];
      if (/where .*"attachment_variants"\."attachment_id" = \$1 and "attachment_variants"\."variant_type" = \$2/i.test(trimmed)) {
        const attId = params[0];
        const vType = params[1];
        for (const v of this.variants.values()) {
          if (v.attachmentId === attId && v.variantType === vType) {
            matched.push(v);
          }
        }
      } else {
        matched = Array.from(this.variants.values());
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

    if (/insert into "attachment_variants"/i.test(trimmed)) {
      if (this.failNextVariantInsert) {
        this.failNextVariantInsert = false;
        throw new Error('SIMULATED_DB_DISASTER_DURING_VARIANT_INSERT');
      }

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

    // -------------------------------------------------------------
    // MEMBER INVITES
    // -------------------------------------------------------------
    if (/select .* from "member_invites"/i.test(trimmed)) {
      let matched: MockInvite[] = [];
      if (/where .*"member_invites"\."token_hash" = \$1/i.test(trimmed)) {
        const hash = params[0];
        for (const inv of this.memberInvites.values()) {
          if (inv.tokenHash === hash) matched.push(inv);
        }
      } else if (/where .*"member_invites"\."id" = \$1/i.test(trimmed)) {
        const id = params[0];
        const item = this.memberInvites.get(id);
        if (item) matched.push(item);
      }

      if (isArrayMode) {
        const rows = matched.map((i) => [
          i.id,
          i.email,
          i.tokenHash,
          i.role,
          i.allowedEventIds,
          i.expiresAt,
          i.invitedByUserId,
          i.status,
          i.createdAt,
        ]);
        return { rows, rowCount: rows.length };
      }
      return { rows: matched, rowCount: matched.length };
    }

    if (/insert into "member_invites"/i.test(trimmed)) {
      const id = params[0];
      const newInv: MockInvite = {
        id,
        email: params[1],
        tokenHash: params[2],
        role: params[3] || 'family_view',
        allowedEventIds: params[4] || [],
        expiresAt: new Date(params[5]),
        invitedByUserId: params[6],
        status: params[7] || 'pending',
        createdAt: new Date(),
      };
      this.memberInvites.set(id, newInv);
      return { rows: [newInv], rowCount: 1 };
    }

    if (/update member_invites\s+set status = 'accepted'\s+where id = \$1 and status = 'pending'/i.test(trimmed)) {
      const id = params[0];
      const inv = this.memberInvites.get(id);
      if (inv && inv.status === 'pending') {
        inv.status = 'accepted';
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/update "member_invites"\s+set "status" = \$1\s+where "member_invites"\."id" = \$2/i.test(trimmed)) {
      const status = params[0];
      const id = params[1];
      const inv = this.memberInvites.get(id);
      if (inv) {
        inv.status = status;
        return { rows: [inv], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // -------------------------------------------------------------
    // USERS, EVENT ACCESS & AUDIT LOGS
    // -------------------------------------------------------------
    if (/update users\s+set role =/i.test(trimmed)) {
      const userId = params[0];
      const user = this.users.get(userId);
      if (user && user.role !== 'owner') {
        user.role = 'family_view';
      }
      return { rows: [], rowCount: 1 };
    }

    if (/insert into member_event_access/i.test(trimmed)) {
      const userId = params[0];
      const eventId = params[1];
      const exists = this.memberEventAccess.some((a) => a.userId === userId && a.eventId === eventId);
      if (!exists) {
        this.memberEventAccess.push({
          id: crypto.randomUUID(),
          userId,
          eventId,
          createdAt: new Date(),
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (/insert into audit_logs/i.test(trimmed)) {
      this.auditLogs.push({ query: trimmed, params });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

const mockDb = new AdversarialMockDatabase();
const TEST_ADVERSARIAL_DIR = path.resolve(process.cwd(), '.uploads_adversarial_test');

describe('Empirical Adversarial Challenge Suite (Storage, Sharp, Path Traversal, Replay)', () => {
  const ownerUserId = '00000000-0000-4000-8000-000000000001';
  const familyUserId = '00000000-0000-4000-8000-000000000002';
  const testEventId = '11111111-1111-4111-8111-111111111111';

  beforeAll(() => {
    process.env.UPLOAD_DIR = TEST_ADVERSARIAL_DIR;
    ensureUploadDirExists(TEST_ADVERSARIAL_DIR);
  });

  afterAll(async () => {
    if (fs.existsSync(TEST_ADVERSARIAL_DIR)) {
      await fs.promises.rm(TEST_ADVERSARIAL_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    mockDb.clear();

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
          allowedEventIds: [testEventId],
        };
      }
      return null;
    });
  });

  // ============================================================================
  // 1. Decompression Bomb & Boundary Pixel Limits (AT39, AT44)
  // ============================================================================
  describe('Adversarial 1: Decompression Bomb & Pixel Boundary Limits', () => {
    it('rejects an image exceeding 40MP (6400x6400 = 40.96MP) before rasterization', async () => {
      const bombBuffer = await sharp({
        create: {
          width: 6400,
          height: 6400,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .jpeg({ quality: 20 })
        .toBuffer();

      await expect(
        processImageWithSharp(bombBuffer, '2026/11', 'adversarial-bomb-40.96mp')
      ).rejects.toThrowError(/vượt quá giới hạn tối đa 40 megapixel cho phép/i);
    });

    it('rejects an extreme aspect ratio bomb (32,000 x 1,500 px = 48MP)', async () => {
      // Create a wide SVG with 32000x1500 dimensions (48MP > 40MP limit, <= 32767 libvips limit)
      const wideSvg = Buffer.from(
        `<svg width="32000" height="1500" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="red"/></svg>`
      );
      // Rasterize to PNG buffer
      const widePng = await sharp(wideSvg).png().toBuffer();

      await expect(
        processImageWithSharp(widePng, '2026/11', 'adversarial-extreme-aspect')
      ).rejects.toThrowError(/vượt quá giới hạn tối đa 40 megapixel cho phép/i);
    });

    it('accepts an image exactly within the 40MP limit (8000x5000 = 40,000,000 px)', async () => {
      expect(8000 * 5000).toBe(MAX_ALLOWED_PIXELS);

      // Create an image with exactly 40,000,000 pixels
      const exact40Mp = await sharp({
        create: {
          width: 8000,
          height: 5000,
          channels: 3,
          background: { r: 50, g: 50, b: 50 },
        },
      })
        .jpeg({ quality: 10 })
        .toBuffer();

      const result = await processImageWithSharp(exact40Mp, '2026/11', 'exact-40mp-limit');
      expect(result.originalWidth).toBe(8000);
      expect(result.originalHeight).toBe(5000);
      expect(result.renditions).toHaveLength(2);

      const preview = result.renditions.find((r) => r.variantType === 'preview_1600')!;
      expect(preview.width).toBe(1600);
      expect(preview.height).toBe(1000); // 5000 * (1600/8000) = 1000
    });

    it('strips all EXIF/GPS metadata so camera location is never leaked to renditions', async () => {
      // Synthesize image with orientation and camera metadata
      const imageWithMeta = await sharp({
        create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .withMetadata({
          orientation: 3,
          exif: {
            IFD0: {
              Make: 'SecretCameraBrand',
              Model: 'SurveillanceDroneX',
            },
          },
        })
        .jpeg()
        .toBuffer();

      const result = await processImageWithSharp(imageWithMeta, '2026/11', 'gps-strip-test');
      for (const rendition of result.renditions) {
        const meta = await sharp(rendition.buffer).metadata();
        expect(meta.format).toBe('webp');
        expect(meta.exif).toBeUndefined();
        expect(meta.orientation).toBeUndefined();
      }
    });

    it('handles concurrency: 5 simultaneous image processing calls strictly obey max 2 slots', async () => {
      let maxActiveObserved = 0;
      const tasks = Array.from({ length: 5 }, async (_, i) => {
        const slot = await globalSharpLimiter.acquire();
        const active = globalSharpLimiter.getActiveCount();
        if (active > maxActiveObserved) {
          maxActiveObserved = active;
        }
        expect(active).toBeLessThanOrEqual(2);
        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 20));
        slot();
      });

      await Promise.all(tasks);
      expect(maxActiveObserved).toBe(2);
      expect(globalSharpLimiter.getActiveCount()).toBe(0);
    });
  });

  // ============================================================================
  // 2. Unsupported Formats & Instructive Error Messages (AT39)
  // ============================================================================
  describe('Adversarial 2: Non-permitted File Formats Rejection (AT39)', () => {
    it('rejects iPhone HEIC and HEIF variants with clear conversion guidance', () => {
      const brands = ['heic', 'mif1', 'msf1', 'heix', 'hevc'];
      for (const brand of brands) {
        const heicBuffer = Buffer.concat([
          Buffer.alloc(4),
          Buffer.from(`ftyp${brand}`, 'ascii'),
          Buffer.alloc(8),
        ]);
        expect(() => inspectFileMagicBytes(heicBuffer)).toThrowError(
          /Định dạng ảnh HEIC\/HEIF từ iPhone chưa được hỗ trợ trực tiếp.*JPEG hoặc PNG/i
        );
      }
    });

    it('rejects MP4, QuickTime, and WebM video formats with explicit message', () => {
      // MP4
      const mp4Buf = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom', 'ascii'), Buffer.alloc(8)]);
      expect(() => inspectFileMagicBytes(mp4Buf)).toThrowError(
        /Hệ thống chỉ hỗ trợ lưu trữ ảnh và chứng từ tài liệu \(PDF\)\. Định dạng video không được hỗ trợ/i
      );

      // WebM / MKV
      const webmBuf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]);
      expect(() => inspectFileMagicBytes(webmBuf)).toThrowError(
        /Hệ thống chỉ hỗ trợ lưu trữ ảnh và chứng từ tài liệu \(PDF\)\. Định dạng video không được hỗ trợ/i
      );
    });

    it('rejects SVG files whether starting with <?xml or <svg directly', () => {
      const svgWithXml = Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 100 100"></svg>');
      expect(() => inspectFileMagicBytes(svgWithXml)).toThrowError(/Định dạng SVG không được hỗ trợ/i);

      const rawSvg = Buffer.from('<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>');
      expect(() => inspectFileMagicBytes(rawSvg)).toThrowError(/Định dạng SVG không được hỗ trợ/i);
    });

    it('rejects GIF87a and GIF89a animation formats', () => {
      const gif87 = Buffer.from('GIF87a123');
      expect(() => inspectFileMagicBytes(gif87)).toThrowError(/Định dạng GIF động không được hỗ trợ/i);

      const gif89 = Buffer.from('GIF89a123');
      expect(() => inspectFileMagicBytes(gif89)).toThrowError(/Định dạng GIF động không được hỗ trợ/i);
    });

    it('rejects RAW camera files (Canon CR2, Nikon NEF, Sony ARW)', () => {
      // Little-endian TIFF (II*\0)
      const leRaw = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x10, 0x20]);
      expect(() => inspectFileMagicBytes(leRaw)).toThrowError(/Tệp ảnh gốc RAW dung lượng lớn chưa được hỗ trợ/i);

      // Big-endian TIFF (MM\0*)
      const beRaw = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x10, 0x20]);
      expect(() => inspectFileMagicBytes(beRaw)).toThrowError(/Tệp ảnh gốc RAW dung lượng lớn chưa được hỗ trợ/i);
    });

    it('rejects malicious executables (Windows PE MZ, Linux ELF)', () => {
      const peExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]); // MZ
      expect(() => inspectFileMagicBytes(peExe)).toThrowError(/Định dạng tệp không hợp lệ hoặc không được hỗ trợ/i);

      const elfBin = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02]); // \x7fELF
      expect(() => inspectFileMagicBytes(elfBin)).toThrowError(/Định dạng tệp không hợp lệ hoặc không được hỗ trợ/i);
    });
  });

  // ============================================================================
  // 3. Request & File Size Limits (AT44)
  // ============================================================================
  describe('Adversarial 3: Request & File Size Limits (AT44)', () => {
    it('rejects Content-Length exceeding 21 MiB with HTTP 413 before parsing body', async () => {
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'content-length': (21 * 1024 * 1024 + 1).toString(),
          authorization: 'Bearer owner-token',
        },
      });

      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects image exceeding 20 MiB with HTTP 413', async () => {
      const oversizedImage = Buffer.alloc(20 * 1024 * 1024 + 1);
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
      expect(data.message).toContain('20 MiB');
    });

    it('rejects PDF exceeding 10 MiB with HTTP 413', async () => {
      const oversizedPdf = Buffer.alloc(10 * 1024 * 1024 + 1);
      Buffer.from('%PDF-1.7').copy(oversizedPdf, 0);

      const form = new FormData();
      form.append('file', new File([oversizedPdf], 'huge.pdf', { type: 'application/pdf' }));
      form.append('entity_type', 'cost_item');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });

      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
      expect(data.message).toContain('10 MiB');
    });
  });

  // ============================================================================
  // 4. Path Traversal & Role-Based Information Disclosure (AT41)
  // ============================================================================
  describe('Adversarial 4: Path Traversal Defenses & Access Control (AT41)', () => {
    it('rejects complex directory traversal payloads in storage keys', () => {
      const maliciousKeys = [
        '../../../../etc/passwd',
        '..%2f..%2fdata/secret',
        '..%5c..%5cwindows/system32/cmd.exe',
        'sub/../../config.env',
        'safe/path/with\0nullbyte.jpg',
        'backslash\\path\\file.jpg',
        '/etc/shadow',
        '/var/log/syslog',
        '/data/uploads/../../../etc/passwd',
        'trailing/slash/',
        'http://evil.com/payload.jpg',
        '../.git/config',
        '..\\..\\ntds.dit',
      ];

      for (const key of maliciousKeys) {
        expect(validateStorageKey(key)).toBe(false);
        expect(() => safeResolvePath(TEST_ADVERSARIAL_DIR, key)).toThrowError(SecurityPathError);
      }
    });

    it('blocks Family view from accessing cost_item invoice even if they supply variant=thumbnail or preview', async () => {
      // 1. Owner uploads cost_item PDF invoice
      const invoiceBuf = Buffer.from('%PDF-1.7 Secret Vendor Contract 500,000,000 VND');
      const form = new FormData();
      form.append('file', new File([invoiceBuf], 'contract.pdf', { type: 'application/pdf' }));
      form.append('entity_type', 'cost_item');

      const uploadReq = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(201);
      const { id } = await uploadRes.json();

      // 2. Family attempts raw access
      const reqRaw = new NextRequest(`http://localhost:3000/api/files/${id}`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const resRaw = await fileRoute.GET(reqRaw, { params: { id } });
      expect(resRaw.status).toBe(403);

      // 3. Family attempts thumbnail variant access
      const reqThumb = new NextRequest(`http://localhost:3000/api/files/${id}?variant=thumbnail`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const resThumb = await fileRoute.GET(reqThumb, { params: { id } });
      expect(resThumb.status).toBe(403);

      // 4. Family attempts preview variant access
      const reqPrev = new NextRequest(`http://localhost:3000/api/files/${id}?variant=preview`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const resPrev = await fileRoute.GET(reqPrev, { params: { id } });
      expect(resPrev.status).toBe(403);
    });

    it('blocks Family view from downloading raw camera photos with EXIF, but serves clean WebP renditions', async () => {
      // Owner uploads photo with owner_only: false
      const photoBuf = await sharp({
        create: { width: 800, height: 600, channels: 3, background: { r: 50, g: 100, b: 150 } },
      })
        .jpeg()
        .toBuffer();

      const form = new FormData();
      form.append('file', new File([photoBuf], 'album_ceremony.jpg', { type: 'image/jpeg' }));
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

      // 1. Family requests raw photo -> 403 Forbidden
      const rawReq = new NextRequest(`http://localhost:3000/api/files/${id}`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const rawRes = await fileRoute.GET(rawReq, { params: { id } });
      expect(rawRes.status).toBe(403);

      // 2. Family requests preview -> 200 OK (WebP, security headers)
      const prevReq = new NextRequest(`http://localhost:3000/api/files/${id}?variant=preview`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const prevRes = await fileRoute.GET(prevReq, { params: { id } });
      expect(prevRes.status).toBe(200);
      expect(prevRes.headers.get('content-type')).toBe('image/webp');
      expect(prevRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(prevRes.headers.get('cache-control')).toContain('private, no-cache');

      // 3. Family requests thumbnail -> 200 OK (WebP)
      const thumbReq = new NextRequest(`http://localhost:3000/api/files/${id}?variant=thumbnail`, {
        method: 'GET',
        headers: { authorization: 'Bearer family-token' },
      });
      const thumbRes = await fileRoute.GET(thumbReq, { params: { id } });
      expect(thumbRes.status).toBe(200);
      expect(thumbRes.headers.get('content-type')).toBe('image/webp');
    });

    it('blocks file download if attachment is marked failed or pending', async () => {
      const attId = crypto.randomUUID();
      mockDb.attachments.set(attId, {
        id: attId,
        storageKey: `2026/11/${attId}.jpg`,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 100n,
        width: 100,
        height: 100,
        checksumSha256: 'abc',
        isPrivate: false,
        ownerOnly: false,
        entityType: 'wedding',
        entityId: null,
        processingStatus: 'failed',
        errorMessage: 'Decode failure',
        uploaderUserId: ownerUserId,
        leaseExpiresAt: null,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(`http://localhost:3000/api/files/${attId}`, {
        method: 'GET',
        headers: { authorization: 'Bearer owner-token' },
      });
      const res = await fileRoute.GET(req, { params: { id: attId } });
      expect(res.status).toBe(410);
      const data = await res.json();
      expect(data.error).toBe('FILE_FAILED');
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
  // 5. Upload Failure Compensation & Unlinking (AT42)
  // ============================================================================
  describe('Adversarial 5: Upload Failure Compensation & Disk Cleanup (AT42)', () => {
    it('unlinks all partial files from disk and marks DB failed when database commit fails', async () => {
      // Trigger simulation: DB fails during variant insertion
      mockDb.failNextVariantInsert = true;

      const validJpeg = await sharp({
        create: { width: 300, height: 300, channels: 3, background: { r: 120, g: 130, b: 140 } },
      })
        .jpeg()
        .toBuffer();

      const form = new FormData();
      form.append('file', new File([validJpeg], 'test_commit_failure.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });

      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(500);

      // Verify that the record in DB was rolled over to 'failed'
      const failedRecords = Array.from(mockDb.attachments.values()).filter(
        (a) => a.processingStatus === 'failed'
      );
      expect(failedRecords).toHaveLength(1);
      const failedAtt = failedRecords[0];
      expect(failedAtt.errorMessage).toContain('attachment_variants');

      // Verify zero files left on disk for this attachment (original and renditions must be unlinked)
      const originalDiskPath = safeResolvePath(TEST_ADVERSARIAL_DIR, failedAtt.storageKey);
      expect(fs.existsSync(originalDiskPath)).toBe(false);

      const previewKey = failedAtt.storageKey.replace(/\.jpg$/, '-preview.webp');
      const thumbKey = failedAtt.storageKey.replace(/\.jpg$/, '-thumb.webp');
      expect(fs.existsSync(safeResolvePath(TEST_ADVERSARIAL_DIR, previewKey))).toBe(false);
      expect(fs.existsSync(safeResolvePath(TEST_ADVERSARIAL_DIR, thumbKey))).toBe(false);
    });

    it('unlinks original file when Sharp decoding crashes on malformed payload', async () => {
      // JPEG magic header + random corrupted noise
      const corruptPayload = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
        crypto.randomBytes(64),
      ]);

      const form = new FormData();
      form.append('file', new File([corruptPayload], 'corrupt.jpg', { type: 'image/jpeg' }));
      form.append('entity_type', 'wedding');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: form,
        headers: { authorization: 'Bearer owner-token' },
      });

      const res = await uploadRoute.POST(req);
      expect(res.status).toBe(400);

      const failedAtt = Array.from(mockDb.attachments.values()).find(
        (a) => a.processingStatus === 'failed'
      );
      expect(failedAtt).toBeDefined();

      const diskPath = safeResolvePath(TEST_ADVERSARIAL_DIR, failedAtt!.storageKey);
      expect(fs.existsSync(diskPath)).toBe(false);
    });

    it('janitor clean-up unlinks abandoned files whose lease expired > 24 hours ago', async () => {
      const abandonedId = crypto.randomUUID();
      const storageKey = `2026/11/${abandonedId}.jpg`;
      const diskPath = safeResolvePath(TEST_ADVERSARIAL_DIR, storageKey);

      await writeAtomicFile(diskPath, Buffer.from('orphaned content on disk'));
      expect(fs.existsSync(diskPath)).toBe(true);

      const staleTime = new Date(Date.now() - 26 * 60 * 60 * 1000);
      mockDb.attachments.set(abandonedId, {
        id: abandonedId,
        storageKey,
        originalName: 'abandoned.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 24n,
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
        leaseExpiresAt: staleTime,
        isArchived: false,
        archivedAt: null,
        createdAt: staleTime,
        updatedAt: staleTime,
      });

      const cleanResult = await runStorageJanitorCleanup();
      expect(cleanResult.reclaimedPending).toBe(1);

      // File removed from disk
      expect(fs.existsSync(diskPath)).toBe(false);

      // Status marked failed
      const att = mockDb.attachments.get(abandonedId);
      expect(att?.processingStatus).toBe('failed');
      expect(att?.errorMessage).toContain('Janitor');
    });
  });

  // ============================================================================
  // 6. Family Invite Security & Replay Attacks (AT50)
  // ============================================================================
  describe('Adversarial 6: Invite Security, Hash at Rest & Replay Defense (AT50)', () => {
    it('never stores raw invite token in plaintext; stores only 256-bit SHA-256 hash', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'member@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      expect(inviteResult.rawToken).toHaveLength(64);

      const stored = mockDb.memberInvites.get(inviteResult.inviteId);
      expect(stored).toBeDefined();

      // Invariant: Plaintext token must NEVER equal tokenHash
      expect(stored?.tokenHash).not.toBe(inviteResult.rawToken);

      // Invariant: Stored hash must strictly match SHA-256
      const expectedSha256 = crypto
        .createHash('sha256')
        .update(inviteResult.rawToken)
        .digest('hex');
      expect(stored?.tokenHash).toBe(expectedSha256);
      expect(stored?.tokenHash).toHaveLength(64);
    });

    it('strictly rejects redemption when authenticated with a mismatched Google email', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'legitimate.relative@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      const impostor = {
        id: crypto.randomUUID(),
        email: 'attacker@wedding.local',
      };

      await expect(
        redeemFamilyInvite(inviteResult.rawToken, impostor)
      ).rejects.toThrowError(/EMAIL_MISMATCH/);

      // Invite must remain in pending state
      const stored = mockDb.memberInvites.get(inviteResult.inviteId);
      expect(stored?.status).toBe('pending');
      expect(mockDb.memberEventAccess).toHaveLength(0);
    });

    it('normalizes email case and whitespace when checking email match', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'Family.VIP@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      const user = {
        id: crypto.randomUUID(),
        email: '  family.vip@wedding.local  ',
      };

      mockDb.users.set(user.id, {
        id: user.id,
        email: 'family.vip@wedding.local',
        role: 'family_view',
      });

      const res = await redeemFamilyInvite(inviteResult.rawToken, user);
      expect(res.success).toBe(true);
      expect(res.role).toBe('family_view');
    });

    it('strictly rejects redemption of an already redeemed token (Single-use replay protection)', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'single.use@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      const validUser = {
        id: crypto.randomUUID(),
        email: 'single.use@wedding.local',
      };
      mockDb.users.set(validUser.id, { id: validUser.id, email: validUser.email, role: 'family_view' });

      // First redemption -> Succeeds
      const firstRes = await redeemFamilyInvite(inviteResult.rawToken, validUser);
      expect(firstRes.success).toBe(true);

      // Second redemption -> Throws INVITE_ALREADY_USED
      await expect(
        redeemFamilyInvite(inviteResult.rawToken, validUser)
      ).rejects.toThrowError(/INVITE_ALREADY_USED/);
    });

    it('survives concurrent race condition: exactly one redemption succeeds and duplicate fails', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'race.condition@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      const validUser = {
        id: crypto.randomUUID(),
        email: 'race.condition@wedding.local',
      };
      mockDb.users.set(validUser.id, { id: validUser.id, email: validUser.email, role: 'family_view' });

      // Trigger two concurrent redemptions in parallel
      const [res1, res2] = await Promise.allSettled([
        redeemFamilyInvite(inviteResult.rawToken, validUser),
        redeemFamilyInvite(inviteResult.rawToken, validUser),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason.message).toMatch(/INVITE_ALREADY_USED/);
    });

    it('rejects expired invitations (> 7 days)', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'expired@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      // Fast-forward invite expiration into the past
      const stored = mockDb.memberInvites.get(inviteResult.inviteId)!;
      stored.expiresAt = new Date(Date.now() - 1000);

      const user = { id: crypto.randomUUID(), email: 'expired@wedding.local' };
      await expect(
        redeemFamilyInvite(inviteResult.rawToken, user)
      ).rejects.toThrowError(/INVITE_EXPIRED/);
    });

    it('rejects revoked invitations', async () => {
      const inviteResult = await createFamilyInvite(
        { email: 'revoked@wedding.local', allowedEventIds: [testEventId] },
        ownerUserId
      );

      await revokeFamilyInvite(inviteResult.inviteId, ownerUserId);

      const user = { id: crypto.randomUUID(), email: 'revoked@wedding.local' };
      await expect(
        redeemFamilyInvite(inviteResult.rawToken, user)
      ).rejects.toThrowError(/INVITE_REVOKED/);
    });
  });
});
