import ExcelJS from 'exceljs';
import { TailoringSession } from '../types/storage';
import { StoredResume, StoredJobDescription } from '../types/storage';

interface SessionBundle {
  session: TailoringSession;
  resume: StoredResume | null;
  jobDescription: StoredJobDescription | null;
}

export async function exportToExcel(bundles: SessionBundle[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // ─── Sheet 1: Applications ───────────────────────────────────────────────
  const appSheet = workbook.addWorksheet('Applications');

  const appHeaders = [
    'Job Title',
    'Company',
    'Job URL',
    'Status',
    'Applied Date',
    'Applied Via',
    'Resume Used',
    'Salary',
    'Tags',
    'Contact',
    'Contact Email',
    'Notes',
    'Next Follow-up',
    'Interview Count',
    'Last Updated',
    'Created',
  ];

  appSheet.addRow(appHeaders);

  // Style header row
  const appHeaderRow = appSheet.getRow(1);
  appHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Track max content lengths per column for auto-width
  const appColWidths: number[] = appHeaders.map((h) => h.length);

  // Date column indices (1-based): Applied Date=5, Next Follow-up=13, Last Updated=15, Created=16
  const appDateCols = new Set([5, 13, 15, 16]);

  for (const bundle of bundles) {
    const { session, resume, jobDescription } = bundle;
    const appliedDate = session.appliedAt ? new Date(session.appliedAt) : '';
    const nextFollowUp = session.tracking?.nextFollowUp ? new Date(session.tracking.nextFollowUp) : '';
    const updatedAt = session.updatedAt ? new Date(session.updatedAt) : '';
    const createdAt = session.createdAt ? new Date(session.createdAt) : '';

    const rowValues = [
      jobDescription?.title ?? '',
      jobDescription?.company ?? '',
      session.tracking?.applicationUrl ?? '',
      session.applicationStatus ?? 'none',
      appliedDate,
      session.tracking?.appliedVia ?? '',
      resume?.name ?? '',
      session.tracking?.salary ?? '',
      session.tracking?.tags?.join(', ') ?? '',
      session.tracking?.contactName ?? '',
      session.tracking?.contactEmail ?? '',
      session.tracking?.notes ?? '',
      nextFollowUp,
      session.tracking?.interviews?.length ?? 0,
      updatedAt,
      createdAt,
    ];

    appSheet.addRow(rowValues);

    // Update max widths
    rowValues.forEach((val, i) => {
      const str = val instanceof Date ? val.toISOString().slice(0, 10) : String(val);
      if (str.length > appColWidths[i]) {
        appColWidths[i] = str.length;
      }
    });
  }

  // Apply date format to date columns (skip header row)
  for (let rowIdx = 2; rowIdx <= appSheet.rowCount; rowIdx++) {
    appDateCols.forEach((colIdx) => {
      const cell = appSheet.getCell(rowIdx, colIdx);
      if (cell.value instanceof Date) {
        cell.numFmt = 'yyyy-mm-dd';
      }
    });
  }

  // Status color-coding (column D = index 4, rows 2+)
  for (let rowIdx = 2; rowIdx <= appSheet.rowCount; rowIdx++) {
    const statusCell = appSheet.getCell(rowIdx, 4);
    const status = String(statusCell.value ?? '');

    let bgColor: string | null = null;
    let textColor = 'FFFFFFFF';

    if (status === 'offered' || status === 'accepted') {
      bgColor = 'FF16A34A';
    } else if (status === 'rejected' || status === 'withdrawn') {
      bgColor = 'FFDC2626';
    } else if (
      status === 'interview-1' ||
      status === 'interview-2' ||
      status === 'interview-3' ||
      status === 'phone-screen' ||
      status === 'take-home'
    ) {
      bgColor = 'FF2563EB';
    } else if (status === 'applied') {
      bgColor = 'FFEAB308';
      textColor = 'FF000000';
    }

    if (bgColor) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      statusCell.font = { color: { argb: textColor } };
    }
  }

  // Set column widths
  appSheet.columns.forEach((col, i) => {
    col.width = Math.min(50, Math.max(10, appColWidths[i] + 2));
  });

  // Freeze top row
  appSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ─── Sheet 2: Interviews ─────────────────────────────────────────────────
  const intSheet = workbook.addWorksheet('Interviews');

  const intHeaders = [
    'Job Title',
    'Company',
    'Round',
    'Type',
    'Date',
    'Interviewer',
    'Outcome',
    'Notes',
  ];

  intSheet.addRow(intHeaders);

  // Style header row
  const intHeaderRow = intSheet.getRow(1);
  intHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const intColWidths: number[] = intHeaders.map((h) => h.length);

  // Date column index for Interviews sheet (1-based): Date=5
  const intDateCol = 5;

  for (const bundle of bundles) {
    const { session, jobDescription } = bundle;
    const interviews = session.tracking?.interviews;
    if (!interviews || interviews.length === 0) continue;

    const jobTitle = jobDescription?.title ?? '';
    const company = jobDescription?.company ?? '';

    for (const interview of interviews) {
      const interviewDate = interview.date ? new Date(interview.date) : '';

      const rowValues = [
        jobTitle,
        company,
        interview.round,
        interview.type,
        interviewDate,
        interview.interviewerName ?? '',
        interview.outcome ?? '',
        interview.notes ?? '',
      ];

      intSheet.addRow(rowValues);

      rowValues.forEach((val, i) => {
        const str = val instanceof Date ? val.toISOString().slice(0, 10) : String(val);
        if (str.length > intColWidths[i]) {
          intColWidths[i] = str.length;
        }
      });
    }
  }

  // Apply date format to date column in Interviews sheet (skip header row)
  for (let rowIdx = 2; rowIdx <= intSheet.rowCount; rowIdx++) {
    const cell = intSheet.getCell(rowIdx, intDateCol);
    if (cell.value instanceof Date) {
      cell.numFmt = 'yyyy-mm-dd';
    }
  }

  // Set column widths
  intSheet.columns.forEach((col, i) => {
    col.width = Math.min(50, Math.max(10, intColWidths[i] + 2));
  });

  // Freeze top row
  intSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ─── Download ─────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
