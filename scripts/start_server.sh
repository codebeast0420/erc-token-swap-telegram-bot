#!/bin/bash
cd /app/backedn
NODE_ENV=production pm2 start build/index.js -f