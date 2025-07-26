import { useEffect } from 'react';

export default function JsonCheck() {
  useEffect(() => {
    fetch('/quran-qac.json')
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        console.log('QAC fetch status:', r.status);
        console.log('Content-Type:', r.headers.get('content-type'));
        return r.json();
      })
      .then(data => {
        // ─── flatten into segments array ────────────────────────────────────
        const segments = Array.isArray(data)
          ? data
          : Object.values(data).reduce((acc, arr) => acc.concat(arr), []);

        // ─── basic info ─────────────────────────────────────────────────────
        console.log('Total segments:', segments.length);
        console.log(
          'Sample segment keys:',
          segments[0] ? Object.keys(segments[0]) : 'none'
        );

        // ─── test a few known verses by sura|aya ────────────────────────────
        const testIds = ['002056', '001001', '114001'];
        testIds.forEach(id => {
          const sura = parseInt(id.slice(0, 3), 10);
          const aya = parseInt(id.slice(3), 10);
          const found = segments.find(
            seg => seg.sura === sura && seg.aya === aya
          );
          console.log(`QAC entry for ${id}:`, found ? 'FOUND' : 'MISSING');
        });

        // ─── sanity checks ──────────────────────────────────────────────────
        const malformed = [];
        segments.forEach(seg => {
          const { sura, aya, surface } = seg;

          if (!Number.isFinite(sura) || !Number.isFinite(aya)) {
            malformed.push(`Invalid key → ${sura}|${aya}`);
          }
          if (!surface || !surface.toString().trim()) {
            malformed.push(`Empty surface → ${sura}|${aya}`);
          }
        });

        console.log(
          `Sanity check: ${malformed.length} malformed segments found`
        );
        malformed.slice(0, 10).forEach(msg => console.warn(msg));
      })
      .catch(err => console.error('JsonCheck error:', err));
  }, []);

  return null;
}
