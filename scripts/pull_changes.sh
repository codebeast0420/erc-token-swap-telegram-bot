git pull origin main
pm2 delete bot
npm run build
pm2 start ./build/src/index.js --name bot