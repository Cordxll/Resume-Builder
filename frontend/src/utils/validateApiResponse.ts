import { ParsedResume, TailoredData } from '../types';

const PREFIX = '[API Contract]';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a TailoredData response from the API.
 * Logs structured warnings for any missing/invalid fields.
 * Returns the data unchanged (warnings are non-blocking).
 */
export function validateTailoredData(data: unknown, source = 'api'): TailoredData {
  const label = `TailoredData (${source})`;

  if (!isObject(data)) {
    console.warn(
      `${PREFIX} ${label}: expected an object but got ${data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data}`
    );
    return {
      original: { summary: '', experience: [], skills: '' },
      tailored: { summary: '', experience: [], skills: '' },
      changes: { summary: [], experience: [], skills: [] },
    };
  }

  const typed = data as Record<string, unknown>;

  // Validate "original" block
  if (!isObject(typed.original)) {
    console.warn(`${PREFIX} ${label}: missing or invalid field "original" (got ${typed.original === undefined ? 'undefined' : typeof typed.original})`);
  } else {
    const orig = typed.original as Record<string, unknown>;
    if (typeof orig.summary !== 'string') {
      console.warn(`${PREFIX} ${label}: original.summary is not a string (got ${orig.summary === undefined ? 'undefined' : typeof orig.summary})`);
    }
    if (!Array.isArray(orig.experience)) {
      console.warn(`${PREFIX} ${label}: original.experience is not an array (got ${orig.experience === undefined ? 'undefined' : typeof orig.experience})`);
    }
    if (typeof orig.skills !== 'string') {
      console.warn(`${PREFIX} ${label}: original.skills is not a string (got ${orig.skills === undefined ? 'undefined' : typeof orig.skills})`);
    }
  }

  // Validate "tailored" block
  if (!isObject(typed.tailored)) {
    console.warn(`${PREFIX} ${label}: missing or invalid field "tailored" (got ${typed.tailored === undefined ? 'undefined' : typeof typed.tailored})`);
  } else {
    const tail = typed.tailored as Record<string, unknown>;
    if (typeof tail.summary !== 'string') {
      console.warn(`${PREFIX} ${label}: tailored.summary is not a string (got ${tail.summary === undefined ? 'undefined' : typeof tail.summary})`);
    }
    if (!Array.isArray(tail.experience)) {
      console.warn(`${PREFIX} ${label}: tailored.experience is not an array (got ${tail.experience === undefined ? 'undefined' : typeof tail.experience})`);
    }
    if (typeof tail.skills !== 'string') {
      console.warn(`${PREFIX} ${label}: tailored.skills is not a string (got ${tail.skills === undefined ? 'undefined' : typeof tail.skills})`);
    }
  }

  // Validate "changes" block
  if (!isObject(typed.changes)) {
    console.warn(`${PREFIX} ${label}: missing or invalid field "changes" (got ${typed.changes === undefined ? 'undefined' : typeof typed.changes})`);
  } else {
    const changes = typed.changes as Record<string, unknown>;
    if (!Array.isArray(changes.summary)) {
      console.warn(`${PREFIX} ${label}: changes.summary is not an array (got ${changes.summary === undefined ? 'undefined' : typeof changes.summary})`);
    }
    if (!Array.isArray(changes.experience)) {
      console.warn(`${PREFIX} ${label}: changes.experience is not an array (got ${changes.experience === undefined ? 'undefined' : typeof changes.experience})`);
    }
    if (!Array.isArray(changes.skills)) {
      console.warn(`${PREFIX} ${label}: changes.skills is not an array (got ${changes.skills === undefined ? 'undefined' : typeof changes.skills})`);
    }
  }

  return data as unknown as TailoredData;
}

/**
 * Validates a ParsedResume response from the API.
 * Logs structured warnings for any missing/invalid fields.
 * Returns the data unchanged (warnings are non-blocking).
 */
export function validateParsedResume(data: unknown, source = 'api'): ParsedResume {
  const label = `ParsedResume (${source})`;

  if (!isObject(data)) {
    console.warn(
      `${PREFIX} ${label}: expected an object but got ${data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data}`
    );
    return {};
  }

  const typed = data as Record<string, unknown>;

  // Validate optional contact block if present
  if (typed.contact !== undefined) {
    if (!isObject(typed.contact)) {
      console.warn(`${PREFIX} ${label}: "contact" is not an object (got ${typeof typed.contact})`);
    } else {
      const contact = typed.contact as Record<string, unknown>;
      for (const field of ['name', 'email', 'phone', 'linkedin'] as const) {
        if (contact[field] !== undefined && typeof contact[field] !== 'string') {
          console.warn(`${PREFIX} ${label}: contact.${field} is not a string (got ${typeof contact[field]})`);
        }
      }
    }
  }

  // Validate optional ResumeSection fields
  const sectionFields = ['summary', 'experience', 'education', 'skills', 'certifications', 'projects'] as const;
  for (const field of sectionFields) {
    const section = typed[field];
    if (section !== undefined) {
      if (!isObject(section)) {
        console.warn(`${PREFIX} ${label}: "${field}" is not an object (got ${typeof section})`);
      } else {
        const sec = section as Record<string, unknown>;
        if (typeof sec.content !== 'string') {
          console.warn(`${PREFIX} ${label}: missing field "${field}.content" (got ${sec.content === undefined ? 'undefined' : typeof sec.content})`);
        }
        if (sec.bullets !== undefined && !Array.isArray(sec.bullets)) {
          console.warn(`${PREFIX} ${label}: "${field}.bullets" is not an array (got ${typeof sec.bullets})`);
        }
      }
    }
  }

  if (typed.raw_text !== undefined && typeof typed.raw_text !== 'string') {
    console.warn(`${PREFIX} ${label}: "raw_text" is not a string (got ${typeof typed.raw_text})`);
  }

  return data as ParsedResume;
}
