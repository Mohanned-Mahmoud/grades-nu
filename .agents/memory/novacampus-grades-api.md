---
name: NovaCampus grades API structure
description: Data shape of POST /Students/Grades and the correct extraction path for course grades
---

## Grades endpoint

`POST /PowerCampusSelfService/Students/Grades` with body `{termPeriodId}` returns a double-encoded JSON string. After `parsePortalJson()` (which handles double-decode):

```json
{
  "status": true,
  "data": {
    "city": "Cairo",
    "institutionName": "Nile University",
    "sequences": [{"value": "001", "description": "001"}],
    "transcriptSequences": [
      {
        "sequenceNumber": "001",
        "sessions": [
          {
            "courses": [
              {
                "eventId": "AIS431",
                "name": "Intelligent Decision Support Systems",
                "section": "01",
                "sectionId": 69499,
                "credits": "3.00",
                "finalGrade": "",
                "midtermGrade": "",
                "qualityPoints": "0.00",
                "subType": "Lecture"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Key:** courses are at `data.transcriptSequences[n].sessions[m].courses`.

Each course appears twice — once as Lab (credits "0.00") and once as Lecture (credits "3.00"). Deduplicate by `eventId`, keeping the entry with the highest numeric credits.

**Why:** The `data` field looks like transcript address data (city, country, institutionName...) at first glance. The actual grade list is deeply nested inside `transcriptSequences[0].sessions[0].courses`.

**How to apply:** In `extractCoursesFromGradesData()` in `artifacts/api-server/src/routes/grades.ts`, iterate all transcriptSequences and their sessions, collect all courses, then deduplicate by eventId keeping highest credits.

## Period endpoint

`GET /PowerCampusSelfService/Periods/GradeReport/` returns `{status:true, data:[{value:"1056", description:"2026/Spring"},...]}`

Redirects (3xx) on expired session — use as session validity check.

## What does NOT have grade data

- `POST /Layout/InitialLoadData` with `{idModule:"Grades",idPage:"GradeReport"}` — returns nav/layout/permissions data only
- `GET /Layout/Resources/Grades/GradeReport` — returns UI label strings only

## Auto-reauth

Sessions are in-memory on the API server (cleared on restart). Auto-reauth is implemented:
- Dashboard detects 401 → calls `silentReauth()` → reads credentials from SecureStore → calls `/api/grades/login` → gets new session → invalidates query → refetch
- This is transparent to the user (shows "Reconnecting..." spinner briefly)
