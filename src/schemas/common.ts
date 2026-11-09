import { z } from 'zod';

/**
 * UUID v4 Schema
 * Chuẩn hóa viết thường (lowercase) và kiểm tra định dạng hex 36 ký tự theo chuẩn RFC 4122.
 * Ngăn chặn ký tự không phải hex gây lỗi cú pháp trên PostgreSQL (AT04).
 */
export const uuidSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    { message: 'Định dạng ID không hợp lệ (yêu cầu UUID v4)' }
  );

/**
 * Optimistic Locking Version Schema
 */
export const versionSchema = z
  .number()
  .int({ message: 'Version phải là số nguyên' })
  .min(1, { message: 'Version tối thiểu là 1' });

/**
 * ISO 8601 Date String (YYYY-MM-DD)
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có định dạng YYYY-MM-DD' });

/**
 * ISO 8601 DateTime with Timezone (supports both UTC 'Z' and offsets like '+07:00')
 */
export const dateTimeStringSchema = z
  .string()
  .datetime({ offset: true, message: 'Thời gian phải theo chuẩn ISO 8601 (có múi giờ)' });

/**
 * Tiền VND dạng chuỗi số nguyên không âm (dùng cho API request/response DTO).
 * Tuyệt đối chặn ký tự thập phân, dấu chấm, dấu phẩy hoặc số âm.
 */
export const vndCurrencyStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, { message: 'Số tiền VND phải là chuỗi số nguyên không âm (chỉ gồm các chữ số)' })
  .max(18, { message: 'Số tiền vượt quá giới hạn an toàn của hệ thống' });

/**
 * Tiền VND dạng BigInt domain (chuyển đổi chuỗi chữ số hoặc native bigint sang BigInt)
 */
export const vndBigIntSchema = z
  .union([
    vndCurrencyStringSchema.transform((val) => BigInt(val)),
    z.bigint().refine((val) => val >= 0n, { message: 'Số tiền không được là số âm' }),
  ]);

/**
 * Tiền VND có thể rỗng (nullable) cho các khoản chưa có giá
 */
export const nullableVndCurrencyStringSchema = vndCurrencyStringSchema.nullable().optional();

/**
 * Normalizes and strips non-essential formatting characters from raw phone input:
 * removes whitespace (including NBSP \u00A0), hyphens, dots, and parentheses.
 * Converts 11-digit numbers starting with '84' or numbers with redundant '0' after country code to canonical format.
 */
function cleanPhoneInput(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed === '') return '';

  // Strip whitespace (including NBSP \u00A0), hyphens, dots, parentheses
  let cleaned = trimmed.replace(/[\s\u00A0.\-()]/g, '');

  // Handle '+840...' or '840...' where local 0 was redundantly included after country code
  if (cleaned.startsWith('+840') && cleaned.length === 13) {
    cleaned = '+84' + cleaned.slice(4);
  } else if (cleaned.startsWith('840') && cleaned.length === 12) {
    cleaned = '+84' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '+84' + cleaned.slice(2);
  }

  return cleaned;
}

/**
 * Số điện thoại Việt Nam chuẩn (10 chữ số, đầu 0 hoặc +84)
 * Hỗ trợ các định dạng có dấu cách, dấu gạch nối, dấu chấm, dấu ngoặc đơn hoặc tiền tố 84.
 */
export const vietnamesePhoneSchema = z.preprocess(
  cleanPhoneInput,
  z
    .string()
    .trim()
    .regex(/^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/, {
      message: 'Số điện thoại không hợp lệ (yêu cầu 10 chữ số mạng Việt Nam, ví dụ: 0912345678 hoặc +84912345678)',
    })
);

export const nullableVietnamesePhoneSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  vietnamesePhoneSchema.nullable().optional()
);

/**
 * Email chuẩn hóa, viết thường và trim
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Địa chỉ email không đúng định dạng' })
  .max(255, { message: 'Email tối đa 255 ký tự' });

export const nullableEmailSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : typeof val === 'string' ? val.trim().toLowerCase() : val),
  emailSchema.nullable().optional()
);

/**
 * Chuỗi văn bản chung có kiểm tra và khử Formula Injection (AT29)
 * Tự động trim khoảng trắng đầu/cuối trước khi kiểm tra ký tự nguy hiểm.
 * Nếu chuỗi sau khi trim bắt đầu bằng '=', '+', '-', '@', '\t', '\r', '\n', thêm prefix nháy đơn '\''
 */
export const sanitizedTextSchema = (maxLength: number = 255) =>
  z
    .string()
    .transform((val) => {
      const dangerousChars = ['=', '+', '-', '@', '\t', '\r', '\n'];
      // 1. Kiểm tra tiền tố trực tiếp (giữ nhận diện các ký tự điều khiển \t, \r, \n sau khi bỏ space)
      const stripped = val.replace(/^ +/, '');
      if (stripped && dangerousChars.includes(stripped.charAt(0))) {
        return `'${val.trim()}`;
      }
      // 2. Kiểm tra chuỗi sau khi trim toàn diện
      const trimmed = val.trim();
      if (trimmed && dangerousChars.includes(trimmed.charAt(0))) {
        return `'${trimmed}`;
      }
      return trimmed;
    })
    .pipe(
      z
        .string()
        .max(maxLength + 1, { message: `Độ dài không được vượt quá ${maxLength} ký tự` })
    );

/**
 * Chuỗi văn bản bắt buộc không được rỗng sau khi trim
 */
export const requiredStringSchema = (fieldName: string, maxLength: number = 255) =>
  z
    .string()
    .trim()
    .min(1, { message: `${fieldName} không được để trống` })
    .max(maxLength, { message: `${fieldName} tối đa ${maxLength} ký tự` });

/**
 * Ghi chú văn bản dài (tối đa 2.000 ký tự)
 */
export const notesSchema = z
  .string()
  .trim()
  .max(2000, { message: 'Ghi chú tối đa 2000 ký tự' })
  .nullable()
  .optional();

/**
 * Phân trang và tìm kiếm chuẩn (Pagination Query)
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, { message: 'Trang phải lớn hơn hoặc bằng 1' }).default(1),
  limit: z.coerce.number().int().min(1).max(100, { message: 'Giới hạn tối đa 100 bản ghi/trang' }).default(20),
  search: z.string().trim().optional(),
  sort_by: z.string().trim().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
