"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ChartBar, DotsSixVertical, FolderSimple, Plus, Sparkle } from "@phosphor-icons/react/dist/ssr"
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { projects, type Project, type FilterCounts } from "@/lib/data/projects"
import { getProjectDetailsById, getProjectTasks, type ProjectTask } from "@/lib/data/project-details"
import { DEFAULT_VIEW_OPTIONS, type FilterChip as FilterChipType, type ViewOptions } from "@/lib/view-options"
import { TaskRowBase } from "@/components/tasks/TaskRowBase"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProgressCircle } from "@/components/progress-circle"
import { FilterPopover } from "@/components/filter-popover"
import { ChipOverflow } from "@/components/chip-overflow"
import { ViewOptionsPopover } from "@/components/view-options-popover"
import { cn } from "@/lib/utils"
import { TaskQuickCreateModal, type CreateTaskContext } from "@/components/tasks/TaskQuickCreateModal"

type ProjectTaskGroup = {
  project: Project
  tasks: ProjectTask[]
}

export function MyTasksPage() {
  const [groups, setGroups] = useState<ProjectTaskGroup[]>(() => {
    return projects
      .map((project) => {
        const details = getProjectDetailsById(project.id)
        const tasks = getProjectTasks(details)
        return { project, tasks }
      })
      .filter((group) => group.tasks.length > 0)
  })

  const [filters, setFilters] = useState<FilterChipType[]>([{ key: "members", value: "jason" }])
  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS)

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [createContext, setCreateContext] = useState<CreateTaskContext | undefined>(undefined)

  const counts = useMemo<FilterCounts>(() => {
    const allTasks = groups.flatMap((g) => g.tasks)
    return computeTaskFilterCounts(allTasks)
  }, [groups])

  const visibleGroups = useMemo<ProjectTaskGroup[]>(() => {
    if (!filters.length) return groups

    return groups
      .map((group) => ({
        project: group.project,
        tasks: filterTasksByChips(group.tasks, filters),
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groups, filters])

  const openCreateTask = (context?: CreateTaskContext) => {
    setCreateContext(context)
    setIsCreateTaskOpen(true)
  }

  const handleTaskCreated = (task: ProjectTask) => {
    setGroups((prev) => {
      const projectExists = prev.some((g) => g.project.id === task.projectId)
      const project = projects.find((p) => p.id === task.projectId)

      const ensureGroup = (current: ProjectTaskGroup[]): ProjectTaskGroup[] => {
        if (projectExists || !project) return current
        const details = getProjectDetailsById(project.id)
        const existingTasks = getProjectTasks(details)
        return [
          { project, tasks: [...existingTasks, task] },
          ...current,
        ]
      }

      const next = prev.map((group) => {
        if (group.project.id !== task.projectId) return group
        return {
          ...group,
          tasks: [...group.tasks, task],
        }
      })

      return ensureGroup(next)
    })
  }

  const toggleTask = (taskId: string) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: task.status === "done" ? "todo" : "done",
              }
            : task,
        ),
      })),
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // Find the group containing the active task
    const activeGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === active.id)
    )

    if (activeGroupIndex === -1) return

    const activeGroup = groups[activeGroupIndex]

    // Find the group containing the over task
    const overGroupIndex = groups.findIndex((group) =>
      group.tasks.some((task) => task.id === over.id)
    )

    if (overGroupIndex === -1) return

    // For now, only allow reordering within the same group
    if (activeGroupIndex !== overGroupIndex) return

    const activeIndex = activeGroup.tasks.findIndex((task) => task.id === active.id)
    const overIndex = activeGroup.tasks.findIndex((task) => task.id === over.id)

    if (activeIndex === -1 || overIndex === -1) return

    const reorderedTasks = arrayMove(activeGroup.tasks, activeIndex, overIndex)

    setGroups((prev) =>
      prev.map((group, index) =>
        index === activeGroupIndex ? { ...group, tasks: reorderedTasks } : group
      )
    )
  }

  if (!visibleGroups.length) {
    return (
      <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/70">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
            <p className="text-xs text-muted-foreground">No tasks available yet.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex flex-col border-b border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openCreateTask()}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <FilterPopover
              initialChips={filters}
              onApply={setFilters}
              onClear={() => setFilters([])}
              counts={counts}
            />
            <ChipOverflow
              chips={filters}
              onRemove={(key, value) =>
                setFilters((prev) => prev.filter((chip) => !(chip.key === key && chip.value === value)))
              }
              maxVisible={6}
            />
          </div>
          <div className="flex items-center gap-2">
            <ViewOptionsPopover options={viewOptions} onChange={setViewOptions} allowedViewTypes={["list", "board"]} />
            <div className="relative">
              <div className="relative rounded-xl border border-border bg-card/80 shadow-sm overflow-hidden">
                <Button className="h-8 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 relative z-10 px-3">
                  <Sparkle className="h-4 w-4" weight="fill" />
                  Ask AI
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {visibleGroups.map((group) => (
            <ProjectTasksSection
              key={group.project.id}
              group={group}
              onToggleTask={toggleTask}
              onAddTask={(context) => openCreateTask(context)}
            />
          ))}
        </DndContext>
      </div>

      <TaskQuickCreateModal
        open={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        context={createContext}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  )
}

type TaskPriorityProps = {
  priority: NonNullable<ProjectTask["priority"]>
}

function TaskPriority({ priority }: TaskPriorityProps) {
  const label = getPriorityLabel(priority)

  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

function getPriorityLabel(priority: NonNullable<ProjectTask["priority"]>): string {
  switch (priority) {
    case "high":
      return "High"
    case "medium":
      return "Medium"
    case "low":
      return "Low"
    case "urgent":
      return "Urgent"
    default:
      return "No priority"
  }
}

type ProjectTasksSectionProps = {
  group: ProjectTaskGroup
  onToggleTask: (taskId: string) => void
  onAddTask: (context: CreateTaskContext) => void
}

function ProjectTasksSection({ group, onToggleTask, onAddTask }: ProjectTasksSectionProps) {
  const { project, tasks } = group
  const total = tasks.length
  const done = tasks.filter((t) => t.status === "done").length
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <section className="max-w-6xl mx-auto rounded-3xl border border-border bg-muted shadow-[var(--shadow-workstream)] p-3 space-y-2">
      <header className="flex items-center justify-between gap-4 px-0 py-1">
        <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
          <FolderSimple className="h-5 w-5" weight="regular" />
        </div>
        <div className="flex-1 space-y-1">
          <span className="text-sm font-semibold leading-tight">{project.name}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ChartBar className="h-3 w-3" weight="regular" />
              <span className="font-medium">{capitalize(project.priority)}</span>
            </span>
            <div className="h-4 w-px bg-border/70" />
            {project.typeLabel && project.durationLabel && (
              <>
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                  {project.typeLabel} {project.durationLabel}
                </span>
                <div className="h-4 w-px bg-border/70" />
              </>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
              {getProjectStatusLabel(project.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">
            {done}/{total}
          </span>
          <ProgressCircle progress={percent} color="var(--chart-2)" size={18} />
          <div className="h-4 w-px bg-border/80" />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-7 rounded-full text-muted-foreground hover:bg-transparent"
            aria-label="Add task"
            onClick={() =>
              onAddTask({
                projectId: project.id,
                workstreamName: tasks[0]?.workstreamName,
              })
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="space-y-1 px-2 py-3 bg-background rounded-2xl border border-border">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskRowDnD
              key={task.id}
              task={task}
              onToggle={() => onToggleTask(task.id)}
            />
          ))}
        </SortableContext>
      </div>
    </section>
  )
}

type TaskBadgesProps = {
  workstreamName?: string
}

function TaskBadges({ workstreamName }: TaskBadgesProps) {
  if (!workstreamName) return null

  return (
    <Badge variant="muted" className="whitespace-nowrap text-[11px]">
      {workstreamName}
    </Badge>
  )
}

type TaskStatusProps = {
  status: ProjectTask["status"]
}

function TaskStatus({ status }: TaskStatusProps) {
  const label = getStatusLabel(status)
  const color = getStatusColor(status)

  return <span className={cn("font-medium", color)}>{label}</span>
}

function getStatusLabel(status: ProjectTask["status"]): string {
  switch (status) {
    case "done":
      return "Done"
    case "in-progress":
      return "In Progress"
    default:
      return "To do"
  }
}

function getStatusColor(status: ProjectTask["status"]): string {
  switch (status) {
    case "done":
      return "text-emerald-500"
    case "in-progress":
      return "text-amber-500"
    default:
      return "text-muted-foreground"
  }
}

function getProjectStatusLabel(status: Project["status"]): string {
  switch (status) {
    case "active":
      return "In Progress"
    case "planned":
      return "Planned"
    case "backlog":
      return "Backlog"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return capitalize(status)
  }
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function filterTasksByChips(tasks: ProjectTask[], chips: FilterChipType[]): ProjectTask[] {
  if (!chips.length) return tasks

  const memberValues = chips
    .filter((chip) => chip.key.toLowerCase().startsWith("member") || chip.key.toLowerCase() === "pic")
    .map((chip) => chip.value.toLowerCase())

  if (!memberValues.length) return tasks

  return tasks.filter((task) => {
    const name = task.assignee?.name.toLowerCase() ?? ""

    for (const value of memberValues) {
      if (value === "no member" && !task.assignee) return true
      if (value === "current member" && task.assignee) return true
      if (value && name.includes(value)) return true
    }

    return false
  })
}

function computeTaskFilterCounts(tasks: ProjectTask[]): FilterCounts {
  const counts: FilterCounts = {
    members: {
      "no-member": 0,
      current: 0,
      jason: 0,
    },
  }

  for (const task of tasks) {
    if (!task.assignee) {
      counts.members!["no-member"] = (counts.members!["no-member"] || 0) + 1
    } else {
      counts.members!.current = (counts.members!.current || 0) + 1

      const name = task.assignee.name.toLowerCase()
      if (name.includes("jason duong")) {
        counts.members!.jason = (counts.members!.jason || 0) + 1
      }
    }
  }

  return counts
}

function getTaskDescriptionSnippet(task: ProjectTask): string {
  if (!task.description) return ""
  const plain = task.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return plain
}

type TaskRowDnDProps = {
  task: ProjectTask
  onToggle: () => void
}

function TaskRowDnD({ task, onToggle }: TaskRowDnDProps) {
  const isDone = task.status === "done"

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRowBase
        checked={isDone}
        title={task.name}
        onCheckedChange={onToggle}
        titleAriaLabel={task.name}
        titleSuffix={<TaskBadges workstreamName={task.workstreamName} />}
        subtitle={getTaskDescriptionSnippet(task)}
        meta={
          <>
            <TaskStatus status={task.status} />
            {task.startDate && (
              <span className="text-muted-foreground">
                Start: {format(task.startDate, "dd/MM")}
              </span>
            )}
            {task.dueLabel && (
              <span className="text-muted-foreground">{task.dueLabel}</span>
            )}
            {task.priority && <TaskPriority priority={task.priority} />}
            {task.tag && (
              <Badge variant="outline" className="whitespace-nowrap text-[11px]">
                {task.tag}
              </Badge>
            )}
            {task.assignee && (
              <Avatar className="size-6">
                {task.assignee.avatarUrl && (
                  <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                )}
                <AvatarFallback>{task.assignee.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 rounded-md text-muted-foreground cursor-grab active:cursor-grabbing"
              aria-label="Reorder task"
              {...attributes}
              {...listeners}
            >
              <DotsSixVertical className="h-4 w-4" weight="regular" />
            </Button>
          </>
        }
        className={isDragging ? "opacity-60" : ""}
      />
    </div>
  )
}
