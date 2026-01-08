# Workboard System - Future Enhancements

## Current State (January 2026)
The workboard system uses a **universal 4-column Kanban** shared across all departments:
- **Backlog** → **In Progress** → **Review** → **Complete**

All departments (Graphics, Video, Events, Scouting, Social Media, Production) use the same `status` field in the `Tasks` collection.

---

## Planned Enhancement: Per-Department Workflows

### The Problem
Different departments have different workflows:
- **Events** might need: "Ideas" → "Planning" → "This Week" → "Recurring" → "Done"
- **Scouting** might need: "Research" → "Profiling" → "Review" → "Archived"
- **Graphics/Video** might be fine with the current generic workflow

### The Solution (When Needed)
**Option 1: Department-Specific Status Sets**

1. Add a `workflowConfig` to each department dashboard global that defines:
   - Column names and order
   - Which status values map to each column
   - Column colors/icons

2. Extend the `Tasks.status` field to include all possible values across departments:
   ```
   backlog, in-progress, review, complete,  // Generic
   ideas, planning, this-week, recurring,   // Events
   research, profiling, archived            // Scouting
   ```

3. Update `KanbanBoard` component to accept `columns` prop:
   ```tsx
   <KanbanBoard 
     department="events"
     columns={[
       { id: 'ideas', label: 'Ideas 💡', status: 'backlog' },
       { id: 'planning', label: 'Planning 📋', status: 'in-progress' },
       { id: 'this-week', label: 'This Week 🗓️', status: 'review' },
       { id: 'done', label: 'Done ✅', status: 'complete' },
     ]}
   />
   ```

### Implementation Steps (When Ready)
1. Gather feedback from department heads on their actual workflow needs
2. Add new status enum values to Tasks collection
3. Run database migration to add enum values
4. Create column config for each department
5. Update KanbanBoard to use column config
6. Test with each department

### Estimated Effort
- **Simple relabeling only:** ~1 hour
- **Full custom workflows with new columns:** ~2-3 hours
- **Database migration:** ~15 minutes

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-08 | Start with universal 4-column workflow | Don't over-engineer before knowing actual workflows |
| 2026-01-08 | Plan for per-department customization | Architecture supports it when needed |

---

## When to Implement
Implement customization when:
- [ ] Department heads report the current columns don't fit their workflow
- [ ] At least 2 weeks of usage to understand real patterns
- [ ] Clear requirements from at least one department

---

## Related Files
- `src/collections/Tasks/index.ts` - Task collection with status field
- `src/components/WorkboardKanban/KanbanBoard.tsx` - Kanban UI component
- `src/globals/*Dashboard.ts` - Department dashboard configurations
