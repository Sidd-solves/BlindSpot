import { describe, expect, it } from 'vitest';
import { ingest, IngestError } from '@blindspot/analytics';
import { completeReport } from '../apps/web/src/store';

/** Files that are not sales exports must give a clear message, never a crash or a misleading "pick a column". */
const read = (name: string, text: string) => {
  try {
    ingest([{ name, text }], {});
    return { code: 'OK', message: '', report: null as any };
  } catch (e: any) {
    expect(e).toBeInstanceOf(IngestError);
    return { code: e.code as string, message: e.message as string, report: e.report };
  }
};

describe('junk uploads', () => {
  it('JSON and web pages are named for what they are', () => {
    expect(read('data.json', '{"orders":[{"id":1,"total":5}]}').code).toBe('NOT_A_TABLE');
    expect(read('export.csv', '[{"id":1}]').message).toMatch(/JSON data file/);
    expect(read('page.html', '<html><body><h1>Hi</h1></body></html>').message).toMatch(/web page/);
    expect(read('x.txt', '<!DOCTYPE html><html></html>').code).toBe('NOT_A_TABLE');
  });
  it('a letter or notes say there are no amounts, not "pick a money column"', () => {
    const r = read('letter.txt', 'Dear Sam,\nThanks for today.\nLets talk next week.\nBest,\nAlex\n');
    expect(['NOT_SALES', 'NO_AMOUNTS']).toContain(r.code);
    expect(r.message).not.toMatch(/Pick it below/);
  });
  it('class notes exported to PDF (page headers and page numbers) are not a sales table', () => {
    const text =
      'Notes 2.12--Logarithmic Properties.notebook\tNovember 06, 2026\n1\nNotes 2.12--Logarithmic Properties.notebook\tNovember 06, 2026\n2\nNotes 2.12--Logarithmic Properties.notebook\tNovember 06, 2026\nApr 12-9:37 AM\nApr 12-9:39 AM\t3\nNotes 2.12--Logarithmic Properties.notebook\tNovember 06, 2026\n4\n';
    const r = read('Notes 2.12 day 2.pdf', text);
    expect(r.code).not.toBe('OK');
    expect(r.message).not.toMatch(/Pick it below/);
  });
  it('random bytes are not a sales table', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 255;
    const junk = Array.from({ length: 3000 }, () => String.fromCharCode(32 + Math.floor(rnd() % 90))).join(
      '',
    );
    const r = read('garbage.csv', junk.replace(/(.{60})/g, '$1\n'));
    expect(r.code).not.toBe('OK');
    expect(r.message.length).toBeGreaterThan(20);
  });
  it('a list of names with no numbers keeps its columns so an amounts file can be added', () => {
    const r = read('people.csv', 'Name,Notes\nBob,likes cats\nAmy,blue car\nRaj,red bike\n');
    expect(r.message).not.toMatch(/Pick it below/);
  });
  it('empty and header-only files explain themselves', () => {
    expect(read('empty.csv', '').code).toBe('EMPTY');
    expect(read('h.csv', 'Date,Customer,Amount\n').code).toBe('TOO_FEW_ROWS');
  });
  it('a two-column European file with decimal commas still reads (semicolon, not comma)', () => {
    const r = ingest(
      [{ name: 'eu.csv', text: 'Date;Total\n01.02.2026;12,50\n02.02.2026;8,00\n03.02.2026;19,90\n' }],
      {},
    );
    expect(r.report.roles.amount).toBe('Total');
    expect(r.dataset.rows.length).toBe(3);
  });
});

describe('review screen never crashes on a partial report', () => {
  it('fills every section the screen reads', () => {
    const c = completeReport({
      files: [{ name: 'notes.pdf' }],
      format: 'PDF report',
      columns: ['Notes'],
      roles: {},
    })!;
    expect(c.confidence).toEqual({});
    expect(c.samples).toEqual({});
    expect(c.issues).toEqual([]);
    expect(c.unlocks).toEqual([]);
    expect(completeReport({ confidence: null, roles: null })!.roles).toEqual({});
    expect(completeReport(null)).toBeNull();
  });
});
