#!/bin/bash

sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

npm install

rm ./node_modules/web3-providers-http/lib/index.js
rm ./node_modules/web3-providers-http/src/index.js

rm ./node_modules/web3-core-helpers/lib/formatters.js
rm ./node_modules/web3-core-helpers/src/formatters.js

cp ./temp/index.js ./node_modules/web3-providers-http/lib
cp ./temp/index.js ./node_modules/web3-providers-http/src

cp ./temp/formatters.js ./node_modules/web3-core-helpers/lib
cp ./temp/formatters.js ./node_modules/web3-core-helpers/src

npm run build


# sudo chmod 777 -R /tmp/

# sed -i 's/callback(errors.InvalidResponse(response));/console.log("###", h, payload, error, response);callback(null, {jsonrpc: "2.0",id: 0,result: {}});/g' ./node_modules/web3-providers-http/lib/index.js
# sed -i 's/callback(errors.InvalidResponse(response));/console.log("###", h, payload, error, response);callback(null, {jsonrpc: "2.0",id: 0,result: {}});/g'./node_modules/web3-providers-http/src/index.js

# sed -i 's/tx.gas = utils.hexToNumber(tx.gas);/if (tx.gas) tx.gas = outputBigNumberFormatter(tx.gas);/g' ./node_modules/web3-core-helpers/lib/formatters.js
# sed -i 's/tx.gas = utils.hexToNumber(tx.gas);/if (tx.gas) tx.gas = outputBigNumberFormatter(tx.gas);/g' ./node_modules/web3-core-helpers/src/formatters.js