'use client';

import * as React from 'react';
import { Mail, Search } from 'lucide-react';
import { TextInput } from '@/components/ui/input';
import { TextArea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelect } from '@/components/ui/multi-select';
import { DatePicker } from '@/components/ui/date-picker';
import { CurrencyInput } from '@/components/ui/currency-input';
import { QuantityInput } from '@/components/ui/quantity-input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { FileUploadDropzone } from '@/components/ui/file-upload-dropzone';
import { ModalDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const events = [
  { value: 'engagement', label: 'Lễ đính hôn', description: 'Không gian ấm cúng bên gia đình' },
  { value: 'ceremony', label: 'Lễ gia tiên', description: 'Nghi thức truyền thống', disabled: true },
  { value: 'reception', label: 'Tiệc cưới', description: 'Buổi tối cùng những người thân yêu' },
];
const guests = ['Nguyễn Minh Anh', 'Trần Hoàng Nam', 'Lê Thu Hà', 'Phạm Gia Bảo', 'Đỗ Ngọc Linh', 'Vũ Khánh An'].map((label, index) => ({ value: String(index), label }));

export function InputControlsPlayground() {
  const [event, setEvent] = React.useState<string | null>('reception');
  const [members, setMembers] = React.useState<string[]>(['0', '1']);
  const [date, setDate] = React.useState<string | null>('2027-04-18');
  const [amount, setAmount] = React.useState<bigint | null>(25000000n);
  const [quantity, setQuantity] = React.useState(8);
  const [checked, setChecked] = React.useState(true);
  const [shared, setShared] = React.useState(true);
  const [delivery, setDelivery] = React.useState('paper');
  const [modal, setModal] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-10 sm:py-14 space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow mb-3">Sổ quản lý đám cưới</p><h1 className="text-3xl sm:text-4xl">Từng chi tiết, thật chỉn chu.</h1><p className="mt-3 text-sm text-text-muted">Bản xem thử các trường nhập liệu và lựa chọn.</p></div>
      <Button variant="secondary" onClick={() => setModal(true)}>Xem trong hộp thoại</Button>
    </header>
    <form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
      <section className="surface-card p-6 sm:p-8 space-y-6">
        <div><p className="eyebrow mb-2">01 · Thông tin</p><h2 className="text-xl font-medium">Những người thân yêu</h2></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Họ và tên" defaultValue="Nguyễn Minh Anh" required />
          <TextInput label="Email liên hệ" type="email" placeholder="minhanh@example.com" leftAddon={<Mail className="h-4 w-4" />} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">Mối quan hệ<select defaultValue="family" className="px-3.5 py-2.5"><option value="family">Gia đình & họ hàng</option><option value="friend">Bạn bè thân thiết</option><option value="work">Đồng nghiệp</option></select></label>
          <Combobox label="Buổi lễ tham dự" options={events} value={event} onChange={setEvent} />
        </div>
        <div className="space-y-2"><label htmlFor="preview-members" className="text-sm font-medium">Cùng nhận thiệp mời <span className="text-danger">*</span></label><MultiSelect id="preview-members" label="Thành viên nhận thiệp" options={guests} value={members} onChange={setMembers} required /></div>
        <TextArea label="Lời nhắn riêng" placeholder="Ghi lại những điều cần lưu ý cho ngày chung vui…" helperText="Chỉ chủ sở hữu có thể xem lời nhắn này." maxCharacters={300} />
        <div className="grid gap-5 sm:grid-cols-2"><TextInput label="Số điện thoại" error="Vui lòng nhập số điện thoại hợp lệ." defaultValue="090" /><TextInput label="Mã khách mời" value="GUEST-0024" readOnly helperText="Mã được tạo tự động." /></div>
      </section>
      <div className="space-y-6">
        <section className="surface-card p-6 sm:p-8 space-y-5">
          <div><p className="eyebrow mb-2">02 · Kế hoạch</p><h2 className="text-xl font-medium">Chuẩn bị ngày chung đôi</h2></div>
          <DatePicker label="Ngày tổ chức" value={date} onChange={setDate} />
          <CurrencyInput label="Ngân sách dự kiến" value={amount} onChange={setAmount} />
          <QuantityInput label="Số bàn dự kiến" value={quantity} min={1} max={100} onChange={setQuantity} unitLabel="bàn" />
          <TextInput label="Trạng thái đã khóa" value="Đã xác nhận" disabled />
          <RadioGroup name="preview-delivery" label="Cách gửi thiệp" options={[{ value: 'paper', label: 'Thiệp giấy', description: 'Trao tận tay lời mời trân trọng' }, { value: 'digital', label: 'Thiệp điện tử' }]} value={delivery} onChange={setDelivery} />
          <Checkbox label="Đã xác nhận thông tin" description="Thông tin đã được đối chiếu với gia đình." checked={checked} onChange={e => setChecked(e.target.checked)} />
          <Switch label="Chia sẻ với người nhà" description="Cho phép xem thông tin buổi lễ." checked={shared} onChange={setShared} />
        </section>
      </div>
      <section className="surface-card p-6 sm:p-8 space-y-5 lg:col-span-2">
        <div><p className="eyebrow mb-2">03 · Tìm kiếm & tài liệu</p><h2 className="text-xl font-medium">Gọn gàng, dễ tìm</h2></div>
        <TextInput label="Tìm kiếm" type="search" placeholder="Tìm khách mời, buổi lễ hoặc tài liệu…" leftAddon={<Search className="h-4 w-4" />} />
        <FileUploadDropzone files={[]} onFilesSelected={() => {}} onRemoveFile={() => {}} />
        <div className="flex flex-wrap items-center justify-between gap-4"><p role="status" className="text-sm text-text-muted">{submitted ? 'Đã kiểm tra biểu mẫu. Không lưu dữ liệu.' : 'Thay đổi trên trang này chỉ dùng để xem thử.'}</p><Button type="submit">Kiểm tra biểu mẫu</Button></div>
      </section>
    </form>
    <ModalDialog isOpen={modal} onClose={() => setModal(false)} title="Thêm thiệp mời" description="Một lời mời, dành cho những người thân yêu.">
      <div className="space-y-5">
        <TextInput label="Tên trên thiệp" defaultValue="Gia đình Minh Anh" required />
        <Combobox label="Người đại diện" options={guests} value={members[0] || null} onChange={value => setMembers(value ? [value, ...members.filter(member => member !== value)] : [])} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">Cách gửi<select className="px-3.5 py-2.5"><option>Thiệp giấy</option><option>Thiệp điện tử</option></select></label>
        <div className="space-y-2"><label htmlFor="modal-members" className="text-sm font-medium">Thành viên nhận chung thiệp</label><MultiSelect id="modal-members" label="Thành viên nhận chung thiệp" options={guests} value={members} onChange={setMembers} /></div>
        <TextArea label="Ghi chú riêng" placeholder="Nhập ghi chú…" />
        <div className="flex justify-end"><Button onClick={() => setModal(false)}>Hoàn tất</Button></div>
      </div>
    </ModalDialog>
  </main>;
}
