'use client';

import React, { useMemo } from 'react';
import styles from './ShiftBandFrame.module.css';

export default function ShiftBandFrame({
  startHour = 9,
  endHour = 22,
  lanes = 2,
  hourWidth = 80,
  boardHeight = 90 * lanes,
  gutterWidth = 72,
  labels = [],
  // bands: [{ lane, work:{start,end}, breaks:[{start,end}, ...] }]
  bands = [],
}) {
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const fmt = (h) => {
    const m = Math.round(h * 60);
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const hourToX = (h) => (h - startHour) * hourWidth;
  const laneHeight = boardHeight / lanes;
  const laneTop = (i) => i * laneHeight;

  return (
    <div
      className={styles.wrap}
      style={{
        '--hourWidth': `${hourWidth}px`,
        '--gutterWidth': `${gutterWidth}px`,
        '--boardHeight': `${boardHeight}px`,
        '--laneCount': lanes,
      }}
    >
      {/* 上の時間目盛り */}
      <div className={styles.timeHeader}>
        <div className={styles.gutter} />
        <div className={styles.timeScale}>
          {hours.map((h) => (
            <div key={h} className={styles.tick}>
              <span className={styles.tickLabel}>{fmt(h)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 本体 */}
      <div className={styles.boardRow}>
        {/* 左ラベル欄 */}
        <div className={styles.gutter}>
          {Array.from({ length: lanes }).map((_, i) => (
            <div key={i} className={styles.laneLabel}>
              {labels[i] ?? `Lane ${i + 1}`}
            </div>
          ))}
        </div>

        {/* 盤面 */}
        <div className={styles.board}>
          <div className={styles.gridBg} />
          {bands.map((b, idx) => {
            if (!b?.work) return null;
            const top = laneTop(b.lane) + 6;
            const h = laneHeight - 12;

            // 勤務帯
            const wl = hourToX(b.work.start);
            const ww = hourToX(b.work.end) - hourToX(b.work.start);

            return (
              <React.Fragment key={idx}>
                <div
                  className={styles.workBand}
                  style={{ left: wl, width: ww, top, height: h }}
                  aria-label={`${labels[b.lane] ?? `Lane ${b.lane+1}`} ${fmt(b.work.start)}-${fmt(b.work.end)}`}
                >
                  <span className={styles.bandLabel}>
                    {fmt(b.work.start)} - {fmt(b.work.end)}
                  </span>
                </div>

                {/* 休憩帯（複数可） */}
                {(b.breaks ?? []).map((br, i2) => {
                  const bl = hourToX(br.start);
                  const bw = hourToX(br.end) - hourToX(br.start);
                  // 見やすく勤務帯の中段に重ねる
                  const brTop = top + Math.max(4, h * 0.5 - 12);
                  const brH = Math.max(16, h * 0.45);
                  return (
                    <div
                      key={`${idx}-${i2}`}
                      className={styles.breakBand}
                      style={{ left: bl, width: bw, top: brTop, height: brH }}
                      aria-label={`休憩 ${fmt(br.start)}-${fmt(br.end)}`}
                    >
                      <span className={styles.breakLabel}>
                        休憩 {fmt(br.start)} - {fmt(br.end)}
                      </span>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
