import {
  ackQueue,
  addToTaskQueue,
  logQueue,
  nextTask,
  requeueTaskAndAckWorkerQueue,
  toString
} from "./queue"

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

const TaskQ: TaskQueue = { type: "task", name: "taskQ" }
const TaskDlq: TaskQueue = { type: "task", name: "taskDlq" }
const Worker1Q: WorkerQueue = { type: "worker", name: "worker1Q" }
const Worker2Q: WorkerQueue = { type: "worker", name: "worker2Q" }
const MaxTries = 3

const handle = (workerQ: WorkerQueue, task: Task) =>
  console.log(`${workerQ.name} handle ${toString(task)}`)

const logError = (workerQ: WorkerQueue, task: Task, err: Error) =>
  console.log(`${workerQ.name} error ${toString(task)}, err=${err.message}`)

const randomlyThrowError = () => {
  const getRandomInt = (max: number) =>
    Math.floor(Math.random() * Math.floor(max))

  if (getRandomInt(3) === 0) throw new Error("boom")
}

const requeueTaskOnError = async (workerQ: WorkerQueue) => {
  let task = await nextTask(TaskQ, workerQ)
  while (task !== null) {
    try {
      handle(workerQ, task)
      randomlyThrowError()
      await ackQueue(workerQ, task)
    } catch (err) {
      logError(workerQ, task, err)
      await requeueTaskAndAckWorkerQueue(
        TaskQ,
        TaskDlq,
        workerQ,
        task,
        MaxTries
      )
    }
    task = await nextTask(TaskQ, workerQ)
  }
}

const run = async () => {
  await addToTaskQueue(
    TaskQ,
    Array(5)
      .fill(0)
      .map((_, i) => ({ evt: i.toString(), try: 1 }))
  )

  await Promise.all([
    requeueTaskOnError(Worker1Q),
    requeueTaskOnError(Worker2Q)
  ])

  logQueue(TaskQ)
  logQueue(TaskDlq)
  logQueue(Worker1Q)
  logQueue(Worker2Q)
}

run()
