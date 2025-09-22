## What is it?

This is a Docker Compose script allowing to run Jopi Rewrite with Bun.js inside Docker.
It uses the official Bun.js docker image, which is up to date with the latest version of Bun.js

## How to start the app?

You need `docker` to be installed.
Once installed, open a terminal into this directory and execute `docker compose up`

## The directory structure

```
|- docker-compose.yml   <- the docker script
|- app                  <- contains your Bun.js app. Can be updated.
   |- start.sh          <- execute by the docker VM once ready
```

The directory `app` is mounted through a volume.
You only need to update this directory content and restart the Docker VM in order to apply changes.

The `start.sh` script is executed once the VM is ready. His role is to installs dependencies and start the app.
His content is this one:

```shell
bun install
bun run build
bun run start
```

## Port binding

The file `docker-compose.yml` bind 3 ports to the host: `80` (http), `443` (https) and `3000`.

## Development mode

Jopi Rewrite has a dev mode where source changes are watched and the browser refreshed.
Currently, this doesn't work, du to limitation to the socket communication process which
is used internally.

A solution to this matter will be addressed in the next weeks.



