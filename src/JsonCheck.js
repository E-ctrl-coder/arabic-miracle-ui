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
        // 1) Total entries
        const count = Array.isArray(data)
          ? data.length
          : Object.keys(data || {}).length;
        console.log('Total entries:', count);

        // 2) Check key existence for known verses
        const testIds = ['002056', '001001', '114001'];
        testIds.forEach(id => {
          const entry = Array.isArray(data)
            ? data.find(item => item.verse === Number(id.slice(-3)))
            : data[id];
          console.log(`Entry for ${id}:`, entry ? 'FOUND' : 'MISSING');
        });

        // 3) Sample object shape
        let sample;
        if (Array.isArray(data) && data.length) {
          sample = data[0];
        } else if (data && typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          sample = data[firstKey]?.[0];
        }
        console.log(
          'Sample object keys:',
          sample ? Object.keys(sample) : 'none'
        );

        // 4) Simple sanity checks
        const segments = Array.isArray(data)
          ? data
          : Object.values(data).flat();

        const malformed = [];
        segments.forEach(seg => {
          const { sura, aya, surface } = seg;

          // catch NaN or undefined keys
          if (!Number.isFinite(sura) || !Number.isFinite(aya)) {
            malformed.push(`Invalid key → ${sura}|${aya}`);
          }

          // catch empty surface text
          if (!surface || surface.toString().trim() === '') {
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
