# Progress Bar Implementation for Payroll Processing & SIF Generation

## Context
The payroll processing and SIF file generation are currently long-running operations with no visual feedback. Users see a spinner but don't know how far along the process is or how much longer it will take. This change adds visual progress indicators to improve UX.

**Problem**: When processing payroll for many employees or generating SIF files, users have no visibility into progress, leading to uncertainty and potential repeated clicks.

**Solution**: Add real-time progress bars showing:
1. Percentage of employees processed during payroll finalization
2. Status of SIF file generation

## Implementation Strategy

### 1. Payroll Processing Progress (ManualAdjustmentModal)

**Files to modify**:
- `src/components/payroll/ManualAdjustmentModal.tsx`
- `src/app/(dashboard)/dashboard/payroll/page.tsx`

**Changes**:

In `page.tsx`:
- Add `processingProgress` state (number between 0-100)
- Modify `finalizeProcessPayroll` to report incremental progress:
  - Calculate progress after each employee: `(currentIndex / totalEmployees) * 100`
  - Since this runs in a synchronous `.map()`, we need to break it into batches OR use `setTimeout` to allow UI updates
  - Recommended: Process employees in small batches (e.g., 10 at a time) with `setTimeout` between batches to update progress
  - Or use a simple approach: set progress after each employee but wrap in `setTimeout(() => setProcessingProgress(...), 0)` to allow React to update
- Pass `processingProgress` prop to `ManualAdjustmentModal`
- Pass `processing` prop (already exists)

In `ManualAdjustmentModal.tsx`:
- Add prop: `processingProgress: number`
- In the footer, show a progress bar:
  - Below the "Finalize & Post Payroll" button or above it
  - Use the existing `Progress` component from `@/components/ui/progress`
  - Display percentage text: "Processing... {progress}%"
  - When `processing` is true and progress < 100, show the progress bar
  - When complete (100%), show "Complete!" briefly before closing

### 2. SIF Generation Progress (page.tsx)

**Files to modify**:
- `src/app/(dashboard)/dashboard/payroll/page.tsx`

**Since `generateWPSSIF` is synchronous and fast, we have two options**:

**Option A (Simple)**: Show an indeterminate spinner with a toast message "Generating SIF file..." - no percentage.

**Option B (Recommended)**: Show a modal progress dialog:
- Add state: `sifProgress` (number) and `showSIFProgress` (boolean)
- When "Download SIF" clicked:
  - Set `showSIFProgress = true`, `sifProgress = 0`
  - Use `setTimeout` to simulate progress (0 → 30 → 60 → 90 → 100)
  - Actually call generateWPSSIF in a setTimeout or use Web Worker? But the function is fast, so we can just:
    - Set progress to 50% before calling
    - Set progress to 100% after generating, before download
    - Close modal after download starts
- Show a modal with:
  - Title: "Generating SIF File"
  - Progress bar component
  - Status text: "Processing {n} employees..."
  - Cancel button (optional, but SIF generation is fast)

**Choice: Option B** provides consistent UX with payroll progress.

**Alternative approach**: Since SIF generation is just string concatenation and typically < 1 second, we could just show a spinner without percent. But for consistency, we'll show a quick progress animation.

### 3. UI Components Needed

**Import Progress component**:
```tsx
import { Progress } from '@/components/ui/progress';
```

**Progress modal for SIF** (inline in page.tsx):
```tsx
<Dialog open={showSIFProgress}>
  <DialogContent>
    <div className="space-y-4">
      <h3>Generating SIF File</h3>
      <Progress value={sifProgress} />
      <p className="text-sm text-muted-foreground">
        {sifProgress < 100 ? 'Processing...' : 'Complete!'}
      </p>
    </div>
  </DialogContent>
</Dialog>
```

**In ManualAdjustmentModal**:
Add below the finalize button:
```tsx
{processing && (
  <div className="w-full space-y-2">
    <Progress value={processingProgress} />
    <p className="text-xs text-center text-muted-foreground">
      Processing employees... {processingProgress}%
    </p>
  </div>
)}
```

### 4. Technical Considerations

**Payroll processing is CPU-bound**:
- Processing thousands of employees synchronously will block the main thread
- Updating state inside a loop won't trigger re-renders until the event loop yields
- Solution: Use `setTimeout` or `requestIdleCallback` to break work into chunks
- Batch size: 10-50 employees per batch depending on average data size

**Implementation pattern**:
```tsx
const finalizeProcessPayroll = async (adjustments: Record<string, { allowance: number, deduction: number }>) => {
  setProcessing(true);
  setProcessingProgress(0);

  const activeEmployees = employees.filter(e => e.status === 'active');
  const totalEmployees = activeEmployees.length;
  const batchSize = 20;
  
  const newItems: any[] = [];

  for (let i = 0; i < totalEmployees; i += batchSize) {
    const batch = activeEmployees.slice(i, i + batchSize);
    
    const batchItems = batch.map(emp => {
      // ... existing calculation logic
    });
    
    newItems.push(...batchItems);
    
    const progress = Math.round(((i + batch.length) / totalEmployees) * 100);
    setProcessingProgress(progress);
    
    // Yield to UI thread
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // ... rest of function (create run, save, etc.)
};
```

**Demo mode**: The same progress logic works for both demo and live modes.

**Error handling**: If an error occurs mid-batch, set `processing = false` and show error toast. Progress bar will disappear.

### 5. Steps to Implement

1. Add `processingProgress` state in `page.tsx`
2. Refactor `finalizeProcessPayroll` to use batched processing with progress updates
3. Update `ManualAdjustmentModal` to accept `processingProgress` prop and display progress bar
4. Add SIF generation states (`showSIFProgress`, `sifProgress`) in `page.tsx`
5. Modify `handleDownloadSIF` to show progress modal and update progress
6. Test with both demo and real data
7. Ensure progress bar closes/cancels properly on errors

### 6. Verification

**Manual Test**:
1. Go to Payroll page
2. Click "Process Monthly Payroll"
3. Observe: Manual Adjustment Modal shows progress bar updating as employees are processed
4. Complete processing
5. Select a payroll run
6. Click "Download SIF (WPS)"
7. Observe: Progress modal appears and completes
8. SIF file downloads

**Edge cases**:
- Single employee: progress goes 0 → 100 quickly
- Many employees (100+): smooth incremental updates
- Error during processing: error toast appears, modal stays open? Actually, modal should close on error in current implementation. We'll keep that behavior.

## Files to Modify

1. `src/app/(dashboard)/dashboard/payroll/page.tsx`
2. `src/components/payroll/ManualAdjustmentModal.tsx`

No new files needed - use existing `Progress` component.
