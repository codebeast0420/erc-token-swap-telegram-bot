#!/bin/bash

# verify to see app working fine or not
curl -v --silent localhost:3000/ 2>&1 | grep OK

sudo kill -9 `sudo lsof -t -i:3000`

cd /app/backedn
NODE_ENV=production pm2 stop build/index.js -f

cd /app/backedn
NODE_ENV=production pm2 start build/index.js --node-args="--max-old-space-size=49152" -f