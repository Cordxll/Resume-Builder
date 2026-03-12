import ExcelJS from 'exceljs';
import { TailoringSession, ApplicationStatus } from '../types/storage';
import { StoredResume, StoredJobDescription } from '../types/storage';
import { sessionDB, jobDescriptionDB } from './db';

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

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function getCellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    // CellHyperlinkValue: { text, hyperlink }
    if ('text' in v && typeof (v as { text: unknown }).text === 'string') {
      return String((v as { text: string }).text).trim();
    }
    // CellRichTextValue: { richText: RichText[] }
    if ('richText' in v && Array.isArray((v as ExcelJS.CellRichTextValue).richText)) {
      return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text ?? '').join('').trim();
    }
  }
  return String(v);
}

function getCellDate(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v) return new Date(v).toISOString();
  return '';
}

const VALID_STATUSES: ApplicationStatus[] = [
  'saved', 'applied', 'phone-screen', 'interview-1', 'interview-2',
  'interview-3', 'take-home', 'offered', 'accepted', 'rejected', 'withdrawn', 'none',
];

function parseStatus(raw: string): ApplicationStatus {
  const lower = raw.toLowerCase() as ApplicationStatus;
  return VALID_STATUSES.includes(lower) ? lower : 'none';
}

export async function importFromExcel(file: File): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const appSheet = workbook.getWorksheet('Applications');
  if (!appSheet) {
    return { imported: 0, updated: 0, skipped: 0, errors: ['No "Applications" sheet found in file'] };
  }

  // Build header → column-index map (case-insensitive)
  const headerRow = appSheet.getRow(1);
  const colMap: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const name = getCellString(cell).toLowerCase();
    if (name) colMap[name] = colNumber;
  });

  const col = (name: string): number => colMap[name.toLowerCase()] ?? -1;

  // Load existing sessions and job descriptions
  const [existingSessions, existingJDs] = await Promise.all([
    sessionDB.getAll(),
    jobDescriptionDB.getAll(),
  ]);

  // Build a lookup map: "title|company" → { session, jd }
  const jdById = new Map<string, StoredJobDescription>(existingJDs.map((jd) => [jd.id, jd]));

  // For matching: build map of "lower(title)|lower(company)" → session
  interface SessionMatch {
    session: TailoringSession;
    jd: StoredJobDescription;
  }
  const sessionMatchMap = new Map<string, SessionMatch>();
  for (const session of existingSessions) {
    const jd = jdById.get(session.jobDescriptionId);
    if (jd) {
      const key = `${(jd.title ?? '').toLowerCase()}|${(jd.company ?? '').toLowerCase()}`;
      sessionMatchMap.set(key, { session, jd });
    }
  }

  // Track new JDs created during import for interview sheet lookup
  const importedJDMap = new Map<string, StoredJobDescription>(); // "lower(title)|lower(company)" → jd
  // Also populate with existing
  for (const [key, { jd }] of sessionMatchMap.entries()) {
    importedJDMap.set(key, jd);
  }

  // Process application rows (row 2+)
  const sessionByKey = new Map<string, TailoringSession>();
  // Pre-populate from existing
  for (const [key, { session }] of sessionMatchMap.entries()) {
    sessionByKey.set(key, session);
  }

  appSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const jobTitle = col('job title') > 0 ? getCellString(row.getCell(col('job title'))) : '';
    if (!jobTitle) {
      result.skipped++;
      return;
    }

    const company = col('company') > 0 ? getCellString(row.getCell(col('company'))) : '';
    const matchKey = `${jobTitle.toLowerCase()}|${company.toLowerCase()}`;

    const applicationUrl = col('job url') > 0 ? getCellString(row.getCell(col('job url'))) : '';
    const statusRaw = col('status') > 0 ? getCellString(row.getCell(col('status'))) : '';
    const status = parseStatus(statusRaw);
    const appliedDate = col('applied date') > 0 ? getCellDate(row.getCell(col('applied date'))) : '';
    const appliedVia = col('applied via') > 0 ? getCellString(row.getCell(col('applied via'))) : '';
    const salary = col('salary') > 0 ? getCellString(row.getCell(col('salary'))) : '';
    const tagsRaw = col('tags') > 0 ? getCellString(row.getCell(col('tags'))) : '';
    const tags = tagsRaw ? tagsRaw.split(/,\s*/).filter(Boolean) : [];
    const contactName = col('contact') > 0 ? getCellString(row.getCell(col('contact'))) : '';
    const contactEmail = col('contact email') > 0 ? getCellString(row.getCell(col('contact email'))) : '';
    const notes = col('notes') > 0 ? getCellString(row.getCell(col('notes'))) : '';
    const nextFollowUp = col('next follow-up') > 0 ? getCellDate(row.getCell(col('next follow-up'))) : '';

    const existing = sessionMatchMap.get(matchKey);

    if (existing) {
      // Update only tracking and applicationStatus
      const updatedSession: TailoringSession = {
        ...existing.session,
        applicationStatus: status,
        appliedAt: appliedDate || existing.session.appliedAt,
        tracking: {
          ...existing.session.tracking,
          interviews: existing.session.tracking?.interviews ?? [],
          applicationUrl: applicationUrl || existing.session.tracking?.applicationUrl,
          appliedVia: appliedVia || existing.session.tracking?.appliedVia,
          contactName: contactName || existing.session.tracking?.contactName,
          contactEmail: contactEmail || existing.session.tracking?.contactEmail,
          salary: salary || existing.session.tracking?.salary,
          notes: notes || existing.session.tracking?.notes,
          nextFollowUp: nextFollowUp || existing.session.tracking?.nextFollowUp,
          tags: tags.length > 0 ? tags : existing.session.tracking?.tags,
        },
        updatedAt: new Date().toISOString(),
      };
      sessionDB.save(updatedSession);
      sessionByKey.set(matchKey, updatedSession);
      result.updated++;
    } else {
      // Create new minimal session
      const newJD: StoredJobDescription = {
        id: crypto.randomUUID(),
        title: jobTitle,
        company: company,
        content: '',
        createdAt: new Date().toISOString(),
      };

      const newSession: TailoringSession = {
        id: crypto.randomUUID(),
        jobDescriptionId: newJD.id,
        resumeId: '',
        tailoredData: {
          summary: { original: '', tailored: '', explanation: '' },
          skills: { original: '', tailored: '', explanation: '' },
          jobs: [],
          sections: [],
        },
        acceptedChanges: { summary: false, experience: false, skills: false },
        chatHistory: [],
        status: 'active',
        applicationStatus: status,
        appliedAt: appliedDate || undefined,
        tracking: {
          applicationUrl: applicationUrl || undefined,
          appliedVia: appliedVia || undefined,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          salary: salary || undefined,
          notes: notes || undefined,
          interviews: [],
          nextFollowUp: nextFollowUp || undefined,
          tags: tags.length > 0 ? tags : undefined,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      jobDescriptionDB.save(newJD);
      sessionDB.save(newSession);
      importedJDMap.set(matchKey, newJD);
      sessionByKey.set(matchKey, newSession);
      result.imported++;
    }
  });

  // Process Interviews sheet if it exists
  const intSheet = workbook.getWorksheet('Interviews');
  if (intSheet) {
    const intHeaderRow = intSheet.getRow(1);
    const intColMap: Record<string, number> = {};
    intHeaderRow.eachCell((cell, colNumber) => {
      const name = getCellString(cell).toLowerCase();
      if (name) intColMap[name] = colNumber;
    });

    const ic = (name: string): number => intColMap[name.toLowerCase()] ?? -1;

    intSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const jobTitle = ic('job title') > 0 ? getCellString(row.getCell(ic('job title'))) : '';
      if (!jobTitle) return;

      const company = ic('company') > 0 ? getCellString(row.getCell(ic('company'))) : '';
      const matchKey = `${jobTitle.toLowerCase()}|${company.toLowerCase()}`;

      const session = sessionByKey.get(matchKey);
      if (!session) return;

      const roundStr = ic('round') > 0 ? getCellString(row.getCell(ic('round'))) : '';
      const roundNum = parseInt(roundStr, 10);
      if (isNaN(roundNum)) return;

      // Don't duplicate rounds with the same round number
      const interviews = session.tracking?.interviews ?? [];
      if (interviews.some((i) => i.round === roundNum)) return;

      const typeRaw = ic('type') > 0 ? getCellString(row.getCell(ic('type'))) : '';
      const validTypes = ['phone', 'technical', 'behavioral', 'system-design', 'hiring-manager', 'panel', 'other'];
      const interviewType = validTypes.includes(typeRaw) ? typeRaw as import('../types/storage').InterviewRound['type'] : 'other';

      const interviewDate = ic('date') > 0 ? getCellDate(row.getCell(ic('date'))) : '';
      const interviewerName = ic('interviewer') > 0 ? getCellString(row.getCell(ic('interviewer'))) : '';
      const outcomeRaw = ic('outcome') > 0 ? getCellString(row.getCell(ic('outcome'))) : '';
      const validOutcomes = ['passed', 'failed', 'pending', 'cancelled'];
      const outcome = validOutcomes.includes(outcomeRaw) ? outcomeRaw as import('../types/storage').InterviewRound['outcome'] : undefined;
      const intNotes = ic('notes') > 0 ? getCellString(row.getCell(ic('notes'))) : '';

      const newRound: import('../types/storage').InterviewRound = {
        round: roundNum,
        type: interviewType,
        date: interviewDate || undefined,
        interviewerName: interviewerName || undefined,
        outcome,
        notes: intNotes || undefined,
      };

      const updatedSession: TailoringSession = {
        ...session,
        tracking: {
          ...session.tracking,
          interviews: [...interviews, newRound],
        },
        updatedAt: new Date().toISOString(),
      };

      sessionDB.save(updatedSession);
      sessionByKey.set(matchKey, updatedSession);
    });
  }

  return result;
}
