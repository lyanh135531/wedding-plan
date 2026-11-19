import { describe,it,expect } from 'vitest';
import { parseGuestCsv, readGuestFile } from '@/lib/import/read-file';
import ExcelJS from 'exceljs';
import { initialValues,fieldPayload,Field } from '@/components/common/ResourceWorkspace';
describe('Live import and editor data integrity',()=>{
  it('reads XLSX text and rejects formulas instead of importing their cached results',async()=>{
    const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Khách');sheet.addRow(['display_name','phone']);sheet.addRow(['Nguyễn An','0901234567']);
    const file=async()=>new File([new Uint8Array(await workbook.xlsx.writeBuffer())],'guests.xlsx');
    expect(await readGuestFile(await file())).toEqual([['display_name','phone'],['Nguyễn An','0901234567']]);
    sheet.getCell('B2').value={formula:'1+1',result:2};await expect(readGuestFile(await file())).rejects.toThrow('chứa công thức');
  });
  it('reads BOM, quoted commas, escaped quotes, multiline notes and leading zero phone numbers',()=>{
    const rows=parseGuestCsv('\uFEFFdisplay_name,phone,notes\r\n"Nguyễn, An",0901234567,"Dòng một\nDòng ""hai"""\r\n');
    expect(rows[1]).toEqual(['Nguyễn, An','0901234567','Dòng một\nDòng "hai"']);
  });
  it('rejects malformed CSV and oversized row counts before staging',()=>{
    expect(()=>parseGuestCsv('name\n"unterminated')).toThrow();
    expect(()=>parseGuestCsv('name\n'+Array(2001).fill('Guest').join('\n'))).toThrow('2.000');
  });
  it('keeps large VND values as text, zero values and explicit clearing',()=>{
    const fields:Field[]=[{key:'amount',label:'VND'},{key:'quantity',label:'Số lượng',type:'number'},{key:'notes',label:'Ghi chú'},{key:'isShared',label:'Chia sẻ',type:'checkbox'}];
    expect(fieldPayload(fields,{amount:'9007199254740993',quantity:'0',notes:'',isShared:false})).toEqual({amount:'9007199254740993',quantity:0,notes:null,isShared:false});
  });
  it('round-trips Vietnam datetime and metadata without converting to browser timezone',()=>{
    const fields:Field[]=[{key:'departureTime',label:'Giờ',type:'datetime-local'},{key:'artist',label:'Nghệ sĩ'},{key:'roles',label:'Vai trò',type:'multi'}];
    const values=initialValues(fields,{id:'x',departureTime:'2028-03-20T03:00:00.000Z',metadata:{artist:'Ca sĩ'},roles:['mc']});
    expect(values.departureTime).toBe('2028-03-20T10:00');expect(fieldPayload(fields,values)).toEqual({departureTime:'2028-03-20T03:00:00.000Z',artist:'Ca sĩ',roles:['mc']});
  });
});
