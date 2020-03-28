import { Cloudevent } from "cloudevents-sdk/v1"

export interface Queue {
  name: string
  type: "task" | "worker"
}

export interface TaskQueue extends Queue {
  type: "task"
}

export interface WorkerQueue extends Queue {
  type: "worker"
}

export interface Task {
  attempt: number
  evt: Cloudevent
}
