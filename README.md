# task-queue

Reliable task queue utilizing Redis's [RPOPLPUSH](https://redis.io/commands/rpoplpush#pattern-reliable-queue).

## Local Development

1. Start Redis, `docker-compose up`
1. Build, `npm run build`
1. Run, `node dist`

You can also run `npm start` to rebuild on change so that, in another terminal session, you can just run `node dist` at will.
