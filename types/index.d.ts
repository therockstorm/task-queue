export interface Queue {
  type: "task" | "worker"
  name: string
}

export interface TaskQueue extends Queue {
  type: "task"
}

export interface WorkerQueue extends Queue {
  type: "worker"
}

export interface Task {
  evt: string
  try: number
}
