import type { TailoredData, ParsedResume } from '../types';

const PREFIX = '[API Contract]';

function warn(type: string, field: string, got: unknown) {
  const gotStr = got === undefined ? 'undefined' : JSON.stringify(got) ?? 'null';
  console.warn(`${PREFIX} ${type}: field "${field}" invalid (got ${gotStr})`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function minimalTailored(): TailoredData {
  return {
    summary: { original: '', tailored: '', explanation: '' },
    skills:  { original: '', tailored: '', explanation: '' },
    jobs: [],
    sections: [],
  };
}

export function validateTailoredData(data: unknown, source = 'api'): TailoredData {
  if (!isObject(data)) {
    console.warn(`${PREFIX} TailoredData from ${source}: expected object, got ${typeof data}. Using fallback.`);
    return minimalTailored();
  }

  const T = 'TailoredData';

  // summary
  if (!isObject(data.summary)) {
    warn(T, 'summary', data.summary);
  } else {
    for (const f of ['original', 'tailored', 'explanation'] as const) {
      if (!isString((data.summary as Record<string, unknown>)[f])) {
        warn(T, `summary.${f}`, (data.summary as Record<string, unknown>)[f]);
      }
    }
  }

  // skills
  if (!isObject(data.skills)) {
    warn(T, 'skills', data.skills);
  } else {
    for (const f of ['original', 'tailored', 'explanation'] as const) {
      if (!isString((data.skills as Record<string, unknown>)[f])) {
        warn(T, `skills.${f}`, (data.skills as Record<string, unknown>)[f]);
      }
    }
  }

  // jobs
  if (!Array.isArray(data.jobs)) {
    warn(T, 'jobs', data.jobs);
  } else {
    (data.jobs as unknown[]).forEach((job, i) => {
      if (!isObject(job)) { warn(T, `jobs[${i}]`, job); return; }
      for (const f of ['id', 'company', 'title'] as const) {
        if (!isString(job[f])) warn(T, `jobs[${i}].${f}`, job[f]);
      }
      if (!Array.isArray(job.bullets)) {
        warn(T, `jobs[${i}].bullets`, job.bullets);
      } else {
        (job.bullets as unknown[]).forEach((b, j) => {
          if (!isObject(b)) { warn(T, `jobs[${i}].bullets[${j}]`, b); return; }
          if (!isNumber(b.index)) warn(T, `jobs[${i}].bullets[${j}].index`, b.index);
          for (const f of ['original', 'tailored', 'explanation'] as const) {
            if (!isString(b[f])) warn(T, `jobs[${i}].bullets[${j}].${f}`, b[f]);
          }
        });
      }
    });
  }

  // sections
  if (!Array.isArray(data.sections)) {
    warn(T, 'sections', data.sections);
  } else {
    (data.sections as unknown[]).forEach((sec, i) => {
      if (!isObject(sec)) { warn(T, `sections[${i}]`, sec); return; }
      if (!isString(sec.sectionType)) warn(T, `sections[${i}].sectionType`, sec.sectionType);
      if (!Array.isArray(sec.entries)) warn(T, `sections[${i}].entries`, sec.entries);
    });
  }

  return data as unknown as TailoredData;
}

function minimalParsed(): ParsedResume {
  return { sections: [] };
}

export function validateParsedResume(data: unknown, source = 'api'): ParsedResume {
  if (!isObject(data)) {
    console.warn(`${PREFIX} ParsedResume from ${source}: expected object, got ${typeof data}. Using fallback.`);
    return minimalParsed();
  }

  const T = 'ParsedResume';

  if (!Array.isArray(data.sections)) {
    warn(T, 'sections', data.sections);
  } else {
    (data.sections as unknown[]).forEach((sec, i) => {
      if (!isObject(sec)) { warn(T, `sections[${i}]`, sec); return; }
      if (!isString(sec.type)) warn(T, `sections[${i}].type`, sec.type);
      if (!isString(sec.rawLabel)) warn(T, `sections[${i}].rawLabel`, sec.rawLabel);
      if (!isNumber(sec.confidence)) warn(T, `sections[${i}].confidence`, sec.confidence);
    });
  }

  return data as unknown as ParsedResume;
}
