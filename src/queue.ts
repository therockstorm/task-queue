import Redis from "ioredis"
import { Queue, Task, TaskQueue, WorkerQueue } from "."

const redis = new Redis({
  maxRetriesPerRequest: 20 // ioredis default
})

export const toString = (task: Task) => JSON.stringify(task)

export const logQueue = async (q: Queue) =>
  console.log(`${q.name}=${await redis.lrange(q.name, 0, -1)}`)

export const addToTaskQueue = async (taskQ: TaskQueue, tasks: Task[]) =>
  redis.lpush(taskQ.name, tasks.map(toString))

export const nextTask = async (
  taskQ: TaskQueue,
  workerQ: WorkerQueue
): Promise<Task> => JSON.parse(await redis.rpoplpush(taskQ.name, workerQ.name))

export const ackQueue = async (workerQ: WorkerQueue, task: Task) =>
  redis.lrem(workerQ.name, -1, toString(task))

export const requeueTaskAndAckWorkerQueue = async (
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
