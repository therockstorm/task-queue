import {
  ackWorker,
  addTasks,
  logQueues,
  nextTask,
  requeueTaskAndAckWorker,
  toString
} from "./queue"
import { TaskQueue, WorkerQueue } from "../types"

const TaskQ: TaskQueue = { type: "task", name: "taskQ" }
const TaskDlq: TaskQueue = { type: "task", name: "taskDlq" }
const Worker1Q: WorkerQueue = { type: "worker", name: "worker1Q" }
const Worker2Q: WorkerQueue = { type: "worker", name: "worker2Q" }
const MaxTries = 3

const main = async () => {
  await addTasks(
    TaskQ,
    Array(5)
      .fill(0)
      .map((_, i) => ({ evt: i.toString(), try: 1 }))
  )

  await Promise.all([
    requeueTaskOnError(Worker1Q),
    requeueTaskOnError(Worker2Q)
  ])

  logQueues([TaskQ, TaskDlq, Worker1Q, Worker2Q])
}

const requeueTaskOnError = async (workerQ: WorkerQueue) => {
  let task = await nextTask(TaskQ, workerQ)
  while (task !== null) {
    try {
      console.log(`${workerQ.name} handled ${toString(task)}`)
      randomlyThrowError()
      await ackWorker(workerQ, task)
    } catch (err) {
      console.log(`${workerQ.name} ${toString(task)}, err=${err.message}`)
      await requeueTaskAndAckWorker(TaskQ, TaskDlq, workerQ, task, MaxTries)
    }
    task = await nextTask(TaskQ, workerQ)
  }
}

const randomlyThrowError = () => {
  const getRandomInt = (max: number) =>
    Math.floor(Math.random() * Math.floor(max))

  if (getRandomInt(3) === 0) throw new Error("boom")
}

main()
