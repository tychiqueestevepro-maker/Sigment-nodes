# 🌌 Galaxy Dashboard - Setup & Usage Guide

The Galaxy Dashboard is now fully implemented! It provides a strategic visualization of all clusters with real-time filtering and prioritization.

---

## 🚀 Quick Start

### 1. Install Dependencies

First, install the new dependency (`lucide-react`):

```bash
cd frontend
npm install lucide-react
```

### 2. Restart the Backend API (if needed)

The new `/api/v1/board/galaxy` endpoint has been added. If your API is running, restart it:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

### 3. Restart the Frontend

```bash
cd frontend
npm run dev
```

### 4. Access the Dashboard

Open your browser and navigate to:

**http://localhost:3000/dashboard**

---

## 🎯 Features Implemented

### ✅ Backend API

**Endpoint**: `GET /api/v1/board/galaxy`

**Query Parameters**:
- `min_relevance` (optional): Filter clusters by minimum impact score (0-10)
- `pillar_id` (optional): Filter clusters by specific pillar

**Response Example**:
```json
[
  {
    "id": "uuid...",
    "title": "Parking Issue Resolution",
    "pillar": "Operations",
    "pillar_id": "uuid...",
    "impact_score": 8.4,
    "volume": 12,
    "last_updated": "2025-11-23T04:38:18.698Z"
  }
]
```

**Additional Endpoint**: `GET /api/v1/board/pillars`
- Returns all available pillars for the filter dropdown

---

### ✅ Frontend Components

#### 1. **Galaxy Chart** (Scatter Plot)
- **X-Axis**: Strategic Impact Score (0-10)
- **Y-Axis**: Note Volume (count)
- **Visual**: Dynamic bubble size based on impact
- **Color Coding**: Each pillar has a unique color
  - ESG: Green
  - Innovation: Blue
  - Operations: Amber
  - Finance: Purple
  - HR: Pink
  - Tech: Cyan
- **Interactive Tooltip**: Hover to see cluster details

#### 2. **Filter Bar**
- **Impact Slider**: Filter by minimum impact score (0-10)
- **Pillar Dropdown**: Show only specific pillars
- **Clear All**: Reset filters instantly

#### 3. **Priority List** (Top 10)
- Sorted by impact score (descending)
- Shows:
  - Cluster title
  - Pillar category
  - Impact label (Critical/High/Medium/Low)
  - Note volume
  - Last update timestamp
- Color-coded badges based on impact level

#### 4. **Navigation Bar**
Global navigation has been added with 3 main sections:
- 🏠 **Fire & Forget** - Quick note capture
- ✅ **Tracker** - Monitor note processing
- 🌌 **Galaxy** - Strategic dashboard

---

## 📊 How to Use

### Scenario 1: View All Clusters
1. Go to `/dashboard`
2. You'll see all clusters plotted on the Galaxy Chart
3. Top 10 priorities are listed on the right

### Scenario 2: Find High-Impact Clusters
1. Use the **Impact Slider** to set minimum score (e.g., 7)
2. The chart updates to show only critical/high-priority clusters

### Scenario 3: Focus on a Specific Pillar
1. Use the **Pillar Dropdown** to select (e.g., "ESG")
2. View only clusters in that strategic category

### Scenario 4: Identify Quick Wins
1. Set min impact to ~6 (High)
2. Look for clusters with **high volume + high impact**
3. These are trending issues with strong consensus

---

## 🎨 Design Features

### Dark "Galaxy" Theme
- Gradient background: `slate-900 → purple-900 → slate-900`
- Glassmorphism panels with backdrop blur
- Color-coded pillars for instant recognition

### Real-Time Updates
- Dashboard auto-refreshes every **30 seconds**
- Always shows the latest cluster data

### Responsive Layout
- Desktop optimized (as per requirements)
- 2/3 width for Galaxy Chart
- 1/3 width for Priority List

---

## 🧪 Testing Guide

### Create Sample Data

To properly test the Galaxy View, you need multiple clusters:

1. **Create 10+ notes** via the "Fire & Forget" interface
2. Use different topics (e.g., parking, IT issues, HR feedback)
3. Wait for AI processing (watch Celery worker logs)
4. Clusters will auto-group similar notes

### Expected Behavior

- **Single note clusters** appear as small bubbles
- **Multi-note clusters** appear larger
- **High impact scores** move right on the X-axis
- **High volume** moves up on the Y-axis

---

## 📂 Files Created/Modified

### Backend
- ✅ `backend/app/api/routes/board.py` - Galaxy API endpoints
- ✅ `backend/main.py` - Added board router

### Frontend
- ✅ `frontend/app/dashboard/page.tsx` - Main dashboard page
- ✅ `frontend/components/dashboard/GalaxyChart.tsx` - Scatter plot
- ✅ `frontend/components/dashboard/FilterBar.tsx` - Filters
- ✅ `frontend/components/dashboard/PriorityList.tsx` - Top 10 list
- ✅ `frontend/components/Navigation.tsx` - Global nav bar
- ✅ `frontend/app/layout.tsx` - Added navigation
- ✅ `frontend/package.json` - Added `lucide-react` dependency

---

## 🐛 Troubleshooting

### Dashboard is blank
- **Check**: Are there any clusters in Supabase?
- **Solution**: Create more notes to generate clusters

### "Failed to load dashboard data"
- **Check**: Is the backend API running?
- **Check**: Celery worker is processing notes?
- **Solution**: Verify API at `http://localhost:8000/api/docs`

### npm install fails
- **Issue**: Permission errors with npm cache
- **Solution**: 
  ```bash
  sudo chown -R $(whoami) ~/.npm
  npm cache clean --force
  npm install lucide-react
  ```

---

## 🚀 Next Steps (Optional Enhancements)

1. **Time-Lapse Feature** (Phase 2)
   - Add slider to view cluster evolution over time
   - Fetch historical snapshots from `cluster_snapshots`

2. **Cluster Detail View**
   - Click on a bubble to see all notes in that cluster
   - Show the AI-generated synthesis

3. **Export & Reporting**
   - Export priority list as PDF
   - Email digest of top clusters

4. **Real-Time WebSocket Updates**
   - Live cluster updates without refresh
   - Animated transitions when new clusters appear

---

## 🎉 Success Criteria

✅ You've successfully completed the Galaxy Dashboard when:
- You can see the scatter plot with color-coded bubbles
- Filters work (impact slider & pillar dropdown)
- Priority list shows top 10 clusters
- Navigation bar is visible on all pages
- Dashboard refreshes automatically every 30 seconds

---

**Need Help?** Check:
1. Backend logs: `uvicorn` terminal
2. Worker logs: `celery` terminal
3. Browser console: F12 → Console
4. API docs: http://localhost:8000/api/docs

🎯 **Your SIGMENT system is now complete with strategic visualization!** 🌌

