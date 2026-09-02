import React, { useState, useEffect, useMemo } from 'react';

// ── Types & Interfaces ────────────────────────────────────────────────────────
export type ClassType = 'teaching' | 'homeroom'; // Lớp dạy | Lớp chủ nhiệm
export type StudentRole = 'member' | 'leader' | 'deputy_study' | 'deputy_discipline' | 'secretary' | 'group_leader';
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'unexcused';
export type ConductType = 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';

export interface StudentGrades {
  oral?: number[];        // Điểm miệng (HS 1)
  fifteenMin?: number[];  // Điểm 15 phút (HS 1)
  onePeriod?: number[];   // Điểm 1 tiết / giữa kỳ (HS 2)
  finalExam?: number;     // Điểm cuối kỳ (HS 3)
}

export interface Student {
  id: string;
  name: string;
  gender: 'male' | 'female';
  dob?: string;
  studentCode?: string;
  role: StudentRole;
  group?: number; // Tổ 1, 2, 3, 4
  parentName?: string;
  parentPhone?: string;
  parentZalo?: string;
  notes?: string;
  grades?: StudentGrades;
  conduct?: ConductType;
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  type: 'praise' | 'violation'; // Khen thưởng (+) | Vi phạm (-)
  category: string;
  score: number; // +2, +5, -2, -5...
  notes: string;
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  period?: number; // Tiết học; bản ghi cũ không có sẽ được hiểu là tiết 1
  statuses: Record<string, AttendanceStatus>; // studentId -> status
  notes: Record<string, string>; // studentId -> note
}

export interface ClassItem {
  id: string;
  name: string;
  type: ClassType;
  subject?: string; // Môn học (VD: Toán học, Vật lí, Hóa học...)
  grade: number; // 10, 11, 12
  schoolYear: string; // "2025 - 2026"
  semester: 'HK1' | 'HK2';
  room?: string;
  description?: string;
  students: Student[];
  attendance: AttendanceRecord[];
  disciplineRecords: DisciplineRecord[];
  createdAt: string;
}

// ── Initial Mock Data for Teachers ──────────────────────────────────────────
const INITIAL_CLASSES: ClassItem[] = [
  {
    id: 'class-12a1',
    name: '12A1',
    type: 'homeroom',
    subject: 'Toán học',
    grade: 12,
    schoolYear: '2025 - 2026',
    semester: 'HK2',
    room: 'Phòng 301 - Nhà A',
    description: 'Lớp chủ nhiệm khối 12 chất lượng cao, định hướng thi khối A, A1, B.',
    createdAt: '2025-09-05T08:00:00.000Z',
    attendance: [
      {
        date: new Date().toISOString().split('T')[0],
        statuses: {
          'hs-12a1-01': 'present',
          'hs-12a1-02': 'present',
          'hs-12a1-03': 'present',
          'hs-12a1-04': 'late',
          'hs-12a1-05': 'excused',
          'hs-12a1-06': 'present',
          'hs-12a1-07': 'present',
          'hs-12a1-08': 'present',
          'hs-12a1-09': 'present',
          'hs-12a1-10': 'present',
        },
        notes: {
          'hs-12a1-04': 'Hỏng xe máy điện lúc 7h05',
          'hs-12a1-05': 'Phụ huynh xin nghỉ sốt nhẹ',
        }
      }
    ],
    disciplineRecords: [
      {
        id: 'disc-1',
        studentId: 'hs-12a1-01',
        studentName: 'Nguyễn Hoàng An',
        date: '2026-03-10',
        type: 'praise',
        category: 'Giải bài tập xuất sắc',
        score: 5,
        notes: 'Xung phong giải bài Toán vận dụng cao phần Số phức lên bảng',
      },
      {
        id: 'disc-2',
        studentId: 'hs-12a1-04',
        studentName: 'Phạm Minh Đức',
        date: '2026-03-12',
        type: 'violation',
        category: 'Đi học muộn',
        score: -2,
        notes: 'Đi muộn 15 phút tiết 1',
      },
      {
        id: 'disc-3',
        studentId: 'hs-12a1-03',
        studentName: 'Lê Thùy Dung',
        date: '2026-03-14',
        type: 'praise',
        category: 'Trực nhật xuất sắc',
        score: 3,
        notes: 'Tổ chức tổ 2 vệ sinh lớp sạch sẽ trước giờ chào cờ',
      }
    ],
    students: [
      {
        id: 'hs-12a1-01',
        name: 'Nguyễn Hoàng An',
        gender: 'male',
        dob: '2008-04-15',
        studentCode: '12A101',
        role: 'leader',
        group: 1,
        parentName: 'Nguyễn Văn Hùng',
        parentPhone: '0912345678',
        parentZalo: '0912345678',
        notes: 'Học lực xuất sắc, cán bộ gương mẫu',
        conduct: 'Tốt',
        grades: { oral: [9, 10], fifteenMin: [9.5, 9.0], onePeriod: [9.2], finalExam: 9.5 }
      },
      {
        id: 'hs-12a1-02',
        name: 'Trần Thị Ngọc Ánh',
        gender: 'female',
        dob: '2008-08-22',
        studentCode: '12A102',
        role: 'deputy_study',
        group: 1,
        parentName: 'Trần Văn Nam',
        parentPhone: '0988776655',
        parentZalo: '0988776655',
        notes: 'Phụ trách đôn đốc bài tập nhóm',
        conduct: 'Tốt',
        grades: { oral: [9, 9.5], fifteenMin: [8.5, 9.0], onePeriod: [8.8], finalExam: 9.0 }
      },
      {
        id: 'hs-12a1-03',
        name: 'Lê Thùy Dung',
        gender: 'female',
        dob: '2008-01-10',
        studentCode: '12A103',
        role: 'secretary',
        group: 2,
        parentName: 'Lê Thị Thu',
        parentPhone: '0903123456',
        parentZalo: '0903123456',
        notes: 'Bí thư Chi đoàn năng nổ',
        conduct: 'Tốt',
        grades: { oral: [8.5, 9], fifteenMin: [8.0, 8.5], onePeriod: [8.5], finalExam: 8.5 }
      },
      {
        id: 'hs-12a1-04',
        name: 'Phạm Minh Đức',
        gender: 'male',
        dob: '2008-11-05',
        studentCode: '12A104',
        role: 'deputy_discipline',
        group: 2,
        parentName: 'Phạm Văn Long',
        parentPhone: '0977112233',
        parentZalo: '0977112233',
        notes: 'Phụ trách nề nếp và thể thao',
        conduct: 'Khá',
        grades: { oral: [7, 8], fifteenMin: [7.5, 8.0], onePeriod: [7.8], finalExam: 8.0 }
      },
      {
        id: 'hs-12a1-05',
        name: 'Vũ Quốc Huy',
        gender: 'male',
        dob: '2008-06-18',
        studentCode: '12A105',
        role: 'group_leader',
        group: 3,
        parentName: 'Vũ Đình Trọng',
        parentPhone: '0918334455',
        parentZalo: '0918334455',
        notes: 'Tổ trưởng tổ 3, tiếp thu nhanh',
        conduct: 'Tốt',
        grades: { oral: [8, 9], fifteenMin: [8.5, 9.0], onePeriod: [8.2], finalExam: 8.8 }
      },
      {
        id: 'hs-12a1-06',
        name: 'Hoàng Mai Hương',
        gender: 'female',
        dob: '2008-09-30',
        studentCode: '12A106',
        role: 'group_leader',
        group: 4,
        parentName: 'Hoàng Kim Sơn',
        parentPhone: '0933557799',
        parentZalo: '0933557799',
        notes: 'Tổ trưởng tổ 4, chăm chỉ',
        conduct: 'Tốt',
        grades: { oral: [8.5, 8.5], fifteenMin: [8.0, 9.0], onePeriod: [8.5], finalExam: 8.5 }
      },
      {
        id: 'hs-12a1-07',
        name: 'Đặng Tuấn Kiệt',
        gender: 'male',
        dob: '2008-03-14',
        studentCode: '12A107',
        role: 'member',
        group: 1,
        parentName: 'Đặng Văn Cường',
        parentPhone: '0944668800',
        parentZalo: '0944668800',
        notes: 'Cần rèn thêm phần Hình không gian Oxyz',
        conduct: 'Tốt',
        grades: { oral: [7.5, 8], fifteenMin: [7.0, 7.5], onePeriod: [7.5], finalExam: 7.8 }
      },
      {
        id: 'hs-12a1-08',
        name: 'Bùi Thị Lan',
        gender: 'female',
        dob: '2008-12-25',
        studentCode: '12A108',
        role: 'member',
        group: 2,
        parentName: 'Bùi Minh Tân',
        parentPhone: '0966882244',
        parentZalo: '0966882244',
        notes: 'Chăm chỉ, làm bài đầy đủ',
        conduct: 'Tốt',
        grades: { oral: [8, 8.5], fifteenMin: [8.0, 8.0], onePeriod: [8.0], finalExam: 8.2 }
      },
      {
        id: 'hs-12a1-09',
        name: 'Đỗ Quang Minh',
        gender: 'male',
        dob: '2008-07-07',
        studentCode: '12A109',
        role: 'member',
        group: 3,
        parentName: 'Đỗ Văn Thành',
        parentPhone: '0922446688',
        parentZalo: '0922446688',
        notes: 'Học tốt Nguyên hàm - Tích phân',
        conduct: 'Tốt',
        grades: { oral: [9, 9], fifteenMin: [8.5, 9.5], onePeriod: [9.0], finalExam: 9.0 }
      },
      {
        id: 'hs-12a1-10',
        name: 'Ngô Phương Nga',
        gender: 'female',
        dob: '2008-05-19',
        studentCode: '12A110',
        role: 'member',
        group: 4,
        parentName: 'Ngô Đức Thắng',
        parentPhone: '0977889900',
        parentZalo: '0977889900',
        notes: 'Tiến bộ rõ rệt sau đợt ôn tập giữa kỳ',
        conduct: 'Tốt',
        grades: { oral: [8, 8.5], fifteenMin: [7.5, 8.5], onePeriod: [8.2], finalExam: 8.4 }
      }
    ]
  },
  {
    id: 'class-12a2',
    name: '12A2',
    type: 'teaching',
    subject: 'Toán học',
    grade: 12,
    schoolYear: '2025 - 2026',
    semester: 'HK2',
    room: 'Phòng 302 - Nhà A',
    description: 'Lớp giảng dạy môn Toán 12 (4 tiết/tuần)',
    createdAt: '2025-09-06T08:00:00.000Z',
    attendance: [],
    disciplineRecords: [],
    students: [
      { id: 'hs-12a2-01', name: 'Nguyễn Văn An', gender: 'male', studentCode: '12A201', role: 'leader', grades: { oral: [8], fifteenMin: [7.5], onePeriod: [8.0], finalExam: 8.0 } },
      { id: 'hs-12a2-02', name: 'Trần Bích Bảo', gender: 'female', studentCode: '12A202', role: 'deputy_study', grades: { oral: [9], fifteenMin: [8.5], onePeriod: [9.0], finalExam: 8.8 } },
      { id: 'hs-12a2-03', name: 'Lê Duy Cường', gender: 'male', studentCode: '12A203', role: 'member', grades: { oral: [7.5], fifteenMin: [7.0], onePeriod: [7.5], finalExam: 7.2 } },
      { id: 'hs-12a2-04', name: 'Phạm Thùy Dương', gender: 'female', studentCode: '12A204', role: 'member', grades: { oral: [8.5], fifteenMin: [8.0], onePeriod: [8.5], finalExam: 8.5 } },
      { id: 'hs-12a2-05', name: 'Vũ Hải Đăng', gender: 'male', studentCode: '12A205', role: 'member', grades: { oral: [9], fifteenMin: [9.0], onePeriod: [9.2], finalExam: 9.0 } },
      { id: 'hs-12a2-06', name: 'Hoàng Kim Giang', gender: 'female', studentCode: '12A206', role: 'member', grades: { oral: [8], fifteenMin: [8.0], onePeriod: [7.8], finalExam: 8.0 } },
      { id: 'hs-12a2-07', name: 'Đặng Tuấn Hải', gender: 'male', studentCode: '12A207', role: 'member', grades: { oral: [7], fifteenMin: [7.5], onePeriod: [7.0], finalExam: 7.5 } },
      { id: 'hs-12a2-08', name: 'Bùi Khánh Linh', gender: 'female', studentCode: '12A208', role: 'member', grades: { oral: [8.5], fifteenMin: [9.0], onePeriod: [8.5], finalExam: 8.6 } }
    ]
  },
  {
    id: 'class-12d1',
    name: '12D1',
    type: 'teaching',
    subject: 'Toán học',
    grade: 12,
    schoolYear: '2025 - 2026',
    semester: 'HK2',
    room: 'Phòng 204 - Nhà B',
    description: 'Lớp giảng dạy môn Toán khối D (3 tiết/tuần)',
    createdAt: '2025-09-07T08:00:00.000Z',
    attendance: [],
    disciplineRecords: [],
    students: [
      { id: 'hs-12d1-01', name: 'Nguyễn Mai Anh', gender: 'female', studentCode: '12D101', role: 'leader', grades: { oral: [9], fifteenMin: [8.5], onePeriod: [8.5], finalExam: 8.5 } },
      { id: 'hs-12d1-02', name: 'Trần Tuấn Bình', gender: 'male', studentCode: '12D102', role: 'deputy_study', grades: { oral: [8], fifteenMin: [7.5], onePeriod: [8.0], finalExam: 7.8 } },
      { id: 'hs-12d1-03', name: 'Lê Ngọc Châu', gender: 'female', studentCode: '12D103', role: 'member', grades: { oral: [7.5], fifteenMin: [8.0], onePeriod: [7.5], finalExam: 7.6 } },
      { id: 'hs-12d1-04', name: 'Phạm Đức Dũng', gender: 'male', studentCode: '12D104', role: 'member', grades: { oral: [6.5], fifteenMin: [7.0], onePeriod: [6.8], finalExam: 7.0 } },
      { id: 'hs-12d1-05', name: 'Vũ Thị Hoa', gender: 'female', studentCode: '12D105', role: 'member', grades: { oral: [8.5], fifteenMin: [8.0], onePeriod: [8.2], finalExam: 8.2 } },
      { id: 'hs-12d1-06', name: 'Hoàng Trọng Khoa', gender: 'male', studentCode: '12D106', role: 'member', grades: { oral: [7.5], fifteenMin: [7.5], onePeriod: [7.2], finalExam: 7.4 } }
    ]
  }
];

const ROLE_LABELS: Record<StudentRole, { label: string; color: string; badgeClass: string }> = {
  leader: { label: 'Lớp trưởng', color: 'blue', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  deputy_study: { label: 'Lớp phó học tập', color: 'emerald', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  deputy_discipline: { label: 'Lớp phó nề nếp', color: 'amber', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  secretary: { label: 'Bí thư Chi đoàn', color: 'rose', badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  group_leader: { label: 'Tổ trưởng', color: 'purple', badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  member: { label: 'Thành viên', color: 'slate', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' }
};

// ── Calculate Student Average Score ─────────────────────────────────────────
function calculateAverage(grades?: StudentGrades): number | null {
  if (!grades) return null;
  let totalScore = 0;
  let totalWeight = 0;

  if (grades.oral && grades.oral.length > 0) {
    grades.oral.forEach(score => { totalScore += score * 1; totalWeight += 1; });
  }
  if (grades.fifteenMin && grades.fifteenMin.length > 0) {
    grades.fifteenMin.forEach(score => { totalScore += score * 1; totalWeight += 1; });
  }
  if (grades.onePeriod && grades.onePeriod.length > 0) {
    grades.onePeriod.forEach(score => { totalScore += score * 2; totalWeight += 2; });
  }
  if (grades.finalExam !== undefined && grades.finalExam !== null) {
    totalScore += grades.finalExam * 3;
    totalWeight += 3;
  }

  if (totalWeight === 0) return null;
  return Number((totalScore / totalWeight).toFixed(1));
}

function getGradeClassification(avg: number | null): { label: string; color: string } {
  if (avg === null) return { label: 'Chưa có', color: 'text-gray-400' };
  if (avg >= 8.0) return { label: 'Tốt', color: 'text-emerald-600 dark:text-emerald-400 font-bold' };
  if (avg >= 6.5) return { label: 'Khá', color: 'text-blue-600 dark:text-blue-400 font-bold' };
  if (avg >= 5.0) return { label: 'Đạt', color: 'text-amber-600 dark:text-amber-400 font-medium' };
  return { label: 'Cần hỗ trợ', color: 'text-rose-600 dark:text-rose-400 font-bold' };
}

// ── Main React Component ────────────────────────────────────────────────────
export default function ClassManager() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance' | 'grades' | 'homeroom' | 'parents' | 'tools'>('roster');
  const [filterClassType, setFilterClassType] = useState<'all' | 'teaching' | 'homeroom'>('all');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [selectedStudentForDisc, setSelectedStudentForDisc] = useState<string>('');
  const [discType, setDiscType] = useState<'praise' | 'violation'>('praise');
  const [discCategory, setDiscCategory] = useState('Phát biểu bài');
  const [discScore, setDiscScore] = useState(2);
  const [discNotes, setDiscNotes] = useState('');

  // Attendance Date
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedAttendancePeriod, setSelectedAttendancePeriod] = useState<number>(1);

  // Quick Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Load & Save to LocalStorage ───────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lop12-classes-data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setClasses(parsed);
          setActiveClassId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load classes from localStorage', e);
    }
    // Fallback to initial mock data
    setClasses(INITIAL_CLASSES);
    setActiveClassId(INITIAL_CLASSES[0].id);
    localStorage.setItem('lop12-classes-data', JSON.stringify(INITIAL_CLASSES));
  }, []);

  const saveClasses = (updated: ClassItem[]) => {
    setClasses(updated);
    try {
      localStorage.setItem('lop12-classes-data', JSON.stringify(updated));
      // Also sync class names to RandomPicker localStorage so teacher can seamlessly use them!
      const syncForRandomPicker = updated.map(c => ({
        id: c.id,
        name: `${c.name} (${c.type === 'homeroom' ? 'Chủ nhiệm' : c.subject || 'Môn dạy'})`,
        students: c.students.map(s => s.name)
      }));
      localStorage.setItem('lop12-random-picker-classes', JSON.stringify(syncForRandomPicker));
    } catch (e) {
      console.error('Failed to save classes to localStorage', e);
    }
  };

  const activeClass = useMemo(() => {
    return classes.find(c => c.id === activeClassId) || classes[0] || null;
  }, [classes, activeClassId]);

  // Filtered Class List in sidebar/header
  const filteredClasses = useMemo(() => {
    if (filterClassType === 'all') return classes;
    return classes.filter(c => c.type === filterClassType);
  }, [classes, filterClassType]);

  // Filtered Students in Active Class
  const filteredStudents = useMemo(() => {
    if (!activeClass) return [];
    return activeClass.students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.studentCode && student.studentCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (student.parentPhone && student.parentPhone.includes(searchQuery));
      const matchesGroup = selectedGroupFilter === 'all' || 
        (selectedGroupFilter === 'no_group' && !student.group) || 
        (student.group?.toString() === selectedGroupFilter);
      return matchesSearch && matchesGroup;
    });
  }, [activeClass, searchQuery, selectedGroupFilter]);

  // Attendance is tracked by date and period, not only by date.
  const currentAttendance = useMemo(() => {
    if (!activeClass) return null;
    let rec = activeClass.attendance.find(a => a.date === selectedAttendanceDate && (a.period ?? 1) === selectedAttendancePeriod);
    if (!rec) {
      rec = {
        date: selectedAttendanceDate,
        period: selectedAttendancePeriod,
        statuses: {},
        notes: {}
      };
    }
    return rec;
  }, [activeClass, selectedAttendanceDate, selectedAttendancePeriod]);

  // Attendance stats for current date
  const attendanceStats = useMemo(() => {
    if (!activeClass) return { present: 0, late: 0, excused: 0, unexcused: 0, total: 0, rate: 0 };
    const statuses = currentAttendance?.statuses || {};
    const total = activeClass.students.length;
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;

    activeClass.students.forEach(s => {
      const st = statuses[s.id] || 'present';
      if (st === 'present') present++;
      else if (st === 'late') late++;
      else if (st === 'excused') excused++;
      else if (st === 'unexcused') unexcused++;
    });

    const attended = present + late;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 100;
    return { present, late, excused, unexcused, total, rate };
  }, [activeClass, currentAttendance]);

  // Signals for the teacher to review with the learner before contacting family.
  const studentSupportList = useMemo(() => {
    if (!activeClass) return [];
    return activeClass.students.map(student => {
      const records = activeClass.attendance;
      const lateCount = records.filter(record => record.statuses[student.id] === 'late').length;
      const excusedCount = records.filter(record => record.statuses[student.id] === 'excused').length;
      const unexcusedCount = records.filter(record => record.statuses[student.id] === 'unexcused').length;
      const average = calculateAverage(student.grades);
      const reasons: string[] = [];
      if (unexcusedCount > 0) reasons.push(`${unexcusedCount} tiết nghỉ không phép`);
      if (lateCount >= 2) reasons.push(`${lateCount} tiết đi muộn`);
      if (average !== null && average < 5) reasons.push(`ĐTB tạm tính ${average}`);
      const priority = unexcusedCount >= 2 || (average !== null && average < 5) ? 'urgent' : 'watch';
      return { student, lateCount, excusedCount, unexcusedCount, average, reasons, priority };
    }).filter(item => item.reasons.length > 0)
      .sort((a, b) => (b.unexcusedCount * 10 + b.lateCount) - (a.unexcusedCount * 10 + a.lateCount));
  }, [activeClass]);

  // ── Handlers: Class CRUD ──────────────────────────────────────────────────
  const handleSaveClass = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const type = formData.get('type') as ClassType;
    const subject = (formData.get('subject') as string).trim();
    const grade = Number(formData.get('grade') || 12);
    const schoolYear = (formData.get('schoolYear') as string).trim();
    const semester = (formData.get('semester') as 'HK1' | 'HK2') || 'HK2';
    const room = (formData.get('room') as string).trim();
    const description = (formData.get('description') as string).trim();

    if (!name) return alert('Vui lòng nhập tên lớp');

    let updated: ClassItem[];
    if (editingClass) {
      updated = classes.map(c => c.id === editingClass.id ? {
        ...c,
        name,
        type,
        subject,
        grade,
        schoolYear,
        semester,
        room,
        description
      } : c);
      showToast(`Đã cập nhật lớp ${name}`);
    } else {
      const newClass: ClassItem = {
        id: `class-${Date.now()}`,
        name,
        type,
        subject,
        grade,
        schoolYear,
        semester,
        room,
        description,
        students: [],
        attendance: [],
        disciplineRecords: [],
        createdAt: new Date().toISOString()
      };
      updated = [...classes, newClass];
      setActiveClassId(newClass.id);
      showToast(`Đã tạo mới lớp ${name}`);
    }

    saveClasses(updated);
    setShowClassModal(false);
    setEditingClass(null);
  };

  const handleDeleteClass = (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa lớp ${name}? Dữ liệu học sinh, điểm và điểm danh sẽ bị xóa hoàn toàn.`)) return;
    const updated = classes.filter(c => c.id !== id);
    if (updated.length > 0 && activeClassId === id) {
      setActiveClassId(updated[0].id);
    }
    saveClasses(updated);
    showToast(`Đã xóa lớp ${name}`);
  };

  // ── Handlers: Student CRUD ────────────────────────────────────────────────
  const handleSaveStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeClass) return;
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const gender = (formData.get('gender') as 'male' | 'female') || 'male';
    const studentCode = (formData.get('studentCode') as string).trim();
    const dob = (formData.get('dob') as string).trim();
    const role = (formData.get('role') as StudentRole) || 'member';
    const group = formData.get('group') ? Number(formData.get('group')) : undefined;
    const parentName = (formData.get('parentName') as string).trim();
    const parentPhone = (formData.get('parentPhone') as string).trim();
    const notes = (formData.get('notes') as string).trim();
    const conduct = (formData.get('conduct') as ConductType) || 'Tốt';

    if (!name) return alert('Vui lòng nhập họ và tên học sinh');

    let updatedStudents: Student[];
    if (editingStudent) {
      updatedStudents = activeClass.students.map(s => s.id === editingStudent.id ? {
        ...s,
        name,
        gender,
        studentCode,
        dob,
        role,
        group,
        parentName,
        parentPhone,
        parentZalo: parentPhone,
        notes,
        conduct
      } : s);
      showToast(`Đã cập nhật thông tin ${name}`);
    } else {
      const newStudent: Student = {
        id: `hs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name,
        gender,
        studentCode: studentCode || `${activeClass.name}${String(activeClass.students.length + 1).padStart(2, '0')}`,
        dob,
        role,
        group,
        parentName,
        parentPhone,
        parentZalo: parentPhone,
        notes,
        conduct,
        grades: { oral: [], fifteenMin: [], onePeriod: [] }
      };
      updatedStudents = [...activeClass.students, newStudent];
      showToast(`Đã thêm học sinh ${name}`);
    }

    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, students: updatedStudents } : c);
    saveClasses(updatedClasses);
    setShowStudentModal(false);
    setEditingStudent(null);
  };

  const handleDeleteStudent = (studentId: string, name: string) => {
    if (!activeClass || !confirm(`Xóa học sinh ${name} khỏi danh sách lớp?`)) return;
    const updatedStudents = activeClass.students.filter(s => s.id !== studentId);
    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, students: updatedStudents } : c);
    saveClasses(updatedClasses);
    showToast(`Đã xóa học sinh ${name}`);
  };

  // ── Handlers: Bulk Import Students ────────────────────────────────────────
  const handleBulkImport = () => {
    if (!activeClass || !bulkImportText.trim()) return;
    const lines = bulkImportText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const newStudents: Student[] = [];
    const startIndex = activeClass.students.length + 1;

    lines.forEach((line, idx) => {
      let name = line;
      let gender: 'male' | 'female' = 'male';
      let phone = '';

      if (line.includes('\t') || line.includes(',') || line.includes(';')) {
        const parts = line.split(/[\t,;]/).map(p => p.trim());
        name = parts[0] || '';
        if (parts[1] && (parts[1].toLowerCase().includes('nữ') || parts[1].toLowerCase() === 'f')) {
          gender = 'female';
        }
        phone = parts[2] || '';
      } else {
        if (line.toLowerCase().includes('(nữ)') || line.toLowerCase().includes('(nu)')) {
          gender = 'female';
          name = line.replace(/\((nữ|nu)\)/i, '').trim();
        }
      }

      if (name) {
        newStudents.push({
          id: `hs-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          name,
          gender,
          studentCode: `${activeClass.name}${String(startIndex + idx).padStart(2, '0')}`,
          role: 'member',
          parentPhone: phone,
          parentZalo: phone,
          conduct: 'Tốt',
          grades: { oral: [], fifteenMin: [], onePeriod: [] }
        });
      }
    });

    const updatedClasses = classes.map(c => c.id === activeClass.id ? {
      ...c,
      students: [...c.students, ...newStudents]
    } : c);

    saveClasses(updatedClasses);
    setShowBulkImportModal(false);
    setBulkImportText('');
    showToast(`Đã thêm thành công ${newStudents.length} học sinh vào lớp ${activeClass.name}`);
  };

  // ── Handlers: Attendance ──────────────────────────────────────────────────
  const toggleAttendanceStatus = (studentId: string) => {
    if (!activeClass) return;
    const currentStatus = currentAttendance?.statuses[studentId] || 'present';
    const statusCycle: AttendanceStatus[] = ['present', 'late', 'excused', 'unexcused'];
    const nextIndex = (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];

    const updatedStatuses = { ...(currentAttendance?.statuses || {}), [studentId]: nextStatus };
    const updatedAttendanceList = [...activeClass.attendance];
    const existingIndex = updatedAttendanceList.findIndex(a => a.date === selectedAttendanceDate && (a.period ?? 1) === selectedAttendancePeriod);

    if (existingIndex >= 0) {
      updatedAttendanceList[existingIndex] = {
        ...updatedAttendanceList[existingIndex],
        statuses: updatedStatuses
      };
    } else {
      updatedAttendanceList.push({
        date: selectedAttendanceDate,
        period: selectedAttendancePeriod,
        statuses: updatedStatuses,
        notes: {}
      });
    }

    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, attendance: updatedAttendanceList } : c);
    saveClasses(updatedClasses);
  };

  const markAllAttendancePresent = () => {
    if (!activeClass) return;
    const allPresentStatuses: Record<string, AttendanceStatus> = {};
    activeClass.students.forEach(s => {
      allPresentStatuses[s.id] = 'present';
    });

    const updatedAttendanceList = [...activeClass.attendance];
    const existingIndex = updatedAttendanceList.findIndex(a => a.date === selectedAttendanceDate && (a.period ?? 1) === selectedAttendancePeriod);

    if (existingIndex >= 0) {
      updatedAttendanceList[existingIndex] = {
        ...updatedAttendanceList[existingIndex],
        statuses: allPresentStatuses
      };
    } else {
      updatedAttendanceList.push({
        date: selectedAttendanceDate,
        period: selectedAttendancePeriod,
        statuses: allPresentStatuses,
        notes: {}
      });
    }

    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, attendance: updatedAttendanceList } : c);
    saveClasses(updatedClasses);
    showToast(`Đã điểm danh tất cả ${activeClass.students.length} học sinh Có mặt`);
  };

  const updateAttendanceNote = (studentId: string, note: string) => {
    if (!activeClass) return;
    const updatedNotes = { ...(currentAttendance?.notes || {}), [studentId]: note };
    const updatedAttendanceList = [...activeClass.attendance];
    const existingIndex = updatedAttendanceList.findIndex(a => a.date === selectedAttendanceDate && (a.period ?? 1) === selectedAttendancePeriod);

    if (existingIndex >= 0) {
      updatedAttendanceList[existingIndex] = {
        ...updatedAttendanceList[existingIndex],
        notes: updatedNotes
      };
    } else {
      updatedAttendanceList.push({
        date: selectedAttendanceDate,
        period: selectedAttendancePeriod,
        statuses: currentAttendance?.statuses || {},
        notes: updatedNotes
      });
    }

    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, attendance: updatedAttendanceList } : c);
    saveClasses(updatedClasses);
  };

  // ── Handlers: Grade Changes ───────────────────────────────────────────────
  const handleGradeChange = (studentId: string, gradeType: keyof StudentGrades, valStr: string, index?: number) => {
    if (!activeClass) return;
    const num = valStr === '' ? undefined : Number(valStr);
    if (num !== undefined && (isNaN(num) || num < 0 || num > 10)) return;

    const updatedStudents = activeClass.students.map(s => {
      if (s.id !== studentId) return s;
      const currentGrades = { ...(s.grades || {}) };

      if (gradeType === 'finalExam') {
        currentGrades.finalExam = num;
      } else {
        const arr = [...(currentGrades[gradeType] || [])];
        if (index !== undefined) {
          if (num === undefined) {
            arr.splice(index, 1);
          } else {
            arr[index] = num;
          }
        } else if (num !== undefined) {
          arr.push(num);
        }
        currentGrades[gradeType] = arr;
      }
      return { ...s, grades: currentGrades };
    });

    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, students: updatedStudents } : c);
    saveClasses(updatedClasses);
  };

  // ── Handlers: Discipline / Homeroom Records ────────────────────────────────
  const handleAddDisciplineRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass || !selectedStudentForDisc) return;
    const student = activeClass.students.find(s => s.id === selectedStudentForDisc);
    if (!student) return;

    const newRecord: DisciplineRecord = {
      id: `disc-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      date: new Date().toISOString().split('T')[0],
      type: discType,
      category: discCategory,
      score: discType === 'praise' ? Math.abs(discScore) : -Math.abs(discScore),
      notes: discNotes
    };

    const updatedRecords = [newRecord, ...(activeClass.disciplineRecords || [])];
    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, disciplineRecords: updatedRecords } : c);
    saveClasses(updatedClasses);
    setShowDisciplineModal(false);
    setDiscNotes('');
    showToast(`Đã ghi nhận ${discType === 'praise' ? 'khen thưởng' : 'vi phạm'} cho ${student.name}`);
  };

  const handleDeleteDiscipline = (discId: string) => {
    if (!activeClass || !confirm('Xóa ghi chép nề nếp này?')) return;
    const updatedRecords = activeClass.disciplineRecords.filter(d => d.id !== discId);
    const updatedClasses = classes.map(c => c.id === activeClass.id ? { ...c, disciplineRecords: updatedRecords } : c);
    saveClasses(updatedClasses);
    showToast('Đã xóa ghi chép');
  };

  // ── Export / Download CSV ──────────────────────────────────────────────────
  const exportStudentsToCSV = () => {
    if (!activeClass || activeClass.students.length === 0) return alert('Lớp chưa có học sinh');
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Vietnamese display
    csvContent += `DANH SÁCH HỌC SINH LỚP ${activeClass.name.toUpperCase()} - NĂM HỌC ${activeClass.schoolYear}\n`;
    csvContent += `STT,Mã HS,Họ và Tên,Giới tính,Ngày sinh,Chức vụ,Tổ,SĐT Phụ huynh,Họ tên Phụ huynh,Điểm TB tạm tính,Kết quả rèn luyện,Ghi chú\n`;

    activeClass.students.forEach((s, idx) => {
      const avg = calculateAverage(s.grades);
      const roleText = ROLE_LABELS[s.role]?.label || 'Thành viên';
      const genderText = s.gender === 'female' ? 'Nữ' : 'Nam';
      const groupText = s.group ? `Tổ ${s.group}` : '';
      csvContent += `${idx + 1},"${s.studentCode || ''}","${s.name}","${genderText}","${s.dob || ''}","${roleText}","${groupText}","${s.parentPhone || ''}","${s.parentName || ''}",${avg || ''},"${s.conduct || 'Tốt'}","${s.notes || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_sach_lop_${activeClass.name}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAttendanceToCSV = () => {
    if (!activeClass || activeClass.attendance.length === 0) return alert('Lớp chưa có dữ liệu điểm danh');
    const statusLabels: Record<AttendanceStatus, string> = {
      present: 'Có mặt', late: 'Đi muộn', excused: 'Nghỉ có phép', unexcused: 'Nghỉ không phép'
    };
    const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows: string[] = [];
    [...activeClass.attendance]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.period ?? 1) - (b.period ?? 1))
      .forEach(record => activeClass.students.forEach((student, index) => {
        const status = record.statuses[student.id] || 'present';
        rows.push([
          record.date,
          `Tiết ${record.period ?? 1}`,
          activeClass.subject || 'Chủ nhiệm',
          index + 1,
          student.studentCode || '',
          student.name,
          statusLabels[status],
          record.notes[student.id] || '',
        ].map(csvCell).join(','));
      }));

    const content = '\uFEFF' + ['Ngày', 'Tiết', 'Môn / hoạt động', 'STT', 'Mã HS', 'Họ và tên', 'Trạng thái', 'Ghi chú'].map(csvCell).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Chuyen_can_${activeClass.name}_${activeClass.schoolYear.replaceAll(' ', '')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã xuất sổ chuyên cần theo tiết');
  };

  // ── Backup / Restore JSON ──────────────────────────────────────────────────
  const exportAllDataJSON = () => {
    const dataStr = JSON.stringify(classes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lop12_quan_ly_lop_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file sao lưu dữ liệu lớp học');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveClasses(parsed);
          setActiveClassId(parsed[0].id);
          showToast(`Đã phục hồi thành công ${parsed.length} lớp học!`);
        } else {
          alert('File JSON không đúng cấu trúc dữ liệu lớp học.');
        }
      } catch (err) {
        alert('Không thể đọc file JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Navigation */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 mb-3 border border-white/10">
              <span>🏫</span> Quản Lý Lớp Học &amp; Chủ Nhiệm
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Quản lý Lớp Dạy &amp; Lớp Chủ Nhiệm
            </h1>
            <p className="text-blue-100/90 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Theo dõi danh sách học sinh, điểm danh theo tiết, sổ điểm quá trình và nề nếp thi đua lớp chủ nhiệm mọi lúc mọi nơi.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => { setEditingClass(null); setShowClassModal(true); }}
              className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Thêm Lớp Mới
            </button>

            <button
              onClick={exportAllDataJSON}
              title="Xuất file sao lưu dữ liệu toàn bộ lớp học"
              className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Sao lưu
            </button>

            <label
              title="Nhập file sao lưu dữ liệu JSON"
              className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Khôi phục
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* Quick Filter & Class Selector Bar */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-medium text-blue-200 shrink-0 mr-1">Bộ lọc:</span>
            <button
              onClick={() => setFilterClassType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${filterClassType === 'all' ? 'bg-white text-blue-900 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Tất cả ({classes.length})
            </button>
            <button
              onClick={() => setFilterClassType('homeroom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${filterClassType === 'homeroom' ? 'bg-amber-400 text-amber-950 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <span>⭐</span> Lớp Chủ Nhiệm ({classes.filter(c => c.type === 'homeroom').length})
            </button>
            <button
              onClick={() => setFilterClassType('teaching')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${filterClassType === 'teaching' ? 'bg-white text-blue-900 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <span>📚</span> Lớp Giảng Dạy ({classes.filter(c => c.type === 'teaching').length})
            </button>
          </div>

          <div className="text-xs text-blue-200 font-medium">
            Đang chọn: <strong className="text-white font-bold">{activeClass ? `${activeClass.name} (${activeClass.type === 'homeroom' ? 'Chủ nhiệm' : activeClass.subject})` : 'Chưa có lớp'}</strong>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2.5">
        <span className="text-base leading-4">🔒</span>
        <p><strong>Dữ liệu đang lưu trên trình duyệt này.</strong> Chỉ nhập thông tin cần cho công tác lớp; không lưu CCCD, hồ sơ y tế hoặc thông tin nhạy cảm. Hãy sao lưu có mã hóa và dùng hệ thống quản lý của trường khi cần chia sẻ/chính thức hóa hồ sơ.</p>
      </div>

      {/* Class Cards Slider / Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredClasses.map(c => {
          const isSelected = c.id === activeClassId;
          const isHomeroom = c.type === 'homeroom';
          const studentCount = c.students.length;

          return (
            <div
              key={c.id}
              onClick={() => setActiveClassId(c.id)}
              className={`relative rounded-2xl p-5 cursor-pointer transition-all duration-200 border text-left ${
                isSelected
                  ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-sm ${
                    isHomeroom
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-blue-600 to-indigo-600'
                  }`}>
                    {c.name}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 text-base">
                      Lớp {c.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                      {isHomeroom ? 'Lớp Chủ Nhiệm' : `Môn: ${c.subject || 'Bộ môn'}`}
                    </p>
                  </div>
                </div>

                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                  isHomeroom
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                }`}>
                  {isHomeroom ? 'Chủ nhiệm' : 'Dạy môn'}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-bold text-gray-800 dark:text-slate-200">{studentCount}</span> học sinh
                </div>
                <div>
                  <span className="font-semibold text-gray-600 dark:text-slate-300">{c.room || 'Chưa xếp phòng'}</span>
                </div>
              </div>

              {/* Edit/Delete Actions for selected */}
              {isSelected && (
                <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-blue-100 dark:border-blue-900/50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingClass(c); setShowClassModal(true); }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Sửa lớp
                  </button>
                  <span className="text-gray-300 dark:text-slate-700">|</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id, c.name); }}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Xóa
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Class Detail Area */}
      {activeClass ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          
          {/* Class Header Bar */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-900/50">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                  Lớp {activeClass.name}
                </h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  activeClass.type === 'homeroom'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                }`}>
                  {activeClass.type === 'homeroom' ? '⭐ Lớp Chủ Nhiệm' : `📚 Giảng dạy: ${activeClass.subject}`}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  Năm học {activeClass.schoolYear} ({activeClass.semester})
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {activeClass.description || 'Chưa có ghi chú mô tả'} • {activeClass.room || 'Phòng học mặc định'} • Sĩ số: <strong className="text-gray-900 dark:text-white">{activeClass.students.length} học sinh</strong>
              </p>
            </div>

            {/* Quick Action Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setEditingStudent(null); setShowStudentModal(true); }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Thêm học sinh
              </button>

              <button
                onClick={() => setShowBulkImportModal(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Nhập danh sách nhanh (Excel)
              </button>

              <button
                onClick={exportStudentsToCSV}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Xuất file Excel CSV danh sách học sinh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Xuất Excel
              </button>
            </div>
          </div>

          {/* Tab Navigation Menu */}
          <div className="px-6 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none bg-white dark:bg-slate-900">
            <button
              onClick={() => setActiveTab('roster')}
              className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'roster'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>📋</span> Danh Sách Học Sinh ({activeClass.students.length})
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'attendance'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>✅</span> Điểm Danh &amp; Chuyên Cần
            </button>

            <button
              onClick={() => setActiveTab('grades')}
              className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'grades'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>📊</span> Sổ Điểm Quá Trình
            </button>

            {activeClass.type === 'homeroom' && (
              <button
                onClick={() => setActiveTab('homeroom')}
                className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'homeroom'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>🏅</span> Nề Nếp &amp; Thi Đua Chủ Nhiệm
              </button>
            )}

            <button
              onClick={() => setActiveTab('parents')}
              className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'parents'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>📞</span> Danh Bạ Phụ Huynh
            </button>

            <button
              onClick={() => setActiveTab('tools')}
              className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'tools'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>🚀</span> Tiện Ích Giảng Dạy
            </button>
          </div>

          {/* Tab Content 1: ROSTER (DANH SÁCH HỌC SINH) */}
          {activeTab === 'roster' && (
            <div className="p-6 space-y-5">
              {studentSupportList.length > 0 && (
                <section className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/15 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-amber-900 dark:text-amber-200 text-sm">Theo dõi cần hỗ trợ</h4>
                      <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">Tín hiệu tham khảo từ chuyên cần và điểm tạm tính; giáo viên cần trao đổi với học sinh trước khi liên hệ phụ huynh.</p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-200/70 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-bold">{studentSupportList.length} học sinh</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {studentSupportList.slice(0, 6).map(item => (
                      <div key={item.student.id} className={`rounded-xl border px-3 py-2.5 ${item.priority === 'urgent' ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20' : 'border-amber-200 bg-white/80 dark:border-amber-900/50 dark:bg-slate-900/40'}`}>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{item.student.name}</p>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{item.reasons.join(' • ')}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {/* Search & Sub-filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên, mã HS, SĐT..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Lọc theo tổ:</span>
                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Tất cả các tổ</option>
                    <option value="1">Tổ 1</option>
                    <option value="2">Tổ 2</option>
                    <option value="3">Tổ 3</option>
                    <option value="4">Tổ 4</option>
                    <option value="no_group">Chưa phân tổ</option>
                  </select>
                </div>
              </div>

              {/* Students Table */}
              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-xl text-gray-400 mb-3">
                    👥
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Không tìm thấy học sinh nào</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Thử thay đổi từ khóa tìm kiếm hoặc nhấn nút "Thêm học sinh" / "Nhập danh sách nhanh".
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 font-bold text-center w-12">STT</th>
                        <th className="py-3.5 px-4 font-bold">Mã HS</th>
                        <th className="py-3.5 px-4 font-bold">Họ và Tên</th>
                        <th className="py-3.5 px-4 font-bold">Giới tính</th>
                        <th className="py-3.5 px-4 font-bold">Chức vụ / Tổ</th>
                        <th className="py-3.5 px-4 font-bold">Phụ huynh &amp; SĐT</th>
                        <th className="py-3.5 px-4 font-bold text-center">Điểm TB</th>
                        <th className="py-3.5 px-4 font-bold text-center">Rèn luyện</th>
                        <th className="py-3.5 px-4 font-bold text-right w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                      {filteredStudents.map((s, idx) => {
                        const avg = calculateAverage(s.grades);
                        const classification = getGradeClassification(avg);
                        const roleInfo = ROLE_LABELS[s.role] || ROLE_LABELS.member;

                        return (
                          <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3.5 px-4 text-center font-bold text-gray-400 text-xs">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs font-semibold text-gray-600 dark:text-slate-400">
                              {s.studentCode || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  s.gender === 'female' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                }`}>
                                  {s.name.charAt(s.name.lastIndexOf(' ') + 1) || s.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900 dark:text-white">
                                    {s.name}
                                  </div>
                                  {s.dob && (
                                    <span className="text-[11px] text-gray-400">
                                      {s.dob}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-medium">
                              {s.gender === 'female' ? (
                                <span className="text-pink-600 dark:text-pink-400 font-semibold">Nữ</span>
                              ) : (
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">Nam</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${roleInfo.badgeClass}`}>
                                  {roleInfo.label}
                                </span>
                                {s.group && (
                                  <span className="text-[11px] text-gray-400 font-medium">
                                    Tổ {s.group}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              {s.parentPhone ? (
                                <div>
                                  <div className="font-semibold text-gray-800 dark:text-slate-200">
                                    {s.parentName || 'Phụ huynh'}
                                  </div>
                                  <a
                                    href={`tel:${s.parentPhone}`}
                                    className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                                  >
                                    {s.parentPhone}
                                  </a>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">Chưa cập nhật</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {avg !== null ? (
                                <div>
                                  <span className="font-black text-sm text-gray-900 dark:text-white">{avg}</span>
                                  <div className={`text-[10px] ${classification.color}`}>{classification.label}</div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                {s.conduct || 'Tốt'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => { setEditingStudent(s); setShowStudentModal(true); }}
                                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg transition cursor-pointer"
                                  title="Chỉnh sửa học sinh"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(s.id, s.name)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                                  title="Xóa học sinh"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Content 2: ATTENDANCE (ĐIỂM DANH & CHUYÊN CẦN) */}
          {activeTab === 'attendance' && (
            <div className="p-6 space-y-6">
              {/* Date Picker & Quick Actions Bar */}
              <div className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300">Ngày điểm danh:</span>
                  <input
                    type="date"
                    value={selectedAttendanceDate}
                    onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setSelectedAttendanceDate(new Date().toISOString().split('T')[0])}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Hôm nay
                  </button>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-300">
                    Tiết:
                    <select
                      value={selectedAttendancePeriod}
                      onChange={(e) => setSelectedAttendancePeriod(Number(e.target.value))}
                      className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(period => <option key={period} value={period}>Tiết {period}</option>)}
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportAttendanceToCSV}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Xuất chuyên cần
                  </button>
                  <button
                    onClick={markAllAttendancePresent}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Đánh dấu tất cả Có Mặt
                  </button>
                </div>
              </div>

              {/* Attendance Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Có mặt</span>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{attendanceStats.present}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Đi muộn</span>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{attendanceStats.late}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">Có phép</span>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{attendanceStats.excused}</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">Không phép</span>
                  <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">{attendanceStats.unexcused}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Tỷ lệ chuyên cần</span>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{attendanceStats.rate}%</p>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold text-center w-12">STT</th>
                      <th className="py-3 px-4 font-bold">Họ và Tên</th>
                      <th className="py-3 px-4 font-bold text-center">Trạng thái điểm danh (Click đổi)</th>
                      <th className="py-3 px-4 font-bold">Ghi chú (Lý do muộn / nghỉ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {activeClass.students.map((s, idx) => {
                      const st = currentAttendance?.statuses[s.id] || 'present';
                      const note = currentAttendance?.notes[s.id] || '';

                      return (
                        <tr key={s.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 text-center text-xs font-bold text-gray-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900 dark:text-white">{s.name}</div>
                            <span className="text-[11px] text-gray-400">{s.studentCode || ''}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => toggleAttendanceStatus(s.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer ${
                                st === 'present'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : st === 'late'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : st === 'excused'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {st === 'present' && <><span>✅</span> Có mặt</>}
                              {st === 'late' && <><span>⏰</span> Đi muộn</>}
                              {st === 'excused' && <><span>📝</span> Có phép</>}
                              {st === 'unexcused' && <><span>❌</span> Không phép</>}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={note}
                              onChange={(e) => updateAttendanceNote(s.id, e.target.value)}
                              placeholder="Ghi chú lý do vắng / muộn..."
                              className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Content 3: GRADES (SỔ ĐIỂM QUÁ TRÌNH) */}
          {activeTab === 'grades' && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                <div>
                  <h4 className="font-extrabold text-blue-900 dark:text-blue-200 text-sm">
                    Điểm đánh giá môn học — {activeClass.subject || 'Môn học'}
                  </h4>
                  <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                    Tạm tính ĐTB môn: (đánh giá thường xuyên + giữa kỳ × 2 + cuối kỳ × 3) / tổng hệ số. Mức hiển thị chỉ để theo dõi, không thay thế kết quả đánh giá chính thức.
                  </p>
                </div>
                <button
                  onClick={exportStudentsToCSV}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                >
                  Xuất Bảng Điểm
                </button>
              </div>

              {/* Editable Grade Table */}
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3 font-bold text-center w-10">STT</th>
                      <th className="py-3 px-4 font-bold min-w-[160px]">Họ và Tên</th>
                      <th className="py-3 px-2 font-bold text-center w-24">ĐG thường xuyên (HS1)</th>
                      <th className="py-3 px-2 font-bold text-center w-28">ĐG thường xuyên (HS1)</th>
                      <th className="py-3 px-2 font-bold text-center w-24">Giữa kỳ (HS2)</th>
                      <th className="py-3 px-2 font-bold text-center w-24">Cuối kỳ (HS3)</th>
                      <th className="py-3 px-3 font-bold text-center w-20 bg-blue-50/50 dark:bg-blue-950/30">ĐTB</th>
                      <th className="py-3 px-3 font-bold text-center w-24">Mức tham khảo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {activeClass.students.map((s, idx) => {
                      const avg = calculateAverage(s.grades);
                      const classification = getGradeClassification(avg);
                      const oral1 = s.grades?.oral?.[0] !== undefined ? s.grades.oral[0] : '';
                      const oral2 = s.grades?.oral?.[1] !== undefined ? s.grades.oral[1] : '';
                      const p15_1 = s.grades?.fifteenMin?.[0] !== undefined ? s.grades.fifteenMin[0] : '';
                      const p15_2 = s.grades?.fifteenMin?.[1] !== undefined ? s.grades.fifteenMin[1] : '';
                      const p45 = s.grades?.onePeriod?.[0] !== undefined ? s.grades.onePeriod[0] : '';
                      const finalScore = s.grades?.finalExam !== undefined ? s.grades.finalExam : '';

                      return (
                        <tr key={s.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-center text-xs font-bold text-gray-400">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-gray-900 dark:text-white">{s.name}</td>
                          
                          {/* Miệng */}
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={oral1}
                                onChange={(e) => handleGradeChange(s.id, 'oral', e.target.value, 0)}
                                placeholder="—"
                                className="w-10 text-center py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                              />
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={oral2}
                                onChange={(e) => handleGradeChange(s.id, 'oral', e.target.value, 1)}
                                placeholder="—"
                                className="w-10 text-center py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                              />
                            </div>
                          </td>

                          {/* 15 phút */}
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={p15_1}
                                onChange={(e) => handleGradeChange(s.id, 'fifteenMin', e.target.value, 0)}
                                placeholder="—"
                                className="w-10 text-center py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                              />
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="10"
                                value={p15_2}
                                onChange={(e) => handleGradeChange(s.id, 'fifteenMin', e.target.value, 1)}
                                placeholder="—"
                                className="w-10 text-center py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                              />
                            </div>
                          </td>

                          {/* 1 Tiết */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              value={p45}
                              onChange={(e) => handleGradeChange(s.id, 'onePeriod', e.target.value, 0)}
                              placeholder="—"
                              className="w-12 text-center py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold"
                            />
                          </td>

                          {/* Học kỳ */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              value={finalScore}
                              onChange={(e) => handleGradeChange(s.id, 'finalExam', e.target.value)}
                              placeholder="—"
                              className="w-12 text-center py-1 rounded bg-blue-50/50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 text-xs font-black text-blue-600 dark:text-blue-400"
                            />
                          </td>

                          {/* ĐTB */}
                          <td className="py-2.5 px-3 text-center bg-blue-50/30 dark:bg-blue-950/20 font-black text-sm">
                            {avg !== null ? (
                              <span className="text-blue-700 dark:text-blue-300">{avg}</span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Xếp loại */}
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-xs ${classification.color}`}>{classification.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Content 4: HOMEROOM (NỀ NẾP & THI ĐUA CHỦ NHIỆM) */}
          {activeTab === 'homeroom' && activeClass.type === 'homeroom' && (
            <div className="p-6 space-y-6">
              {/* Homeroom Cadre & Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md">
                  <span className="text-xs uppercase font-bold text-amber-100">Ban cán sự lớp</span>
                  <div className="mt-3 space-y-1.5 text-xs font-medium">
                    <p>• <strong>Lớp trưởng:</strong> {activeClass.students.find(s => s.role === 'leader')?.name || 'Chưa phân công'}</p>
                    <p>• <strong>Lớp phó học tập:</strong> {activeClass.students.find(s => s.role === 'deputy_study')?.name || 'Chưa phân công'}</p>
                    <p>• <strong>Lớp phó nề nếp:</strong> {activeClass.students.find(s => s.role === 'deputy_discipline')?.name || 'Chưa phân công'}</p>
                    <p>• <strong>Bí thư chi đoàn:</strong> {activeClass.students.find(s => s.role === 'secretary')?.name || 'Chưa phân công'}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 md:col-span-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-gray-900 dark:text-white text-base">
                        Sổ Theo Dõi Nề Nếp &amp; Khen Thưởng / Vi Phạm
                      </h4>
                      <button
                        onClick={() => {
                          if (activeClass.students.length > 0) {
                            setSelectedStudentForDisc(activeClass.students[0].id);
                            setShowDisciplineModal(true);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>+</span> Ghi nhận nề nếp
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Ghi nhận các điểm cộng phát biểu, giải bài tập hoặc các lỗi vi phạm như đi muộn, không làm bài tập để tổng hợp minh chứng rèn luyện cuối kỳ.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      👍 {activeClass.disciplineRecords.filter(d => d.type === 'praise').length} Lượt khen thưởng
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      ⚠️ {activeClass.disciplineRecords.filter(d => d.type === 'violation').length} Lượt vi phạm
                    </span>
                  </div>
                </div>
              </div>

              {/* Discipline Records List */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">Nhật ký nề nếp gần đây</h4>
                {activeClass.disciplineRecords.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-gray-400 text-xs">
                    Chưa có ghi chép nề nếp nào cho lớp này. Nhấn "Ghi nhận nề nếp" để thêm.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-slate-800 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                    {activeClass.disciplineRecords.map(rec => (
                      <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                            rec.type === 'praise' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          }`}>
                            {rec.type === 'praise' ? `+${rec.score}` : `${rec.score}`}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white text-sm">{rec.studentName}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                rec.type === 'praise' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {rec.category}
                              </span>
                              <span className="text-xs text-gray-400">{rec.date}</span>
                            </div>
                            {rec.notes && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{rec.notes}</p>}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDiscipline(rec.id)}
                          className="text-gray-400 hover:text-rose-600 p-1.5 transition cursor-pointer"
                          title="Xóa ghi chép"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content 5: PARENTS DIRECTORY (DANH BẠ PHỤ HUYNH) */}
          {activeTab === 'parents' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">Danh Bạ Liên Lạc Phụ Huynh</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Tra cứu nhanh số điện thoại, mở Zalo hoặc gọi trực tiếp cho phụ huynh.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeClass.students.map(s => (
                  <div key={s.id} className="bg-gray-50/80 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        {s.name}
                        <span className="text-[11px] font-normal text-gray-400">({s.studentCode || 'HS'})</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                        Phụ huynh: <strong className="text-gray-900 dark:text-white">{s.parentName || 'Chưa cập nhật tên'}</strong>
                      </p>
                      <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                        {s.parentPhone || 'Chưa có số điện thoại'}
                      </p>
                    </div>

                    {s.parentPhone && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${s.parentPhone}`}
                          className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow transition cursor-pointer"
                          title="Gọi điện"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </a>
                        <a
                          href={`https://zalo.me/${s.parentPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow transition font-bold text-xs cursor-pointer"
                          title="Nhắn Zalo"
                        >
                          Zalo
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content 6: TOOLS SHORTCUTS (TIỆN ÍCH GIẢNG DẠY) */}
          {activeTab === 'tools' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <a
                  href="/giao-vien/boc-tham"
                  className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200 dark:border-amber-900/40 rounded-2xl hover:shadow-lg transition group text-left block"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg mb-3 shadow">
                    🎲
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition">Bốc thăm ngẫu nhiên</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Gọi tên học sinh lớp {activeClass.name} lên bảng hoặc chia nhóm thảo luận.</p>
                </a>

                <a
                  href="/giao-vien/phong-thi"
                  className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl hover:shadow-lg transition group text-left block"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg mb-3 shadow">
                    💻
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition">Phòng thi ảo Live</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Tạo phòng kiểm tra 15 phút hoặc 1 tiết cho học sinh vào thi cùng lúc.</p>
                </a>

                <a
                  href="/giao-vien/giao-bai"
                  className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/10 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl hover:shadow-lg transition group text-left block"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-lg mb-3 shadow">
                    📝
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition">Giao bài tập về nhà</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Gửi link bài tập tự luyện và theo dõi tiến độ nộp bài.</p>
                </a>

                <a
                  href="/giao-vien/phieu-bai-tap"
                  className="p-5 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/10 border border-teal-200 dark:border-teal-900/40 rounded-2xl hover:shadow-lg transition group text-left block"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center text-lg mb-3 shadow">
                    🖨️
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-teal-600 transition">Xuất Phiếu PDF A4</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">In phiếu bài tập phát cho học sinh làm bài trực tiếp trên lớp.</p>
                </a>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-gray-200 dark:border-slate-800">
          <p className="text-gray-500 dark:text-slate-400">Chưa có lớp học nào. Vui lòng bấm "Thêm Lớp Mới".</p>
        </div>
      )}

      {/* ── MODAL: Thêm / Sửa Lớp Học ───────────────────────────────────────── */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                {editingClass ? `Chỉnh sửa lớp ${editingClass.name}` : 'Tạo Lớp Học Mới'}
              </h3>
              <button onClick={() => setShowClassModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Tên Lớp (VD: 12A1) *</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingClass?.name || ''}
                    required
                    placeholder="12A1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Khối Lớp *</label>
                  <select
                    name="grade"
                    defaultValue={editingClass?.grade || 12}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                  >
                    <option value="12">Khối 12</option>
                    <option value="11">Khối 11</option>
                    <option value="10">Khối 10</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Phân Loại Lớp *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="teaching"
                      defaultChecked={editingClass ? editingClass.type === 'teaching' : true}
                      className="text-blue-600"
                    />
                    <div className="text-xs">
                      <strong className="block text-gray-900 dark:text-white">Lớp Giảng Dạy</strong>
                      <span className="text-gray-500 text-[11px]">Dạy bộ môn</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="homeroom"
                      defaultChecked={editingClass?.type === 'homeroom'}
                      className="text-amber-600"
                    />
                    <div className="text-xs">
                      <strong className="block text-amber-900 dark:text-amber-200">⭐ Lớp Chủ Nhiệm</strong>
                      <span className="text-amber-700/80 dark:text-amber-300/80 text-[11px]">Quản lý nề nếp, sổ liên lạc</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Môn Phụ Trách</label>
                  <input
                    type="text"
                    name="subject"
                    defaultValue={editingClass?.subject || 'Toán học'}
                    placeholder="Toán học, Vật lí..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-semibold text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Năm Học</label>
                  <input
                    type="text"
                    name="schoolYear"
                    defaultValue={editingClass?.schoolYear || '2025 - 2026'}
                    placeholder="2025 - 2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-semibold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Học Kỳ</label>
                  <select
                    name="semester"
                    defaultValue={editingClass?.semester || 'HK2'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    <option value="HK1">Học kỳ 1</option>
                    <option value="HK2">Học kỳ 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Phòng Học</label>
                  <input
                    type="text"
                    name="room"
                    defaultValue={editingClass?.room || ''}
                    placeholder="Phòng 301 - Nhà A"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Mô Tả / Ghi Chú</label>
                <textarea
                  name="description"
                  defaultValue={editingClass?.description || ''}
                  rows={2}
                  placeholder="Ghi chú về lớp học..."
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  {editingClass ? 'Lưu Thay Đổi' : 'Tạo Lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Thêm / Sửa Học Sinh ─────────────────────────────────────── */}
      {showStudentModal && activeClass && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                {editingStudent ? `Sửa Thông Tin: ${editingStudent.name}` : `Thêm Học Sinh Vào Lớp ${activeClass.name}`}
              </h3>
              <button onClick={() => setShowStudentModal(false)} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Họ và Tên *</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingStudent?.name || ''}
                    required
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Giới Tính</label>
                  <select
                    name="gender"
                    defaultValue={editingStudent?.gender || 'male'}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Mã Học Sinh</label>
                  <input
                    type="text"
                    name="studentCode"
                    defaultValue={editingStudent?.studentCode || ''}
                    placeholder={`${activeClass.name}01`}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Ngày Sinh</label>
                  <input
                    type="date"
                    name="dob"
                    defaultValue={editingStudent?.dob || '2008-01-01'}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Chức Vụ</label>
                  <select
                    name="role"
                    defaultValue={editingStudent?.role || 'member'}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 font-semibold text-gray-900 dark:text-white"
                  >
                    <option value="member">Thành viên</option>
                    <option value="leader">Lớp trưởng</option>
                    <option value="deputy_study">Lớp phó học tập</option>
                    <option value="deputy_discipline">Lớp phó nề nếp</option>
                    <option value="secretary">Bí thư Chi đoàn</option>
                    <option value="group_leader">Tổ trưởng</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Tổ Học Tập</label>
                  <select
                    name="group"
                    defaultValue={editingStudent?.group || ''}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 font-semibold text-gray-900 dark:text-white"
                  >
                    <option value="">Chưa phân tổ</option>
                    <option value="1">Tổ 1</option>
                    <option value="2">Tổ 2</option>
                    <option value="3">Tổ 3</option>
                    <option value="4">Tổ 4</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Họ Tên Phụ Huynh</label>
                  <input
                    type="text"
                    name="parentName"
                    defaultValue={editingStudent?.parentName || ''}
                    placeholder="Nguyễn Văn B"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">SĐT Phụ Huynh / Zalo</label>
                  <input
                    type="tel"
                    name="parentPhone"
                    defaultValue={editingStudent?.parentPhone || ''}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Ghi Chú Học Sinh</label>
                <input
                  type="text"
                  name="notes"
                  defaultValue={editingStudent?.notes || ''}
                  placeholder="Học tốt hình học, cán bộ gương mẫu..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg cursor-pointer"
                >
                  {editingStudent ? 'Lưu Thay Đổi' : 'Thêm Vào Lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Nhập Danh Sách Hàng Loạt (Paste Text / CSV) ─────────────── */}
      {showBulkImportModal && activeClass && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-xl w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>📋</span> Nhập Danh Sách Học Sinh Nhanh ({activeClass.name})
              </h3>
              <button onClick={() => setShowBulkImportModal(false)} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Sao chép từ bảng Excel hoặc dán danh sách học sinh vào khung bên dưới. Mỗi dòng một học sinh.
              </p>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <p>💡 <strong>Ví dụ các định dạng được hỗ trợ:</strong></p>
                <p>• Dán cột tên: <code>Nguyễn Hoàng An</code></p>
                <p>• Ghi chú nữ: <code>Trần Thị Bích (Nữ)</code></p>
                <p>• Tab hoặc dấu phẩy từ Excel: <code>Lê Thùy Dung, Nữ, 0903123456</code></p>
              </div>

              <textarea
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                rows={8}
                placeholder={"Dán danh sách học sinh vào đây...\nNguyễn Văn A\nTrần Thị B (Nữ)\nLê Văn C"}
                className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              ></textarea>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500">
                  Ước tính: <strong className="text-blue-600 dark:text-blue-400">{bulkImportText.split('\n').filter(l => l.trim()).length}</strong> học sinh
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkImportModal(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
                  >
                    Thêm Hàng Loạt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Ghi Nhận Nề Nếp / Khen Thưởng ────────────────────────────── */}
      {showDisciplineModal && activeClass && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Ghi Nhận Nề Nếp Thi Đua
              </h3>
              <button onClick={() => setShowDisciplineModal(false)} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDisciplineRecord} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Chọn Học Sinh *</label>
                <select
                  value={selectedStudentForDisc}
                  onChange={(e) => setSelectedStudentForDisc(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                >
                  {activeClass.students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.studentCode || 'HS'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Loại Ghi Nhận *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setDiscType('praise'); setDiscCategory('Phát biểu bài'); setDiscScore(2); }}
                    className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      discType === 'praise'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <span>👍</span> Khen Thưởng (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDiscType('violation'); setDiscCategory('Đi học muộn'); setDiscScore(-2); }}
                    className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      discType === 'violation'
                        ? 'bg-rose-100 text-rose-800 border-rose-400 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <span>⚠️</span> Vi Phạm (-)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Hành Vi / Lý Do</label>
                  <input
                    type="text"
                    value={discCategory}
                    onChange={(e) => setDiscCategory(e.target.value)}
                    placeholder="Phát biểu, đi muộn..."
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Điểm Thi Đua (±)</label>
                  <input
                    type="number"
                    value={discScore}
                    onChange={(e) => setDiscScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Chi Tiết Ghi Chú</label>
                <textarea
                  value={discNotes}
                  onChange={(e) => setDiscNotes(e.target.value)}
                  rows={2}
                  placeholder="Ghi chú hoàn cảnh hoặc lý do cụ thể..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDisciplineModal(false)}
                  className="px-4 py-2 font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg cursor-pointer"
                >
                  Lưu Ghi Nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
