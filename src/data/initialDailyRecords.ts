import { DailyWorkRecord } from '../types';
import { calculateDailyWorkRecord } from '../utils/calc';

// Function to generate sample initial daily records
export function generateInitialDailyWorkRecords(): DailyWorkRecord[] {
  const records: DailyWorkRecord[] = [];

  // 1. 陳志豪 (慶) - emp-1
  // Target: 30 days, total_minutes = 16706 (278時26分)
  // Specific days:
  // Day 1: 09:14~15:13 (359m) + 17:11~21:26 (255m) = 614m (10時14分)
  // Day 2: 09:00~16:26 = 446m (7時26分)
  // Day 3: 09:00~19:40 = 640m (10時40分)
  // Day 4: 08:46~20:00 = 674m (11時14分)
  const qingSpecific = [
    { day: 1, c1: '09:14', o1: '15:13', c2: '17:11', o2: '21:26' }, // 614
    { day: 2, c1: '09:00', o1: '16:26', c2: '', o2: '' }, // 446
    { day: 3, c1: '09:00', o1: '19:40', c2: '', o2: '' }, // 640
    { day: 4, c1: '08:46', o1: '20:00', c2: '', o2: '' }, // 674
  ];

  // Remaining 26 days total = 16706 - (614 + 446 + 640 + 674) = 16706 - 2374 = 14332 minutes
  // 14332 / 26 ≈ 551 minutes per day (~9 hours 11 mins)
  let qingSum = 0;
  for (let d = 1; d <= 30; d++) {
    const dayStr = String(d).padStart(2, '0');
    const work_date = `2026-08-${dayStr}`;
    const spec = qingSpecific.find((s) => s.day === d);

    if (spec) {
      const rec = calculateDailyWorkRecord({
        record_id: `rec-emp1-${d}`,
        employee_id: 'emp-1',
        work_date,
        clock_in_1: spec.c1,
        clock_out_1: spec.o1,
        clock_in_2: spec.c2,
        clock_out_2: spec.o2,
        verification_status: 'verified',
        source: 'photo_ai',
      });
      qingSum += rec.total_minutes;
      records.push(rec);
    } else {
      // Allocate to reach exactly 16706 total
      // For day 30, adjust exactly
      const remainingNeeded = 16706 - qingSum;
      const daysLeft = 30 - d + 1;
      let targetM = Math.floor(remainingNeeded / daysLeft);
      if (d === 30) {
        targetM = remainingNeeded;
      }

      // Convert targetM to shift hours e.g. 09:00 to 09:00 + targetM
      const startM = 9 * 60; // 09:00
      const endM = startM + targetM;
      const startH = String(Math.floor(startM / 60)).padStart(2, '0');
      const startMin = String(startM % 60).padStart(2, '0');
      const endH = String(Math.floor(endM / 60) % 24).padStart(2, '0');
      const endMin = String(endM % 60).padStart(2, '0');

      const rec = calculateDailyWorkRecord({
        record_id: `rec-emp1-${d}`,
        employee_id: 'emp-1',
        work_date,
        clock_in_1: `${startH}:${startMin}`,
        clock_out_1: `${endH}:${endMin}`,
        clock_in_2: '',
        clock_out_2: '',
        verification_status: 'verified',
        source: 'photo_ai',
      });
      qingSum += rec.total_minutes;
      records.push(rec);
    }
  }

  // 2. 林雅婷 (ANH) - emp-2
  // Target: 26 days, total_minutes = 13300 (221時40分), 2 pending records
  let anhSum = 0;
  for (let d = 1; d <= 26; d++) {
    const dayStr = String(d).padStart(2, '0');
    const work_date = `2026-08-${dayStr}`;
    const remainingNeeded = 13300 - anhSum;
    const daysLeft = 26 - d + 1;
    let targetM = d === 26 ? remainingNeeded : Math.floor(remainingNeeded / daysLeft);

    const startM = 8 * 60 + 30; // 08:30
    const endM = startM + targetM;
    const startH = String(Math.floor(startM / 60)).padStart(2, '0');
    const startMin = String(startM % 60).padStart(2, '0');
    const endH = String(Math.floor(endM / 60) % 24).padStart(2, '0');
    const endMin = String(endM % 60).padStart(2, '0');

    // Make all records verified by default
    const status = 'verified';

    const rec = calculateDailyWorkRecord({
      record_id: `rec-emp2-${d}`,
      employee_id: 'emp-2',
      work_date,
      clock_in_1: `${startH}:${startMin}`,
      clock_out_1: `${endH}:${endMin}`,
      clock_in_2: '',
      clock_out_2: '',
      verification_status: status,
      source: 'photo_ai',
    });
    anhSum += rec.total_minutes;
    records.push(rec);
  }

  // 3. 張偉傑 (HOA) - emp-3
  // Target: 25 days, total_minutes = 12552 (209時12分), 0 pending
  let hoaSum = 0;
  for (let d = 1; d <= 25; d++) {
    const dayStr = String(d).padStart(2, '0');
    const work_date = `2026-08-${dayStr}`;
    const remainingNeeded = 12552 - hoaSum;
    const daysLeft = 25 - d + 1;
    let targetM = d === 25 ? remainingNeeded : Math.floor(remainingNeeded / daysLeft);

    const startM = 12 * 60; // 12:00
    const endM = startM + targetM;
    const startH = String(Math.floor(startM / 60)).padStart(2, '0');
    const startMin = String(startM % 60).padStart(2, '0');
    const endH = String(Math.floor(endM / 60) % 24).padStart(2, '0');
    const endMin = String(endM % 60).padStart(2, '0');

    const rec = calculateDailyWorkRecord({
      record_id: `rec-emp3-${d}`,
      employee_id: 'emp-3',
      work_date,
      clock_in_1: `${startH}:${startMin}`,
      clock_out_1: `${endH}:${endMin}`,
      clock_in_2: '',
      clock_out_2: '',
      verification_status: 'verified',
      source: 'photo_ai',
    });
    hoaSum += rec.total_minutes;
    records.push(rec);
  }

  // 4. 許家瑋 (瑋) - emp-4
  // Target: 18 days
  for (let d = 1; d <= 18; d++) {
    const dayStr = String(d).padStart(2, '0');
    const work_date = `2026-08-${dayStr}`;
    const rec = calculateDailyWorkRecord({
      record_id: `rec-emp4-${d}`,
      employee_id: 'emp-4',
      work_date,
      clock_in_1: '18:00',
      clock_out_1: '23:00',
      verification_status: 'verified',
      source: 'photo_ai',
    });
    records.push(rec);
  }

  return records;
}

export const initialDailyWorkRecords: DailyWorkRecord[] = generateInitialDailyWorkRecords();
