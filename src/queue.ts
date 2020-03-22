import Redis from "ioredis"
import { Queue, Task, TaskQueue, WorkerQueue } from "../types"

const redis = new Redis({
  maxRetriesPerRequest: 20 // ioredis default
})

export const workersWithTasks = async (prefix: string) =>
  new Promise(resolve => {
    const keys = new Set()
    const stream = redis.scanStream({ match: `${prefix}*` })
    stream.on("data", res => res.forEach((r: string) => keys.add(r)))
    stream.on("end", () => resolve(Array.from(keys)))
  })

export const addTasks = async (taskQ: TaskQueue, tasks: Task[]) =>
  redis.lpush(taskQ.name, tasks.map(toString))

export const nextTask = async (
  taskQ: TaskQueue,
  workerQ: WorkerQueue
): Promise<Task> => JSON.parse(await redis.rpoplpush(taskQ.name, workerQ.name))

export const ackWorker = async (workerQ: WorkerQueue, task: Task) =>
  redis.lrem(workerQ.name, -1, toString(task))

export const requeueTaskAndAckWorker = async (
  taskQ: TaskQueue,
  taskDlq: TaskQueue,
  workerQ: WorkerQueue,
  task: Task,
  maxTries: number
) => {
  const taskStr = toString(task)
  if (task.try >= maxTries) {
    console.log(`${workerQ.name} DLQ ${taskStr}`)
    await redis
      .multi()
      .lpush(taskDlq.name, taskStr)
      .lrem(workerQ.name, -1, taskStr)
      .exec()
  } else {
    await redis
      .multi()
      .rpush(taskQ.name, toString({ ...task, try: task.try + 1 }))
      .lrem(workerQ.name, -1, taskStr)
      .exec()
  }
}

export const toString = (task: Task) => JSON.stringify(task)

export const logQueues = async (qs: Queue[]) => Promise.all(qs.map(logQueue))

const logQueue = async (q: Queue) =>
  console.log(`${q.name}=${await redis.lrange(q.name, 0, -1)}`)
