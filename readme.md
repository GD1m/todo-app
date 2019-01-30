# Simple TODO application based on [TodoMVC](http://todomvc.com)

## Installation Guide

- clone this repository
- `cd ./public`
- `npm install`
- `cp config.json.example config.json`
- edit config.json
- return to root directory (`$ cd ..`)
- `cd ./docker`
- `cp .env.example .env`
- edit docker env config (./docker/.env)
- `docker-compose up -d`

And you are done.

Application will be available on configured port (80 by default) and host (localhost by default).

## See also
* [https://github.com/GD1m/todo-api](https://github.com/GD1m/todo-api)


