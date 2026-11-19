import Papa from 'papaparse';

export const IMPORT_COLUMNS = [
  ['display_name', 'Họ và tên'], ['phone', 'Số điện thoại'], ['email', 'Email'], ['address', 'Địa chỉ'],
  ['side', 'Bên mời (groom/bride/mutual/unassigned)'], ['age_tier', 'Độ tuổi (adult/child/baby)'], ['group_name', 'Nhóm'], ['notes', 'Ghi chú'],
] as const;
export function parseGuestCsv(contents: string): string[][] {
  const parsed = Papa.parse<string[]>(contents.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  const error = parsed.errors.find(e => e.code !== 'UndetectableDelimiter');
  if (error) throw new Error(`Không đọc được CSV: ${error.message}`);
  if (parsed.data.length < 2) throw new Error('Tệp cần một dòng tiêu đề và ít nhất một dòng khách mời.');
  if (parsed.data.length > 2001) throw new Error('Mỗi lần nhập tối đa 2.000 dòng khách mời.');
  return parsed.data;
}
export async function readGuestFile(file: File): Promise<string[][]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Tệp tối đa 5 MB.');
  if (/\.csv$/i.test(file.name)) return parseGuestCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Chọn tệp CSV hoặc XLSX.');
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2 || worksheet.rowCount > 2001 || worksheet.columnCount > 100) throw new Error('Sheet đầu cần 1–2.000 dòng dữ liệu và tối đa 100 cột.');
  const rows: string[][] = [];
  worksheet.eachRow(row => {
    const values: string[] = [];
    for (let i = 1; i <= worksheet.columnCount; i++) {
      const cell = row.getCell(i);
      if (cell.type === 6) throw new Error(`Ô ${cell.address} chứa công thức. Hãy dán giá trị trước khi nhập.`);
      values.push(cell.text);
    }
    rows.push(values);
  });
  return rows;
}
