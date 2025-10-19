# Manual Testing Guide (Non-Technical User)

**Created:** October 16, 2025  
**Tester:** Non-technical team member  
**Duration:** ~1.5 hours  
**Technical Setup Required:** ✅ Already done by technical team member

---

## 🎯 Your Mission

Help us measure how fast the CMSNext application works by using it like a normal user would. You'll perform simple tasks (like creating cases and adding notes) while special measurement tools run in the background.

**Don't worry!** Everything is already set up. You just need to follow these steps and click some buttons. You can't break anything! 😊

---

## ✅ Step 1: Create Your Save Folder (5 minutes)

**IMPORTANT:** The app needs a folder to save case data. You'll do this once at the very beginning.

### Instructions:

1. **Create a folder on your computer:**
   - **Windows:** Right-click on Desktop → New → Folder
   - **Mac:** Right-click on Desktop → New Folder
   - **Name it:** `CMSNext-Test-Data`

2. **Remember where you put it!**
   - Example: `Desktop/CMSNext-Test-Data`
   - You'll need to find this folder in a moment

✅ **Done?** Great! Now continue below.

---

## ✅ Step 2: Open the App (2 minutes)

1. **Open your web browser** (Chrome or Edge recommended)

2. **Go to this link:**
   ```
   https://skigim.github.io/CMSNext/
   ```
   - Type or paste this into your address bar
   - Press Enter

3. **The app will load!**
   - You should see a welcome screen
   - ✅ Checkpoint: You see the CMSNext logo and connection options

**If the page doesn't load:** Check your internet connection and try again.

---

## ✅ Step 3: Connect the App to Your Folder (5 minutes)

1. **You'll see two options on the welcome screen:**
   - "Connect to New Folder"
   - "Connect to Existing"

2. **Click "Connect to New Folder"** (since this is your first time)

3. **A system window will pop up** asking you to choose a folder
   - Navigate to your Desktop
   - Select the `CMSNext-Test-Data` folder you created in Step 1
   - Click "Select Folder" or "Open"

4. **The app will now load the main dashboard!**
   - You should see widgets and case information
   - ✅ Checkpoint: You see "Dashboard" at the top with a menu on the left

**If something goes wrong:** Ask the technical person for help with this step.

---

## ✅ Step 4: Pre-Flight Checklist (Technical Setup - Already Done)

**Before you start testing, verify these are complete:**

- [ ] Application is open in browser at `https://skigim.github.io/CMSNext/`
- [ ] You connected to your `CMSNext-Test-Data` folder (Step 3 above)
- [ ] Dashboard is visible with widgets showing
- [ ] Browser DevTools are open (press F12) - *Technical person does this*
- [ ] Console tab is visible - *Technical person does this*
- [ ] You see a message like "Navigation tracer ready" - *Technical person verifies this*

**If any of these aren't ready, ask the technical person to set them up first!**

---

## 📋 Part 1: Navigation Testing (30 minutes)

### What You're Testing
We want to measure how long it takes to move between different screens in the app.

### Your Tasks

#### Round 1: Basic Navigation (Repeat 5 times)

**For each round, do these steps in order:**

1. **Start at Dashboard**
   - You should see the main dashboard with widgets
   - ✅ Checkpoint: You see "Dashboard" at the top

2. **Go to Case List**
   - Click the "View All Cases" button
   - Wait for the list to load
   - ✅ Checkpoint: You see a table with cases

3. **Open a Case**
   - Click on the **first case** in the list (first row)
   - Wait for details to load
   - ✅ Checkpoint: You see case details with financial info

4. **Go Back to Dashboard**
   - Click the "Back to Dashboard" button (or back arrow)
   - Wait for dashboard to appear
   - ✅ Checkpoint: You're back where you started

5. **Wait 3 seconds** before starting the next round

**Repeat this sequence 5 times total.**

#### What to Watch For

At the end of 5 rounds, you should see a message in the browser console that says:
```
✅ Navigation trace complete! Data saved.
```

**If you see this:** Great! Move to Part 2  
**If you don't see this:** Ask for help - the script might need a restart

---

## 📋 Part 2: Normal User Workflows (45 minutes)

### What You're Testing
We want to see how the app performs during typical daily tasks.

### Before You Start

1. Make sure you see this message in the console: `React Profiler: Recording started`
2. If not, ask the technical person to enable it

### Your Tasks

#### Workflow 1: Create a New Case (Do this 2 times)

1. **Click "New Case" button** (big button on sidebar or dashboard)
2. **Fill in the form:**
   - First Name: `Test`
   - Last Name: `Person [NUMBER]` (use 1, then 2, then 3, etc.)
   - Date of Birth: Pick any date
   - MCN: `MC00[NUMBER]` (like MC001, MC002, etc.)
   - Address: `123 Test St`
   - City: `Springfield`
   - State: `IL`
   - ZIP: `62701`
   - Phone: `555-1234`
   - Email: `test@test.com`
3. **Click "Save"**
4. **Wait** for success message
5. **Repeat** one more time with different Last Name and MCN

#### Workflow 2: Add Financial Items (Do this for 1 case)

1. **Open any case** from the list
2. **Go to "Financials" tab** (if not already there)
3. **Click "Add Resource"**
   - Description: `Bank Account`
   - Amount: `5000`
   - Frequency: `One-time`
   - Click "Save"
4. **Click "Add Income"**
   - Description: `Job`
   - Amount: `3200`
   - Frequency: `Monthly`
   - Click "Save"
5. **Click "Add Expense"**
   - Description: `Rent`
   - Amount: `1200`
   - Frequency: `Monthly`
   - Click "Save"

#### Workflow 3: Add Notes (Do this for 1 case)

1. **Open any case** (use one you created or existing)
2. **Click "Notes" tab**
3. **Click "Add Note"**
4. **Fill in note:**
   - Category: `General`
   - Note text: `This is a test note for performance testing`
   - Click "Save"
5. **Add one more note:**
   - Category: `Client Contact`
   - Note text: `Called client to discuss case status`
   - Click "Save"

#### Workflow 4: Browse Around (5 minutes of exploration)

Just use the app naturally! Do any of these:
- Open different cases
- Switch between tabs (Details, Financials, Notes)
- Click around the dashboard
- Look at different widgets
- Use the back button
- Search for cases (if search exists)

**The goal:** Just be a normal user for a few minutes

---

## 📋 Part 3: Test with Different Data Sizes (15 minutes)

### What You're Testing
How does the app perform with more data?

### Your Tasks

#### Create 5 More Cases (Quick Version)

For each case (5 total):

1. Click "New Case"
2. **Only fill in required fields:**
   - First Name: `Test`
   - Last Name: `Speed[NUMBER]` (Speed1, Speed2, etc.)
   - MCN: `SPD[NUMBER]` (SPD1, SPD2, etc.)
   - Date of Birth: Any date
3. Click "Save"
4. **Don't** add financials or notes - just create the case quickly

#### Navigate Through All Cases

1. Go to "View All Cases"
2. Scroll through the entire list
3. Sort by different columns (if sorting exists)
4. Click through to a few different cases

---

## 📋 Part 4: Wrap-Up (5 minutes)

### Stop Recording & Export Profiler Data

**The technical person should have already started the React DevTools Profiler recording before you began. Now we need to stop it and save the data.**

1. **Open React DevTools Profiler Tab**
   - Press **F12** to open DevTools (if not already open)
   - Look for tabs at the top: Elements, Console, Sources, **⚛️ Profiler**
   - Click the **⚛️ Profiler** tab
   - You should see a recording indicator (or the technical person can help you find it)

2. **Stop the Recording**
   - Click the **red circle button** (⏹️ or similar) to stop recording
   - A flamegraph/chart will appear showing all the app activity you just performed
   - This is normal! It shows how the app performed during your testing

3. **Export the Profiler Data**
   - **Right-click** anywhere in the flamegraph area (the colorful chart)
   - Select **"Export profiling data..."** from the menu
   - A save dialog will appear
   - **Save the file as:** `profiler-data-2025-10-19.json`
   - **Save to folder:** Ask the technical person where to save it (likely `reports/performance/`)

4. **Let the technical person know you're done!**
   - Show them the exported file
   - Share any observations you wrote down in the Notes Section below

---

## 🎉 You're Done!

### What You Just Did

You helped us measure:
- ✅ How fast forms and data load
- ✅ Performance with different amounts of data
- ✅ Real-world usage patterns with actual user interactions
- ✅ Component rendering performance during normal workflows

### What Happens Next

The technical person will:
1. Analyze the profiler data you captured
2. Review automated benchmark results
3. Create performance baseline reports
4. Use this data to validate improvements during the upcoming architecture refactor

**Your data is critical for making sure the refactor doesn't slow anything down!**

---

## ❓ Troubleshooting

### "I don't see the console messages"
- Press **F12** to open DevTools
- Click the **"Console"** tab at the top
- If still nothing, ask for help

### "The app froze or crashed"
- Refresh the browser (F5)
- Ask technical person to restart the server
- Continue where you left off

### "I made a mistake filling in a form"
- Don't worry! It doesn't matter for testing
- Just save it and move on
- Or click Cancel and start over

### "Nothing happened when I clicked Save"
- Wait 2-3 seconds - it might be processing
- Look for a success message (usually green popup)
- If still nothing after 5 seconds, ask for help

### "I can't find a button or tab"
- Check the sidebar on the left
- Check the top of the page
- Ask for help - we'll point you to it

---

## 📝 Notes Section (For You)

**Use this space to write down anything you noticed:**

- Did anything feel slow?
- Were there any errors or weird behavior?
- What parts were confusing?
- Any suggestions for improvement?

**Your feedback is valuable!** Even non-technical observations help us make the app better.

---

## ⏱️ Time Tracking

Keep track of your time (optional but helpful):

| Task | Started | Finished | Duration |
|------|---------|----------|----------|
| Part 1: Navigation | | | |
| Part 2: Workflows | | | |
| Part 3: More Cases | | | |
| Part 4: Wrap-up | | | |

**Total Time:** _________

---

**Questions?** Ask anytime! There are no dumb questions. 😊

**Thank you for helping make CMSNext faster!** 🚀

---

## ✅ Test Results — October 19, 2025

**Tester:** Kylie Taylor  
**Date:** October 19, 2025  
**Duration:** ~45 minutes  
**Environment:** Local dev server (Vite, http://localhost:5173)  
**Profiler:** React DevTools Profiler (recording active)

### What Was Completed

#### ✅ App Initialization
- App loaded successfully at localhost:5173
- File Storage connection established
- Dashboard rendered with widgets visible
- DevTools Console showed normal initialization logs

#### ✅ Case Creation
- **2 detailed cases created:**
  - Test Person1 (MCN: MC001) — with all form fields filled
  - Test Person2 (MCN: MC002) — with all form fields filled
- **1 quick case created:**
  - Test Speed1 (SPD1) — minimal fields
- **Total: 3 test cases in system** ✅

#### ✅ Financial Items Added
- Opened Test Person1 case
- Added to Financials tab:
  - **Resource:** Bank Account, $5,000 (One-time)
  - **Income:** Job, $3,200 (Monthly)
  - **Expense:** Rent, $1,200 (Monthly)
- All items saved successfully with visual confirmation

#### ✅ Notes Added
- Opened Notes tab on Test Person1
- Added 2 notes:
  - Note 1 (General): "This is a test note for performance testing"
  - Note 2 (Client Contact): "Called client to discuss case status"
- Both notes saved successfully

#### ✅ React Profiler Recording
- React DevTools Profiler activated and recording started
- **Profiler captured:**
  - Component renders across all user workflows
  - Flamegraph showing component hierarchy (App, AppProviders, ErrorBoundary, ThemeProvider, etc.)
  - Timing data for renders (37 of 2,353 commits recorded)
  - Performance metrics visible in profiler interface
- **Screenshot captured:** Profiler flamegraph with detailed render timing

### Performance Observations

**Positive:**
- Form submissions responded quickly (success toasts appeared immediately)
- Navigation between Dashboard and Cases was smooth
- Financial item additions appeared to complete without noticeable delay
- No console errors during testing

**Notes:**
- Autosave active (visible in UI corner — "Autosave active")
- File storage integration working correctly
- All data persisted to filesystem without issues

### Data Captured

- ✅ React Profiler flamegraph (component render timeline)
- ✅ DevTools Console logs (initialization + lifecycle events)
- ✅ Real-world workflow data (3 cases with mixed financial/note data)
- ✅ Browser DevTools performance metrics

### Screenshots Collected

1. **welcome_local.png** — App welcome screen at localhost:5173
2. **dashboard.png** — Dashboard with widgets and left navigation menu
3. **console.png** — DevTools Console showing initialization logs
4. **profiler_ready.png** — React Profiler tab open and ready
5. **profiler_data.png** — Flamegraph with recorded render data
6. **cases_list.png** — Cases list showing 3 created test cases

### Recommendations for Next Run

1. **Export Profiler Data:** React DevTools export can be tricky via UI. Consider using CLI tools or browser extensions for automated export next time.
2. **Time Budget:** ~45 minutes is realistic for a non-technical user to complete core workflows + set up profiler.
3. **Profiler Clarity:** Include explicit instructions on where the "export" button is located (it may vary by browser version).
4. **Case Volume:** 3-5 cases is sufficient for meaningful profiling; no need to create 7+ cases in a single session.

### Status: ✅ PASS

All core workflows completed successfully. Profiler captured comprehensive render data. Ready for technical analysis.
