import {
  ackWorker,
  addTasks,
  logQueues,
  nextTask,
  requeueTaskAndAckWorker,
  toString,
  workersWithTasks
} from "./queue"
import { TaskQueue, WorkerQueue } from "../types"

const WorkerPrefix = "worker:"
const TaskQ: TaskQueue = { type: "task", name: "task" }
const TaskDlq: TaskQueue = { type: "task", name: "taskDlq" }
const Worker1Q: WorkerQueue = { type: "worker", name: `${WorkerPrefix}1` }
const Worker2Q: WorkerQueue = { type: "worker", name: `${WorkerPrefix}2` }
const MaxTries = 3

const main = async () => {
  // A worker could die and not recover. For non-critical tasks, you could EXPIRE the worker queue.
  // For others, you may want job to move unprocessed worker tasks back to task queue.
  // `workersWithTasks` scans for workers with tasks from a previous run.
  console.log(`Workers with tasks '${await workersWithTasks(WorkerPrefix)}'`)

  await addTasks(
    TaskQ,
    Array(5)
      .fill(0)
      .map((_, i) => ({ evt: i.toString(), try: 1 }))
  )

  // If workers are running as separate instances on AWS, you could auto-scale them with
  // `autoscaling.putScalingPolicy({ ..., ScalingAdjustment: ??? })` based on task queue's LLEN.
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
