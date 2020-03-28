import { event } from "cloudevents-sdk/v1"
import Redis from "ioredis"
import { Queue, Task, TaskQueue, WorkerQueue } from "../types"

interface Key {
  id: string
  time: string
}

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
  Promise.all(tasks.map(t => addTask(taskQ, t)))

const addTask = async (taskQ: TaskQueue, task: Task) => {
  const key = toString(createKey(task))
  await redis
    .multi()
    .set(key, JSON.stringify({ attempt: 1, evt: task.evt.toString() }))
    .lpush(taskQ.name, key)
    .exec()
}

export const nextTask = async (
  taskQ: TaskQueue,
  workerQ: WorkerQueue
): Promise<Task | null> => {
  const key = await redis.rpoplpush(taskQ.name, workerQ.name)
  if (key === null) return null

  const res = await redis.get(key)
  if (res === null) return null

  const r = JSON.parse(res)
  const e = JSON.parse(r.evt)
  return {
    attempt: r.attempt,
    evt: event()
      .id(e.id)
      .source(e.source)
      .time(new Date(e.time))
      .type(e.type)
      .dataContentType(e.datacontenttype)
      .data(e.data)
  }
}

export const ackWorker = async (workerQ: WorkerQueue, task: Task) => {
  const key = toString(createKey(task))
  await redis
    .multi()
    .lrem(workerQ.name, -1, key)
    .del(key)
    .exec()
}

export const requeueTaskAndAckWorker = async (
  taskQ: TaskQueue,
  taskDlq: TaskQueue,
  workerQ: WorkerQueue,
  task: Task,
  maxAttempts: number
) => {
  const key = createKey(task)
  const keyStr = toString(key)
  if (task.attempt >= maxAttempts) {
    console.log(`${workerQ.name} DLQ ${toString(task.evt.getData() as Task)}`)
    await redis
      .multi()
      .lpush(taskDlq.name, keyStr)
      .lrem(workerQ.name, -1, keyStr)
      .exec()
  } else {
    await redis
      .multi()
      .set(
        keyStr,
        JSON.stringify({ attempt: task.attempt + 1, evt: task.evt.toString() })
      )
      .rpush(taskQ.name, keyStr)
      .lrem(workerQ.name, -1, keyStr)
      .exec()
  }
}

export const toString = <T>(obj: T) => JSON.stringify(obj)

export const logQueues = async (qs: Queue[]) => Promise.all(qs.map(logQueue))

const logQueue = async (q: Queue) =>
  console.log(`${q.name}=${await redis.lrange(q.name, 0, -1)}`)

const createKey = (task: Task): Key => ({
  id: `${task.evt.getSource()}/${task.evt.getId()}`,
  time: task.evt.getTime().toString()
})
