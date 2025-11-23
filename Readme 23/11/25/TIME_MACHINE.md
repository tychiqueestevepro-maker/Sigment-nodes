# 🕰️ Time Machine Feature - Complete Guide

The **Time Machine** is SIGMENT's most powerful feature for strategic decision-making. It allows the Board to understand **the origin and evolution** of any problem by traveling back in time through cluster snapshots.

---

## 🎯 What Problem Does This Solve?

**Traditional Problem**: Executives see a report about "Parking Issues" with 50 complaints, but they don't know:
- When did this problem start?
- How did it evolve?
- Who were the first people to raise it?
- What was the severity at different points in time?

**SIGMENT Solution**: The Time Machine shows the complete history with AI-generated snapshots at each stage.

---

## 🏗️ Architecture Overview

### Data Flow

```
1. Employee creates note → AI processes → Assigns to cluster
2. Cluster updated → Trigger snapshot creation
3. Snapshot stored with:
   - AI synthesis (executive summary at that moment)
   - Evidence (all notes contributing to this version)
   - Metrics (department breakdown, avg impact, etc.)
   - Timestamp
```

### Database Structure

```sql
clusters
├── id
├── title
└── last_updated_at

cluster_snapshots (The History)
├── id
├── cluster_id (FK)
├── synthesis_text (AI summary at this point in time)
├── metrics_json (Stats: {"IT": 10, "Sales": 2})
├── included_note_ids (Which notes were in this version)
└── created_at (When this snapshot was taken)

notes (The Evidence)
├── id
├── cluster_id
├── content_clarified
└── ai_relevance_score
```

---

## 🚀 Implementation Complete

### ✅ Part 1: Backend API

**Endpoint**: `GET /api/v1/board/cluster/{cluster_id}/history`

**What it returns**:
```json
{
  "cluster": {
    "id": "uuid...",
    "title": "Parking Issues",
    "pillar": "Operations",
    "note_count": 15,
    "avg_impact": 7.5,
    "created_at": "2025-11-20T...",
    "last_updated_at": "2025-11-23T..."
  },
  "snapshots": [
    {
      "id": "snapshot-1",
      "synthesis": "Initial concerns about parking...",
      "evidence": [
        {
          "id": "note-1",
          "content": "Parking lot is always full",
          "relevance_score": 6,
          "author": {
            "full_name": "John Doe",
            "job_title": "Senior Developer",
            "department": "IT"
          }
        }
      ],
      "timestamp": "2025-11-20T10:00:00Z"
    },
    {
      "id": "snapshot-2",
      "synthesis": "Parking issue escalating, multiple departments affected...",
      "evidence": [...],
      "timestamp": "2025-11-21T15:30:00Z"
    }
  ]
}
```

**Files Modified**:
- ✅ `backend/app/api/routes/board.py` - New route added

---

### ✅ Part 2: Frontend Detail Page

**Route**: `/dashboard/cluster/[id]`

**Components**:
1. **Header** - Cluster title, pillar, impact score, note count
2. **Time Travel Banner** - Appears when viewing historical snapshots
3. **Executive Summary** - AI-generated synthesis (changes with slider)
4. **Evidence Section** - All notes from that snapshot with author info
5. **Metrics Panel** - Department breakdown, relevance scores
6. **Time Machine Slider** - The core feature

**Files Created**:
- ✅ `frontend/app/dashboard/cluster/[id]/page.tsx` - Full detail view

---

### ✅ Part 3: Clickable Priority List

**What Changed**:
- Cards in "Top Priorities" are now wrapped in `<Link>` components
- Clicking any cluster navigates to its detail page
- Hover effects enhanced (title turns purple on hover)

**Files Modified**:
- ✅ `frontend/components/dashboard/PriorityList.tsx` - Added navigation

---

## 🧪 How to Test

### Prerequisites

Ensure all services are running:
```bash
# Terminal 1: Redis
docker-compose up

# Terminal 2: Celery Worker
cd backend && source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info

# Terminal 3: FastAPI Backend
cd backend && source venv/bin/activate
uvicorn main:app --reload

# Terminal 4: Next.js Frontend
cd frontend
npm run dev
```

---

### Test Scenario: "Coffee Machine Problem"

#### Step 1: Create the First Note (Day 1)
1. Go to **http://localhost:3000**
2. Type: `"The coffee in the break room is terrible"`
3. Click "Send"
4. Wait 10 seconds (AI processing)

#### Step 2: Check the Dashboard
1. Go to **http://localhost:3000/dashboard**
2. You should see a new cluster appear (e.g., "Office Amenity Quality")
3. Click on it in the Priority List

#### Step 3: View the Detail (Should have 1 snapshot)
- You'll see:
  - 1 snapshot (no slider yet)
  - The AI synthesis
  - 1 piece of evidence (your note)

#### Step 4: Create More Notes (Day 2)
1. Go back to **http://localhost:3000**
2. Add: `"Can we get better coffee machines?"`
3. Add: `"The current coffee is undrinkable"`
4. Wait for processing

#### Step 5: Return to Cluster Detail
1. Refresh the detail page
2. **Now you should see the Time Machine slider!**
3. It will have 2+ snapshots

#### Step 6: Use the Time Machine
1. Move the slider to the LEFT (earliest snapshot)
   - Synthesis shows: "Initial complaint about coffee quality"
   - Evidence: 1 note
2. Move the slider to the RIGHT (latest snapshot)
   - Synthesis shows: "Growing concern about break room amenities, multiple employees affected"
   - Evidence: 3 notes

---

## 🎨 Visual Features

### Time Travel Banner
When viewing a historical snapshot, a **yellow banner** appears:
```
🕰️ You're viewing a historical snapshot
This is how the cluster looked on November 20, 2025
[Jump to Present] ← Button
```

### Time Machine Slider
- **Left side**: "Origin" (when the problem started)
- **Middle**: Selected snapshot date
- **Right side**: "Present" (latest state)

### Evidence Cards
Each note shows:
- Content (clarified by AI)
- Author job title + department
- Relevance score (impact weight)

---

## 🔍 Use Cases for the Board

### Use Case 1: Root Cause Analysis
**Question**: "When did the parking issue start?"
**Action**: Move slider to the first snapshot
**Result**: See the original 2 notes from November 15

### Use Case 2: Escalation Detection
**Question**: "How did this go from 2 notes to 50?"
**Action**: Move slider through time, watch note count increase
**Result**: Identify the moment it became critical (e.g., when Finance department joined the conversation)

### Use Case 3: Priority Justification
**Question**: "Why is this a high-priority item?"
**Action**: View evidence section
**Result**: See that Senior Leadership (high relevance scores) are raising concerns

### Use Case 4: Department Impact
**Question**: "Which departments are most affected?"
**Action**: Check metrics panel
**Result**: See breakdown: {"IT": 12, "Sales": 8, "HR": 5}

---

## 🛠️ Troubleshooting

### Problem: No slider appears
**Cause**: Cluster has only 1 snapshot
**Solution**: Create more notes to trigger new snapshots

### Problem: Clicking cluster does nothing
**Cause**: Link not properly imported
**Solution**: Verify `frontend/components/dashboard/PriorityList.tsx` has `import Link from "next/link"`

### Problem: "Cluster not found" error
**Cause**: Invalid cluster ID or backend not running
**Solution**: 
```bash
# Test API directly
curl http://localhost:8000/api/v1/board/cluster/YOUR-CLUSTER-ID/history
```

### Problem: Evidence section is empty
**Cause**: `included_note_ids` is empty in snapshot
**Solution**: Check Celery worker logs for snapshot creation errors

---

## 📊 Performance Optimization

### Current Implementation
- Snapshots are created after EVERY cluster update
- Each snapshot stores a copy of the synthesis

### Future Improvements
1. **Throttling**: Create snapshots max once per hour
2. **Compression**: Store only diffs between snapshots
3. **Lazy Loading**: Load snapshots on-demand as slider moves
4. **Caching**: Cache frequently accessed clusters

---

## 🚀 Next Steps (Optional Enhancements)

### 1. Animated Transitions
When moving the slider, animate the text changes:
```typescript
<motion.div
  key={currentSnapshot.id}
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
>
  {currentSnapshot.synthesis}
</motion.div>
```

### 2. Comparison View
Show side-by-side comparison of two snapshots:
```
[Snapshot A]  vs  [Snapshot B]
```

### 3. Export Timeline
Generate a PDF report of the cluster's evolution.

### 4. Playback Mode
Auto-play the slider like a video:
```
▶️ Play Timeline [=======>    ] 70%
```

### 5. Department Filter
Filter evidence by department in the slider view.

---

## ✅ Success Criteria

You've successfully implemented the Time Machine when:

- [ ] Backend endpoint returns cluster history
- [ ] Detail page loads without errors
- [ ] Slider appears when multiple snapshots exist
- [ ] Moving slider updates synthesis and evidence
- [ ] Time Travel banner appears for historical views
- [ ] "Jump to Present" button works
- [ ] Clicking clusters in Priority List navigates to detail page
- [ ] Evidence cards show author information
- [ ] Metrics panel displays correctly

---

## 📝 Code Files Summary

### Backend (Python FastAPI)
```
backend/app/api/routes/board.py
└── @router.get("/cluster/{cluster_id}/history")
    ├── Fetches cluster info
    ├── Gets all snapshots ordered by time
    ├── Enriches each snapshot with evidence (notes)
    └── Returns complete history object
```

### Frontend (Next.js)
```
frontend/app/dashboard/cluster/[id]/page.tsx
├── useQuery to fetch cluster history
├── useState for slider position
├── Time Machine Slider component
├── Evidence cards with author info
└── Time Travel Banner (when viewing history)

frontend/components/dashboard/PriorityList.tsx
└── <Link href="/dashboard/cluster/{id}"> wrapper
```

---

## 🎯 Business Value

**For Employees**:
- Transparency (see how their feedback contributes)

**For Board**:
- **Root Cause Analysis** (when did this start?)
- **Trend Identification** (is this getting worse?)
- **Priority Justification** (why should we care?)
- **Department Insights** (who's most affected?)

**ROI**:
- Reduce time spent in meetings asking "how did we get here?"
- Data-driven decision making (not gut feeling)
- Early intervention (catch problems before they escalate)

---

🎉 **The Time Machine is now fully operational!** 

Try it out:
1. Go to http://localhost:3000/dashboard
2. Click on any cluster in the Top Priorities list
3. Use the slider to travel through time! 🕰️

