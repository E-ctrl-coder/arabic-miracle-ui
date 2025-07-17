// src/App.jsx
import React, { useState } from 'react'
import './index.css'

export default function App() {
  const [word, setWord] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')

  async function handleAnalyze() {
    setError('')
    setResults([])

    const w = word.trim()
    if (!w) {
      setError('Please enter an Arabic word')
      return
    }

    try {
      const res = await fetch('https://arabic-miracle-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      })

      let data
      try {
        data = await res.json()
      } catch {
        setError('Server returned invalid JSON')
        return
      }

      if (!res.ok) {
        setError(data.error || `Server error ${res.status}`)
        return
      }

      setResults(Array.isArray(data) ? data : [data])

    } catch (e) {
      setError('Network error: ' + e.message)
    }
  }

  return (
    <div className="App p-8 bg-gray-50" dir="rtl">
      <h1 className="text-2xl mb-4">محلل الصرف العربي</h1>

      <div className="flex items-center mb-4">
        <input
          type="text"
          value={word}
          onChange={e => setWord(e.target.value)}
          placeholder="أدخل كلمة عربية"
          className="border p-2 w-64"
        />
        <button
          onClick={handleAnalyze}
          className="ml-4 bg-blue-600 text-white p-2 rounded"
        >
          تحليل
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {results.map((r, idx) => (
        <div key={idx} className="mb-6 border p-4 rounded bg-white">
          {/* المصدر */}
          <p className="text-sm text-gray-600 mb-2">
            <strong>المصدر:</strong> {r['المصدر']}
          </p>

          {/* Nemlar branch */}
          {'الكلمة' in r && (
            <>
              <p><strong>الكلمة:</strong> {r['الكلمة']}</p>

              <p><strong>التقسيمات:</strong></p>
              <p className="text-xl mb-2">
                {(r['التقسيمات'] || []).map((seg, i) => (
                  <span key={i} className={`segment-${seg.type}`}>
                    {seg.text}
                  </span>
                ))}
              </p>

              <p><strong>الجذر:</strong> {r['الجذر']}</p>
              <p><strong>الوزن:</strong> {r['الوزن']}</p>
              <p><strong>عدد مرات الجذر:</strong> {r['عدد مرات الجذر']}</p>

              {r['نماذج الآيات']?.length > 0 && (
                <>
                  <h4 className="mt-4">نماذج الآيات:</h4>
                  <ol className="list-decimal list-inside">
                    {r['نماذج الآيات'].map((v, i) => (
                      <li key={i}>
                        <strong>آية {v['معرف الجملة']}:</strong> {v['نص الآية']}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}

          {/* MASAQ branch */}
          {'الكلمة بدون تشكيل' in r && (
            <>
              <p><strong>الكلمة بدون تشكيل:</strong> {r['الكلمة بدون تشكيل']}</p>
              <p><strong>الكلمة المقسمة:</strong> {r['الكلمة المقسمة']}</p>
              <p><strong>المعنى:</strong> {r['المعنى']}</p>
              <p><strong>علامة الصرف:</strong> {r['علامة الصرف']}</p>
              <p><strong>نوع الكلمة:</strong> {r['نوع الكلمة']}</p>
              <p><strong>الدور النحوي:</strong> {r['الدور النحوي']}</p>
              <p>
                <strong>الموقع في القرآن:</strong> 
                آية {r['السورة']}:{r['الآية']}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
