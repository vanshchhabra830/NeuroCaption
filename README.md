# Hindi Caption Generator

A **local-first** tool that converts Hindi audio into timestamped SRT subtitles using **Whisper Large v2**, with an editable caption interface and custom word-override dictionary.

---

## Project Structure

```
autoCaption/
├── backend/          # Python FastAPI + Whisper
│   ├── main.py
│   ├── requirements.txt
│   ├── models/
│   │   └── schemas.py
│   ├── routers/
│   │   ├── transcribe.py
│   │   └── export.py
│   └── services/
│       ├── whisper_service.py
│       ├── srt_service.py
│       └── word_override_service.py
└── frontend/         # Next.js 15 + Tailwind CSS v4
    ├── app/
    │   ├── page.tsx      ← Main UI
    │   └── layout.tsx
    ├── components/
    │   ├── AudioUploader.tsx
    │   ├── SegmentEditor.tsx
    │   ├── WordOverridePanel.tsx
    │   └── ExportButton.tsx
    ├── lib/api.ts         ← API client
    └── types/index.ts     ← Shared types
```

---

## Requirements

| Tool | Version |
|---|---|
| Python | 3.9 + |
| Node.js | 18 + |
| GPU (optional) | CUDA recommended |

> **Note**: Whisper Large v2 (~3 GB) is downloaded automatically on first run.

---

## Setup & Running

### 1. Backend

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the API server
python main.py
# → Running on http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install        # already done if you came from create-next-app
npm run dev
# → Running on http://localhost:3000
```

### 3. Open the app

Navigate to **http://localhost:3000** in your browser.

---

## Usage

1. **Upload** a Hindi `.mp3`, `.wav`, or `.m4a` file (max 500 MB)
2. **Click "Generate Captions"** — Whisper transcribes the audio
3. **Edit** any segment text inline
4. **Add word overrides** (e.g. `है` → `हैं`) in the dictionary panel
5. **Export SRT** — downloads `captions.srt`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/transcribe` | Upload audio, get segments |
| POST | `/api/export` | Convert segments to SRT download |

### POST /api/transcribe
```
Content-Type: multipart/form-data
Body: file=<audio file>
```

### POST /api/export
```json
{
  "segments": [{ "id": 1, "start": 1.0, "end": 3.5, "text": "नमस्ते" }],
  "word_overrides": { "है": "हैं" }
}
```

---

## Performance Notes

- **GPU (CUDA)**: ~realtime speed for large-v2
- **CPU**: very slow — 10–25× audio duration
- **First run**: model downloads ~3 GB from the internet
